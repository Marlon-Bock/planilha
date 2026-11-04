<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\AuthController;
use App\Models\Investment;
use App\Models\User;
use App\Services\InvestmentCalculator;
use App\Services\MarketRates;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvestmentTest extends TestCase
{
    use RefreshDatabase;

    private const CDI = 13.65;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-04 10:00:00'); // quarta-feira
        // Taxas fixas: os testes não dependem da API do Banco Central.
        $this->instance(MarketRates::class, new class extends MarketRates {
            public function all(): array
            {
                return ['cdi' => 13.65, 'selic' => 13.75, 'ipca' => 4.5, 'date' => '2026-11-03', 'source' => 'test'];
            }
        });
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function user(): User
    {
        $u = User::factory()->create();
        AuthController::bootstrapUser($u);

        return $u;
    }

    private function cdiFactor(float $pct): float
    {
        return 1 + ((1 + self::CDI / 100) ** (1 / 252) - 1) * ($pct / 100);
    }

    public function test_business_days(): void
    {
        $this->assertSame(1, InvestmentCalculator::businessDays(Carbon::parse('2026-10-30'), Carbon::parse('2026-11-02'))); // sex → seg
        $this->assertSame(5, InvestmentCalculator::businessDays(Carbon::parse('2026-11-02'), Carbon::parse('2026-11-09'))); // seg → seg
        $this->assertSame(0, InvestmentCalculator::businessDays(Carbon::parse('2026-11-07'), Carbon::parse('2026-11-08'))); // sáb → dom
    }

    public function test_opening_balance_counts_in_total_but_not_in_month_yield(): void
    {
        $u = $this->user();
        $res = $this->actingAs($u)->postJson('/api/investments', [
            'name' => 'Caixinha Viagem', 'institution' => 'Nubank', 'type' => 'caixinha', 'rate_type' => 'cdi', 'rate' => 100,
            'liquidity' => 'daily', 'invested_amount' => 5000, 'current_balance' => 5400,
        ])->assertCreated();

        $res->assertJsonPath('data.balance', 5400)
            ->assertJsonPath('data.invested', 5000)
            ->assertJsonPath('data.yield', 400)
            ->assertJsonPath('data.yield_percent', 8)
            ->assertJsonPath('data.month_yield', 0)
            ->assertJsonPath('data.is_estimated', false);
    }

    public function test_deposit_after_same_day_balance_is_added(): void
    {
        $u = $this->user();
        $id = $this->actingAs($u)->postJson('/api/investments', [
            'name' => 'Turbo', 'type' => 'caixinha', 'rate_type' => 'cdi', 'rate' => 115, 'liquidity' => 'daily',
            'invested_amount' => 5000, 'current_balance' => 5400,
        ])->json('data.id');

        // Aporte registrado no mesmo dia, depois do saldo do cadastro.
        $this->actingAs($u)->postJson("/api/investments/{$id}/movements", ['type' => 'deposit', 'amount' => 600, 'date' => today()->toDateString()])
            ->assertCreated()
            ->assertJsonPath('data.balance', 6000)
            ->assertJsonPath('data.invested', 5600)
            ->assertJsonPath('data.yield', 400);

        // Atualizar o saldo no mesmo dia (já incluindo o aporte) também fica certo.
        $this->actingAs($u)->postJson("/api/investments/{$id}/movements", ['type' => 'balance', 'amount' => 6003.5, 'date' => today()->toDateString()])
            ->assertCreated()
            ->assertJsonPath('data.balance', 6003.5)
            ->assertJsonPath('data.yield', 403.5)
            ->assertJsonPath('data.month_yield', 3.5);
    }

    public function test_cdi_estimate_compounds_per_business_day(): void
    {
        $u = $this->user();
        $inv = Investment::create(['user_id' => $u->id, 'name' => 'Turbo', 'type' => 'caixinha', 'rate_type' => 'cdi', 'rate' => 115, 'liquidity' => 'daily']);
        $inv->movements()->create(['type' => 'deposit', 'amount' => 10000, 'date' => '2026-10-01']);

        $days = InvestmentCalculator::businessDays(Carbon::parse('2026-10-01'), today());
        $expected = round(10000 * $this->cdiFactor(115) ** $days, 2);

        $data = $this->actingAs($u)->getJson('/api/investments')->assertOk()->json('data.0');
        $this->assertEqualsWithDelta($expected, $data['balance'], 0.01);
        $this->assertTrue($data['is_estimated']);
        $this->assertEqualsWithDelta(15.80, $data['annual_rate'], 0.05); // 115% de 13,65% a.a.
        // Rendimento de novembro = só os dias úteis de novembro.
        $octEnd = 10000 * $this->cdiFactor(115) ** InvestmentCalculator::businessDays(Carbon::parse('2026-10-01'), Carbon::parse('2026-10-31'));
        $this->assertEqualsWithDelta($expected - $octEnd, $data['month_yield'], 0.02);
    }

    public function test_reported_balance_corrects_estimate_and_withdraw_reduces_invested(): void
    {
        $u = $this->user();
        $inv = Investment::create(['user_id' => $u->id, 'name' => 'Ações', 'type' => 'acoes', 'rate_type' => 'variable', 'liquidity' => 'daily']);
        $inv->movements()->create(['type' => 'deposit', 'amount' => 2000, 'date' => '2026-09-10']);
        $inv->movements()->create(['type' => 'balance', 'amount' => 2300, 'date' => '2026-10-31']);

        $this->actingAs($u)->postJson("/api/investments/{$inv->id}/movements", ['type' => 'withdraw', 'amount' => 300, 'date' => '2026-11-02'])->assertCreated();
        $data = $this->actingAs($u)->postJson("/api/investments/{$inv->id}/movements", ['type' => 'balance', 'amount' => 2100, 'date' => '2026-11-04'])
            ->assertCreated()->json('data');

        $this->assertEquals(2100, $data['balance']);
        $this->assertEquals(1700, $data['invested']);   // 2000 - 300
        $this->assertEquals(400, $data['yield']);       // 2100 - 1700
        $this->assertEquals(100, $data['month_yield']); // 2300 - 300 = 2000 → 2100
        $this->assertFalse($data['is_estimated']);      // renda variável não é estimada
        $this->assertNull($data['daily_yield']);
    }

    public function test_deposit_and_withdraw_move_money_from_and_to_bank_account(): void
    {
        $u = $this->user();
        $nubank = \App\Models\Account::create(['user_id' => $u->id, 'name' => 'Nubank', 'type' => 'checking', 'initial_balance' => 3000]);
        $inv = Investment::create(['user_id' => $u->id, 'name' => 'Caixinha', 'institution' => 'Nubank', 'type' => 'caixinha', 'rate_type' => 'cdi', 'rate' => 100, 'liquidity' => 'daily']);
        $balanceOf = fn () => collect($this->actingAs($u)->getJson('/api/accounts')->json('data'))->firstWhere('id', $nubank->id)['balance'];

        // Aplicação: sai R$ 1.000 da conta e entra no investimento.
        $this->actingAs($u)->postJson("/api/investments/{$inv->id}/movements", ['type' => 'deposit', 'amount' => 1000, 'date' => today()->toDateString(), 'account_id' => $nubank->id])
            ->assertCreated()->assertJsonPath('data.balance', 1000);
        $this->assertEquals(2000, $balanceOf());

        // Resgate: volta R$ 300 para a conta.
        $this->actingAs($u)->postJson("/api/investments/{$inv->id}/movements", ['type' => 'withdraw', 'amount' => 300, 'date' => today()->toDateString(), 'account_id' => $nubank->id])
            ->assertCreated()->assertJsonPath('data.balance', 700);
        $this->assertEquals(2300, $balanceOf());

        // Aparecem nos lançamentos, mas não contam como receita/despesa.
        $tx = $this->actingAs($u)->getJson('/api/transactions?month='.today()->format('Y-m'))->assertOk();
        $this->assertEqualsCanonicalizing(['invest', 'redeem'], collect($tx->json('data'))->pluck('type')->all());
        $this->assertEquals(0, $tx->json('totals.expense'));
        $this->assertEquals(0, $tx->json('totals.income'));

        // Não dá para editar pela tela de lançamentos.
        $investTx = collect($tx->json('data'))->firstWhere('type', 'invest');
        $this->actingAs($u)->patchJson("/api/transactions/{$investTx['id']}/pay")->assertUnprocessable();

        // Excluir o lançamento desfaz a movimentação no investimento (e vice-versa).
        $this->actingAs($u)->deleteJson("/api/transactions/{$investTx['id']}")->assertOk();
        $this->assertEquals(3300, $balanceOf());
        $data = $this->actingAs($u)->getJson('/api/investments')->json('data.0');
        $this->assertEquals(0, $data['balance']); // sobrou só o resgate de 300 sobre 0

        // Extrato com totais.
        $this->actingAs($u)->getJson('/api/investment-movements')->assertOk()
            ->assertJsonPath('totals.withdrawals', 300)->assertJsonPath('totals.deposits', 0)->assertJsonCount(1, 'data');

        $movement = $this->actingAs($u)->getJson("/api/investments/{$inv->id}/movements")->json('data.0');
        $this->actingAs($u)->deleteJson("/api/investments/{$inv->id}/movements/{$movement['id']}")->assertOk();
        $this->assertEquals(3000, $balanceOf());
    }

    public function test_cannot_use_another_users_account(): void
    {
        $a = $this->user();
        $b = $this->user();
        $inv = Investment::create(['user_id' => $a->id, 'name' => 'X', 'type' => 'caixinha', 'rate_type' => 'cdi', 'rate' => 100, 'liquidity' => 'daily']);
        $foreign = \App\Models\Account::withoutGlobalScopes()->where('user_id', $b->id)->first();

        $this->actingAs($a)->postJson("/api/investments/{$inv->id}/movements", ['type' => 'deposit', 'amount' => 10, 'date' => today()->toDateString(), 'account_id' => $foreign->id])
            ->assertUnprocessable()->assertJsonValidationErrors('account_id');
    }

    public function test_dashboard_and_isolation(): void
    {
        $a = $this->user();
        $b = $this->user();
        $inv = Investment::create(['user_id' => $a->id, 'name' => 'Reserva', 'type' => 'caixinha', 'rate_type' => 'cdi', 'rate' => 100, 'liquidity' => 'daily']);
        $inv->movements()->create(['type' => 'deposit', 'amount' => 1000, 'date' => today()]);

        $this->actingAs($a)->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('investments.summary.balance', 1000)
            ->assertJsonPath('investments.items.0.name', 'Reserva')
            ->assertJsonCount(12, 'investments.evolution');

        $this->actingAs($b)->getJson('/api/investments')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($b)->postJson("/api/investments/{$inv->id}/movements", ['type' => 'deposit', 'amount' => 1, 'date' => today()->toDateString()])->assertNotFound();
        $this->actingAs($b)->deleteJson("/api/investments/{$inv->id}")->assertNotFound();
    }
}

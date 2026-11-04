<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\AuthController;
use App\Models\Investment;
use App\Models\User;
use App\Services\MarketRates;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GoalInvestmentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-04 10:00:00');
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

    private function setupUser(): array
    {
        $u = User::factory()->create();
        AuthController::bootstrapUser($u);
        // Saldos informados hoje = valores exatos, sem estimativa.
        $a = Investment::create(['user_id' => $u->id, 'name' => 'Caixinha Casa', 'institution' => 'Nubank', 'type' => 'caixinha', 'rate_type' => 'cdi', 'rate' => 100, 'liquidity' => 'daily']);
        $a->movements()->create(['type' => 'deposit', 'amount' => 3000, 'date' => today()]);
        $b = Investment::create(['user_id' => $u->id, 'name' => 'Turbo', 'institution' => 'Nubank', 'type' => 'caixinha', 'rate_type' => 'cdi', 'rate' => 115, 'liquidity' => 'daily']);
        $b->movements()->create(['type' => 'deposit', 'amount' => 2000, 'date' => today()]);

        return [$u, $a, $b];
    }

    public function test_linked_goal_uses_investment_balances(): void
    {
        [$u, $a, $b] = $this->setupUser();

        $goal = $this->actingAs($u)->postJson('/api/goals', [
            'name' => 'Morar sozinho', 'target_amount' => 10000, 'current_amount' => 999, 'investment_ids' => [$a->id, $b->id],
        ])->assertCreated()->json('data');

        $this->assertEquals(5000, $goal['current_amount']); // ignora o 999 do formulário
        $this->assertEquals(50, $goal['progress']);
        $this->assertCount(2, $goal['linked_investments']);

        // Investimento mostra a meta.
        $inv = collect($this->actingAs($u)->getJson('/api/investments')->json('data'))->firstWhere('id', $a->id);
        $this->assertSame('Morar sozinho', $inv['goal']['name']);

        // Depósito manual na meta é bloqueado (vem da caixinha).
        $this->actingAs($u)->postJson("/api/goals/{$goal['id']}/contribute", ['amount' => 100])->assertUnprocessable();

        // Aplicar na caixinha faz a meta subir; ao passar do objetivo, ela é concluída.
        $res = $this->actingAs($u)->postJson("/api/investments/{$b->id}/movements", ['type' => 'deposit', 'amount' => 5000, 'date' => today()->toDateString()])
            ->assertCreated()->assertJsonPath('goal_completed', 'Morar sozinho');
        $g = collect($this->actingAs($u)->getJson('/api/goals')->json('data'))->firstWhere('id', $goal['id']);
        $this->assertEquals(10000, $g['current_amount']);
        $this->assertNotNull($g['completed_at']);
        $this->assertContains('goal_reached', $u->notifications()->pluck('data')->pluck('kind')->all());
    }

    public function test_unlinking_and_dashboard(): void
    {
        [$u, $a] = $this->setupUser();
        $goal = $this->actingAs($u)->postJson('/api/goals', ['name' => 'Viagem', 'target_amount' => 6000, 'investment_ids' => [$a->id]])->json('data');

        $this->actingAs($u)->getJson('/api/dashboard')->assertOk()->assertJsonPath('goals.0.current_amount', 3000);

        // Desvincular: a caixinha perde a meta e a meta volta a aceitar depósito manual.
        $this->actingAs($u)->putJson("/api/goals/{$goal['id']}", ['name' => 'Viagem', 'target_amount' => 6000, 'investment_ids' => []])
            ->assertOk()->assertJsonCount(0, 'data.linked_investments');
        $this->assertNull($a->fresh()->goal_id);
        $this->actingAs($u)->postJson("/api/goals/{$goal['id']}/contribute", ['amount' => 100])->assertOk();
    }

    public function test_cannot_link_another_users_investment(): void
    {
        [$u] = $this->setupUser();
        [, $foreign] = $this->setupUser();

        $this->actingAs($u)->postJson('/api/goals', ['name' => 'X', 'target_amount' => 100, 'investment_ids' => [$foreign->id]])
            ->assertUnprocessable()->assertJsonValidationErrors('investment_ids.0');
    }
}

<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\AuthController;
use App\Models\Account;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FinanceApiTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(array $attrs = []): User
    {
        $user = User::factory()->create($attrs);
        AuthController::bootstrapUser($user);

        return $user;
    }

    private function accountOf(User $user): Account
    {
        return Account::withoutGlobalScopes()->where('user_id', $user->id)->first();
    }

    private function categoryOf(User $user, string $type = 'expense'): Category
    {
        return Category::withoutGlobalScopes()->where('user_id', $user->id)->where('type', $type)->first();
    }

    public function test_register_creates_default_structure_and_first_user_is_admin(): void
    {
        $res = $this->postJson('/api/auth/register', [
            'name' => 'Marlon', 'email' => 'm@example.com', 'password' => 'senha1234', 'password_confirmation' => 'senha1234',
        ])->assertCreated();

        $this->assertSame('admin', $res->json('user.role'));
        $user = User::first();
        $this->assertSame(16, Category::withoutGlobalScopes()->where('user_id', $user->id)->count());
        $this->assertSame(1, Account::withoutGlobalScopes()->where('user_id', $user->id)->count());
    }

    public function test_users_cannot_see_each_others_data(): void
    {
        $a = $this->makeUser();
        $b = $this->makeUser();
        $tx = Transaction::create([
            'user_id' => $b->id, 'account_id' => $this->accountOf($b)->id, 'type' => 'expense',
            'description' => 'Secreto', 'amount' => 10, 'date' => today(),
        ]);

        $this->actingAs($a)->getJson('/api/transactions')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($a)->getJson("/api/transactions/{$tx->id}")->assertNotFound();
        $this->actingAs($a)->deleteJson("/api/transactions/{$tx->id}")->assertNotFound();
        // Não pode lançar usando a conta de outro usuário.
        $this->actingAs($a)->postJson('/api/transactions', [
            'type' => 'expense', 'description' => 'x', 'amount' => 5, 'date' => today()->toDateString(),
            'account_id' => $this->accountOf($b)->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('account_id');
    }

    public function test_installments_split_total_and_balance_is_computed(): void
    {
        $u = $this->makeUser();
        $acc = $this->accountOf($u);

        $this->actingAs($u)->postJson('/api/transactions', [
            'type' => 'expense', 'description' => 'TV', 'amount' => 1000, 'date' => '2026-01-31',
            'account_id' => $acc->id, 'category_id' => $this->categoryOf($u)->id, 'installments' => 3, 'is_paid' => true,
        ])->assertCreated()->assertJsonPath('created', 3);

        $rows = Transaction::orderBy('installment_number')->get();
        $this->assertEquals([333.33, 333.33, 333.34], $rows->pluck('amount')->all());
        $this->assertEquals(['2026-01-31', '2026-02-28', '2026-03-31'], $rows->map(fn ($t) => $t->date->toDateString())->all());
        $this->assertEquals([true, false, false], $rows->pluck('is_paid')->all());

        $this->actingAs($u)->postJson('/api/transactions', [
            'type' => 'income', 'description' => 'Salário', 'amount' => 5000, 'date' => '2026-01-05', 'account_id' => $acc->id, 'is_paid' => true,
        ])->assertCreated();

        $res = $this->actingAs($u)->getJson('/api/accounts')->assertOk();
        $this->assertEquals(4666.67, $res->json('data.0.balance'));
        $this->assertEquals(4000.0, $res->json('data.0.projected_balance'));

        // Excluir parcelas futuras a partir da 2ª.
        $this->actingAs($u)->deleteJson("/api/transactions/{$rows[1]->id}?scope=future")->assertOk()->assertJsonPath('deleted', 2);
    }

    public function test_transfer_moves_money_between_accounts(): void
    {
        $u = $this->makeUser();
        $from = $this->accountOf($u);
        $to = Account::create(['user_id' => $u->id, 'name' => 'Banco', 'type' => 'checking']);

        $this->actingAs($u)->postJson('/api/transactions', [
            'type' => 'transfer', 'description' => 'Transf', 'amount' => 200, 'date' => today()->toDateString(),
            'account_id' => $from->id, 'transfer_account_id' => $to->id, 'is_paid' => true,
        ])->assertCreated();

        $data = collect($this->actingAs($u)->getJson('/api/accounts')->json('data'))->keyBy('id');
        $this->assertEquals(-200, $data[$from->id]['balance']);
        $this->assertEquals(200, $data[$to->id]['balance']);
    }

    public function test_filters_totals_bulk_and_export(): void
    {
        $u = $this->makeUser();
        $acc = $this->accountOf($u);
        $base = ['user_id' => $u->id, 'account_id' => $acc->id, 'type' => 'expense'];
        Transaction::create($base + ['description' => 'Mercado', 'amount' => 100, 'date' => '2026-03-10', 'is_paid' => true]);
        $late = Transaction::create($base + ['description' => 'Luz atrasada', 'amount' => 50, 'date' => today()->subDays(3)]);
        Transaction::create($base + ['description' => 'Mercado 2', 'amount' => 70, 'date' => today()->addDays(5)]);

        $this->actingAs($u)->getJson('/api/transactions?month=2026-03')
            ->assertJsonPath('totals.expense', 100)->assertJsonCount(1, 'data');
        $this->actingAs($u)->getJson('/api/transactions?search=mercado')->assertJsonCount(2, 'data');
        $this->actingAs($u)->getJson('/api/transactions?status=overdue')
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', 'overdue');

        $this->actingAs($u)->postJson('/api/transactions/bulk', ['ids' => [$late->id], 'action' => 'pay'])->assertJsonPath('affected', 1);
        $this->assertTrue($late->fresh()->is_paid);

        $csv = $this->actingAs($u)->get('/api/transactions/export?search=mercado')->assertOk()->streamedContent();
        $this->assertStringContainsString('Mercado 2', $csv);
        $this->assertStringNotContainsString('Luz', $csv);
    }

    public function test_dashboard_reports_budgets_and_alerts(): void
    {
        $u = $this->makeUser();
        $acc = $this->accountOf($u);
        $cat = $this->categoryOf($u);
        $month = today()->format('Y-m');

        $this->actingAs($u)->postJson('/api/budgets', ['category_id' => $cat->id, 'month' => $month, 'amount' => 100])->assertCreated();
        $this->actingAs($u)->postJson('/api/transactions', [
            'type' => 'expense', 'description' => 'Gasto', 'amount' => 120, 'date' => today()->toDateString(),
            'account_id' => $acc->id, 'category_id' => $cat->id,
        ])->assertCreated();

        $dash = $this->actingAs($u)->getJson("/api/dashboard?month={$month}")->assertOk();
        $this->assertEquals(120, $dash->json('summary.expense'));
        $this->assertEquals(120, $dash->json('budgets.0.spent'));
        $this->assertCount(12, $dash->json('evolution'));

        $this->actingAs($u)->getJson('/api/reports')->assertOk()->assertJsonPath('summary.expense', 120);

        $notes = $this->actingAs($u)->getJson('/api/notifications')->assertOk();
        $this->assertContains('budget_exceeded', collect($notes->json('data'))->pluck('kind')->all());
        // Não duplica o mesmo aviso.
        $this->actingAs($u)->postJson('/api/notifications/check')->assertOk();
        $this->assertSame(1, $u->notifications()->where('data->kind', 'budget_exceeded')->count());
    }

    public function test_recurring_generates_transactions(): void
    {
        $u = $this->makeUser();
        $res = $this->actingAs($u)->postJson('/api/recurring', [
            'type' => 'expense', 'description' => 'Aluguel', 'amount' => 1500, 'frequency' => 'monthly',
            'start_date' => today()->subMonths(2)->day(31 > today()->daysInMonth ? 1 : 5)->toDateString(),
            'account_id' => $this->accountOf($u)->id,
        ])->assertCreated();

        $this->assertGreaterThanOrEqual(4, $res->json('generated'));
        $this->assertSame($res->json('generated'), Transaction::whereNotNull('recurring_transaction_id')->count());
    }

    public function test_profile_saves_couple_fields(): void
    {
        $u = $this->makeUser();
        $base = ['name' => $u->name, 'email' => $u->email, 'currency' => 'BRL', 'alert_days_before' => 3];

        $this->actingAs($u)->putJson('/api/profile', $base + ['partner_name' => 'Natália', 'together_since' => '2024-02-14'])
            ->assertOk()->assertJsonPath('user.partner_name', 'Natália')->assertJsonPath('user.together_since', '2024-02-14');

        // Data no futuro não faz sentido para "juntos desde".
        $this->actingAs($u)->putJson('/api/profile', $base + ['together_since' => today()->addDay()->toDateString()])
            ->assertUnprocessable()->assertJsonValidationErrors('together_since');

        // Os campos são opcionais e podem ser limpos.
        $this->actingAs($u)->putJson('/api/profile', $base + ['partner_name' => null, 'together_since' => null])
            ->assertOk()->assertJsonPath('user.partner_name', null);
    }

    public function test_admin_routes_are_protected_and_inactive_users_are_blocked(): void
    {
        $admin = $this->makeUser(['role' => 'admin']);
        $user = $this->makeUser();

        $this->actingAs($user)->getJson('/api/admin/users')->assertForbidden();
        $this->actingAs($admin)->getJson('/api/admin/users')->assertOk()->assertJsonPath('stats.users', 2);
        $this->actingAs($admin)->putJson("/api/admin/users/{$user->id}", ['is_active' => false])->assertOk();

        $this->actingAs($user->fresh())->getJson('/api/dashboard')->assertForbidden();
    }
}

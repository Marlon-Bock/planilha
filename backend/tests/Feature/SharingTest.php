<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\AuthController;
use App\Models\Goal;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SharingTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $name): User
    {
        $user = User::factory()->create(['name' => $name]);
        AuthController::bootstrapUser($user);

        return $user;
    }

    public function test_task_goal_has_no_amount_and_is_toggled_by_hand(): void
    {
        $me = $this->user('Marlon');
        $id = $this->actingAs($me)->postJson('/api/goals', ['kind' => 'task', 'name' => 'Viajar para a praia'])
            ->assertCreated()
            ->assertJsonPath('data.kind', 'task')
            ->assertJsonPath('data.target_amount', 0)
            ->assertJsonPath('data.completed_at', null)
            ->assertJsonPath('data.is_owner', true)
            ->json('data.id');

        // Não vira "meta atingida" sozinha e não aceita depósito.
        $this->postJson('/api/notifications/check')->assertOk();
        $this->assertSame(0, $me->notifications()->count());
        $this->postJson("/api/goals/{$id}/contribute", ['amount' => 10])->assertStatus(422);

        $this->postJson("/api/goals/{$id}/toggle")->assertOk()->assertJsonPath('data.progress', 100);
        $this->assertNotNull(Goal::withoutGlobalScopes()->find($id)->completed_at);
        $this->postJson("/api/goals/{$id}/toggle")->assertOk()->assertJsonPath('data.completed_at', null);

        // Meta de dinheiro continua exigindo valor e não pode ser marcada na mão.
        $this->postJson('/api/goals', ['name' => 'Reserva'])->assertStatus(422)->assertJsonValidationErrors('target_amount');
        $money = $this->postJson('/api/goals', ['name' => 'Reserva', 'target_amount' => 1000])->assertCreated()->json('data.id');
        $this->postJson("/api/goals/{$money}/toggle")->assertStatus(422);
        $this->getJson('/api/goals')->assertJsonPath('summary.target', 1000);
    }

    public function test_shared_goal_is_visible_to_members_but_only_owner_changes_it(): void
    {
        $marlon = $this->user('Marlon');
        $natalia = $this->user('Natália');
        $outro = $this->user('Outro');

        $id = $this->actingAs($marlon)->postJson('/api/goals', ['name' => 'Casamento', 'target_amount' => 5000, 'member_ids' => [$natalia->id]])
            ->assertCreated()
            ->assertJsonPath('data.members.0.name', 'Natália')
            ->json('data.id');
        $task = $this->postJson('/api/goals', ['kind' => 'task', 'name' => 'Escolher o buffet', 'member_ids' => [$natalia->id]])->json('data.id');
        $this->postJson('/api/goals', ['name' => 'Só minha', 'target_amount' => 100])->assertCreated();
        // Não dá para se convidar nem convidar quem não existe.
        $this->postJson('/api/goals', ['name' => 'X', 'target_amount' => 1, 'member_ids' => [$marlon->id]])->assertStatus(422);

        // Natália vê as duas compartilhadas (e não a "Só minha"), com o nome de quem criou.
        $list = $this->actingAs($natalia)->getJson('/api/goals')->assertOk()->json('data');
        $this->assertEqualsCanonicalizing(['Casamento', 'Escolher o buffet'], array_column($list, 'name'));
        $this->assertFalse($list[0]['is_owner']);
        $this->assertSame('Marlon', $list[0]['user']['name']);
        $this->assertArrayNotHasKey('email', $list[0]['user']);

        // Participante não altera, não exclui, não deposita; mas marca a meta de fazer algo.
        $this->putJson("/api/goals/{$id}", ['name' => 'Hackeada', 'target_amount' => 1])->assertForbidden();
        $this->deleteJson("/api/goals/{$id}")->assertForbidden();
        $this->postJson("/api/goals/{$id}/contribute", ['amount' => 50])->assertForbidden();
        $this->postJson("/api/goals/{$task}/toggle")->assertOk()->assertJsonPath('data.progress', 100);

        // Quem não participa não vê nada.
        $this->actingAs($outro)->getJson('/api/goals')->assertJsonCount(0, 'data');
        $this->postJson("/api/goals/{$task}/toggle")->assertNotFound();

        // O dono tira a Natália: some da lista dela.
        $this->actingAs($marlon)->putJson("/api/goals/{$id}", ['name' => 'Casamento', 'target_amount' => 5000, 'member_ids' => []])->assertOk();
        $this->actingAs($natalia)->getJson('/api/goals')->assertJsonCount(1, 'data');
    }

    public function test_couple_goal_sums_the_boxes_of_both_people(): void
    {
        // Taxas fixas: o teste não consulta o Banco Central.
        $this->instance(\App\Services\MarketRates::class, new class extends \App\Services\MarketRates {
            public function all(): array
            {
                return ['cdi' => 13.65, 'selic' => 13.75, 'ipca' => 4.5, 'date' => today()->toDateString(), 'source' => 'test'];
            }
        });
        $marlon = $this->user('Marlon');
        $natalia = $this->user('Natália');
        $outro = $this->user('Outro');
        $box = function (User $owner, string $name, float $amount) {
            $inv = \App\Models\Investment::withoutGlobalScopes()->create(['user_id' => $owner->id, 'name' => $name, 'institution' => 'Nubank', 'type' => 'caixinha', 'rate_type' => 'cdi', 'rate' => 100, 'liquidity' => 'daily']);
            $inv->movements()->create(['type' => 'deposit', 'amount' => $amount, 'date' => today()]);

            return $inv;
        };
        $dele = $box($marlon, 'Caixinha do Marlon', 3000);
        $dela = $box($natalia, 'Caixinha da Natália', 2000);
        $alheia = $box($outro, 'Caixinha alheia', 999);

        // Marlon cria "Morar juntos" com a caixinha dele e convida a Natália.
        $id = $this->actingAs($marlon)->postJson('/api/goals', ['name' => 'Morar juntos', 'target_amount' => 40000, 'investment_ids' => [$dele->id], 'member_ids' => [$natalia->id]])
            ->assertCreated()->assertJsonPath('data.current_amount', 3000)->json('data.id');

        // Natália liga a caixinha dela: o guardado vira a soma. Não consegue ligar a de outra pessoa.
        $this->actingAs($natalia)->putJson("/api/goals/{$id}/investments", ['investment_ids' => [$dele->id]])->assertStatus(422);
        $res = $this->putJson("/api/goals/{$id}/investments", ['investment_ids' => [$dela->id]])->assertOk()
            ->assertJsonPath('data.current_amount', 5000)
            ->assertJsonCount(2, 'data.linked_investments');
        $mine = collect($res->json('data.linked_investments'))->firstWhere('mine', true);
        $this->assertSame('Caixinha da Natália', $mine['name']);
        $this->assertSame(3000, Goal::withoutGlobalScopes()->find($id)->investments()->withoutGlobalScopes()->where('user_id', $marlon->id)->count() * 3000);

        // Os dois veem o mesmo total, cada um com a sua marcada como "minha".
        $forMarlon = $this->actingAs($marlon)->getJson('/api/goals')->assertJsonPath('data.0.current_amount', 5000)->json('data.0.linked_investments');
        $this->assertSame('Natália', collect($forMarlon)->firstWhere('mine', false)['owner']);
        // Com caixinha de qualquer um dos dois, não há depósito manual.
        $this->postJson("/api/goals/{$id}/contribute", ['amount' => 10])->assertStatus(422);

        // Quem não participa não liga caixinha na meta dos outros.
        $this->actingAs($outro)->putJson("/api/goals/{$id}/investments", ['investment_ids' => [$alheia->id]])->assertNotFound();

        // Marlon edita a meta sem mexer nas caixinhas dele: a da Natália continua.
        $this->actingAs($marlon)->putJson("/api/goals/{$id}", ['name' => 'Morar juntos', 'target_amount' => 40000, 'investment_ids' => [$dele->id], 'member_ids' => [$natalia->id]])
            ->assertOk()->assertJsonPath('data.current_amount', 5000);

        // Natália tira a caixinha dela; depois sai da meta e a caixinha dela vai junto.
        $this->actingAs($natalia)->putJson("/api/goals/{$id}/investments", ['investment_ids' => []])->assertOk()->assertJsonPath('data.current_amount', 3000);
        $this->putJson("/api/goals/{$id}/investments", ['investment_ids' => [$dela->id]])->assertOk();
        $this->actingAs($marlon)->putJson("/api/goals/{$id}", ['name' => 'Morar juntos', 'target_amount' => 40000, 'member_ids' => []])
            ->assertOk()->assertJsonPath('data.current_amount', 3000);
        $this->assertNull($dela->fresh()->goal_id);
    }

    public function test_view_as_requires_permission_and_is_read_only(): void
    {
        $marlon = $this->user('Marlon');
        $natalia = $this->user('Natália');
        $as = ['X-View-As' => (string) $marlon->id];

        $accountId = $this->actingAs($marlon)->getJson('/api/accounts')->json('data.0.id');
        $this->postJson('/api/transactions', ['type' => 'expense', 'description' => 'Mercado do Marlon', 'amount' => 80, 'date' => today()->toDateString(), 'account_id' => $accountId])
            ->assertCreated();

        // Sem permissão: recusado, com o aviso para o app sair do modo de visualização.
        $this->actingAs($natalia)->getJson('/api/transactions', $as)->assertForbidden()->assertJsonPath('view_denied', true);

        // Marlon libera a Natália.
        $this->actingAs($marlon)->getJson('/api/sharing')->assertJsonPath('users.0.name', 'Natália')->assertJsonCount(0, 'viewer_ids');
        $this->putJson('/api/sharing', ['viewer_ids' => [$natalia->id]])->assertOk()->assertJsonPath('viewer_ids.0', $natalia->id);
        $this->putJson('/api/sharing', ['viewer_ids' => [$marlon->id]])->assertStatus(422);

        // Natália vê os dados dele; sem o cabeçalho continua vendo só os dela.
        $this->actingAs($natalia)->getJson('/api/sharing')->assertJsonPath('can_view.0.name', 'Marlon');
        // (No teste o usuário trocado fica preso entre as chamadas; no servidor cada requisição começa do zero.)
        $this->getJson('/api/transactions', $as)->assertOk()->assertJsonPath('data.0.description', 'Mercado do Marlon');
        $this->actingAs($natalia)->getJson('/api/dashboard', $as)->assertOk();
        $this->actingAs($natalia)->getJson('/api/transactions')->assertOk()->assertJsonCount(0, 'data');

        // Somente leitura: nada de criar, editar ou excluir como ele.
        $this->actingAs($natalia)->postJson('/api/transactions', ['type' => 'expense', 'description' => 'Invasão', 'amount' => 1, 'date' => today()->toDateString(), 'account_id' => $accountId], $as)
            ->assertForbidden();
        $this->actingAs($natalia)->deleteJson("/api/accounts/{$accountId}", [], $as)->assertForbidden();
        $this->assertSame(1, \App\Models\Transaction::withoutGlobalScopes()->count());

        // Fora das telas financeiras o cabeçalho é ignorado: "eu" continuo sendo eu.
        $this->actingAs($natalia)->getJson('/api/auth/me', $as)->assertJsonPath('user.name', 'Natália');

        // A permissão é de mão única e pode ser retirada.
        $this->actingAs($marlon)->getJson('/api/transactions', ['X-View-As' => (string) $natalia->id])->assertForbidden();
        $this->putJson('/api/sharing', ['viewer_ids' => []])->assertOk();
        $this->actingAs($natalia)->getJson('/api/transactions', $as)->assertForbidden();
    }
}

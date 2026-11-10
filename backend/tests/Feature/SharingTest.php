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

<?php

namespace Tests\Feature;

use App\Models\PushSubscription;
use App\Models\User;
use App\Notifications\Channels\WebPushChannel;
use App\Notifications\FinanceAlert;
use App\Services\AlertService;
use App\Services\WebPushService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PushNotificationTest extends TestCase
{
    use RefreshDatabase;

    /** Serviço falso: registra o que seria enviado, sem falar com o Google/Apple. */
    private function fakePush(): object
    {
        $fake = new class extends WebPushService {
            public array $sent = [];

            public function isConfigured(): bool
            {
                return true;
            }

            public function sendToUser(User $user, array $payload): int
            {
                $count = PushSubscription::withoutGlobalScopes()->where('user_id', $user->id)->count();
                if ($count) {
                    $this->sent[] = ['user' => $user->id, ...$payload];
                }

                return $count;
            }
        };
        $this->instance(WebPushService::class, $fake);

        return $fake;
    }

    private function subscription(string $endpoint = 'https://fcm.googleapis.com/fcm/send/abc123'): array
    {
        return ['endpoint' => $endpoint, 'keys' => ['p256dh' => str_repeat('B', 87), 'auth' => str_repeat('a', 22)], 'device' => 'Chrome no Android'];
    }

    public function test_subscribe_list_and_unsubscribe(): void
    {
        $u = User::factory()->create();

        $this->actingAs($u)->postJson('/api/push/subscribe', $this->subscription())->assertCreated();
        // Repetir a inscrição do mesmo aparelho não duplica.
        $this->actingAs($u)->postJson('/api/push/subscribe', $this->subscription())->assertCreated();
        $this->assertSame(1, PushSubscription::count());

        $this->actingAs($u)->getJson('/api/push')->assertOk()
            ->assertJsonPath('devices.0.device', 'Chrome no Android')
            ->assertJsonMissingPath('devices.0.endpoint'); // dados sensíveis da inscrição não vazam

        $this->actingAs($u)->deleteJson('/api/push/subscribe', ['endpoint' => $this->subscription()['endpoint']])->assertJsonPath('deleted', 1);
        $this->assertSame(0, PushSubscription::count());
    }

    public function test_rejects_non_https_endpoints(): void
    {
        $u = User::factory()->create();
        $this->actingAs($u)->postJson('/api/push/subscribe', $this->subscription('http://evil.local/x'))->assertUnprocessable();
    }

    public function test_users_only_manage_their_own_devices(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create();
        $this->actingAs($a)->postJson('/api/push/subscribe', $this->subscription())->assertCreated();
        $id = PushSubscription::first()->id;

        $this->actingAs($b)->getJson('/api/push')->assertJsonCount(0, 'devices');
        $this->actingAs($b)->deleteJson('/api/push/subscribe', ['id' => $id])->assertJsonPath('deleted', 0);
        $this->assertSame(1, PushSubscription::withoutGlobalScopes()->count()); // o aparelho da A continua lá
    }

    public function test_alerts_go_to_push_only_for_subscribed_users(): void
    {
        $fake = $this->fakePush();
        $with = User::factory()->create();
        $without = User::factory()->create();
        $this->actingAs($with)->postJson('/api/push/subscribe', $this->subscription())->assertCreated();

        $alert = new FinanceAlert('k1', 'bill_due', 'warning', 'Conta a vencer', 'Aluguel vence amanhã', '/transacoes?status=pending');
        $this->assertContains(WebPushChannel::class, $alert->via($with));
        $this->assertNotContains(WebPushChannel::class, $alert->via($without));

        app(AlertService::class)->notifyOnce($with, 'k1', 'bill_due', 'warning', 'Conta a vencer', 'Aluguel vence amanhã', '/transacoes?status=pending');
        app(AlertService::class)->notifyOnce($without, 'k1', 'bill_due', 'warning', 'Conta a vencer', 'Aluguel vence amanhã');

        $this->assertCount(1, $fake->sent);
        $this->assertSame('Conta a vencer', $fake->sent[0]['title']);
        $this->assertSame('/avisos', $fake->sent[0]['url']); // sempre URL limpa
        $this->assertSame(1, $without->notifications()->count()); // o aviso no sistema continua existindo
    }

    public function test_test_endpoint(): void
    {
        $this->fakePush();
        $u = User::factory()->create();
        $this->actingAs($u)->postJson('/api/push/test')->assertStatus(422); // nenhum aparelho ainda
        $this->actingAs($u)->postJson('/api/push/subscribe', $this->subscription())->assertCreated();
        $this->actingAs($u)->postJson('/api/push/test')->assertOk()->assertJsonPath('sent', 1);
    }
}

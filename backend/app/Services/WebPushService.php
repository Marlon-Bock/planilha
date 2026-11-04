<?php

namespace App\Services;

use App\Models\PushSubscription;
use App\Models\User;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Throwable;

/**
 * Envia notificações Web Push (aparecem no celular/PC mesmo com o app fechado).
 * Inscrições que o navegador invalidou (404/410) são removidas automaticamente.
 */
class WebPushService
{
    public function isConfigured(): bool
    {
        return (bool) config('services.webpush.public_key') && (bool) config('services.webpush.private_key');
    }

    /**
     * @param  array{title: string, body: string, url?: string, tag?: string}  $payload
     * @return int quantos dispositivos receberam
     */
    public function sendToUser(User $user, array $payload): int
    {
        if (! $this->isConfigured()) {
            return 0;
        }
        $subs = PushSubscription::withoutGlobalScopes()->where('user_id', $user->id)->get();
        if ($subs->isEmpty()) {
            return 0;
        }

        try {
            $webPush = new WebPush([
                'VAPID' => [
                    'subject' => config('services.webpush.subject'),
                    'publicKey' => config('services.webpush.public_key'),
                    'privateKey' => config('services.webpush.private_key'),
                ],
            ], ['TTL' => 60 * 60 * 24, 'urgency' => 'normal', 'topic' => substr(preg_replace('/[^A-Za-z0-9_-]/', '', $payload['tag'] ?? 'aviso'), 0, 32) ?: null]);

            $body = json_encode([
                'title' => $payload['title'],
                'body' => $payload['body'],
                'url' => $payload['url'] ?? '/avisos',
                'tag' => $payload['tag'] ?? null,
            ], JSON_UNESCAPED_UNICODE);

            foreach ($subs as $sub) {
                $webPush->queueNotification(Subscription::create([
                    'endpoint' => $sub->endpoint,
                    'publicKey' => $sub->public_key,
                    'authToken' => $sub->auth_token,
                    'contentEncoding' => $sub->content_encoding,
                ]), $body);
            }

            $delivered = 0;
            foreach ($webPush->flush() as $report) {
                $sub = $subs->firstWhere('endpoint', $report->getEndpoint());
                if ($report->isSuccess()) {
                    $delivered++;
                    $sub?->forceFill(['last_used_at' => now()])->saveQuietly();
                } elseif ($report->isSubscriptionExpired()) {
                    $sub?->delete(); // celular desinstalou o app / revogou a permissão
                } else {
                    logger()->warning('Web Push falhou', ['reason' => $report->getReason()]);
                }
            }

            return $delivered;
        } catch (Throwable $e) {
            // Falha no push nunca pode quebrar a criação do aviso.
            report($e);

            return 0;
        }
    }
}

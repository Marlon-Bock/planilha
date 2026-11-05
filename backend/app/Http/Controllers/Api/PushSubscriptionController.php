<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use App\Services\WebPushService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PushSubscriptionController extends Controller
{
    /** Chave pública VAPID (o navegador precisa dela para se inscrever) e aparelhos ativos. */
    public function index(WebPushService $push): JsonResponse
    {
        return response()->json([
            'public_key' => config('services.webpush.public_key'),
            'enabled' => $push->isConfigured(),
            'devices' => PushSubscription::orderByDesc('updated_at')->get(['id', 'device', 'last_used_at', 'created_at']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'endpoint' => ['required', 'url', 'max:2000', 'starts_with:https://'],
            'keys.p256dh' => ['required', 'string', 'max:255'],
            'keys.auth' => ['required', 'string', 'max:255'],
            'content_encoding' => ['nullable', 'in:aes128gcm,aesgcm'],
            'device' => ['nullable', 'string', 'max:120'],
        ]);

        $hash = PushSubscription::hashEndpoint($data['endpoint']);
        // O mesmo navegador pode ter sido de outro usuário (logout/login): passa a ser deste.
        $sub = PushSubscription::withoutGlobalScopes()->updateOrCreate(['endpoint_hash' => $hash], [
            'user_id' => $request->user()->id,
            'endpoint' => $data['endpoint'],
            'public_key' => $data['keys']['p256dh'],
            'auth_token' => $data['keys']['auth'],
            'content_encoding' => $data['content_encoding'] ?? 'aes128gcm',
            'device' => $data['device'] ?? null,
        ]);

        return response()->json(['data' => $sub->only(['id', 'device'])], 201);
    }

    public function destroy(Request $request): JsonResponse
    {
        $request->validate(['endpoint' => ['nullable', 'string'], 'id' => ['nullable', 'integer']]);
        $deleted = PushSubscription::query()
            ->when($request->filled('endpoint'), fn ($q) => $q->where('endpoint_hash', PushSubscription::hashEndpoint($request->input('endpoint'))))
            ->when($request->filled('id'), fn ($q) => $q->whereKey($request->integer('id')))
            ->when(! $request->filled('endpoint') && ! $request->filled('id'), fn ($q) => $q->whereRaw('1 = 0'))
            ->delete();

        return response()->json(['deleted' => $deleted]);
    }

    /** Manda uma notificação de teste para todos os aparelhos do usuário. */
    public function test(Request $request, WebPushService $push): JsonResponse
    {
        if (! $push->isConfigured()) {
            return response()->json(['message' => __('O servidor ainda não tem as chaves de notificação (VAPID) configuradas.'), 'sent' => 0], 422);
        }
        if (! PushSubscription::query()->exists()) {
            return response()->json(['message' => __('Nenhum aparelho com notificações ativas. Toque em "Ativar notificações" primeiro.'), 'sent' => 0], 422);
        }

        $name = strtok($request->user()->name, ' ');
        $sent = $push->sendToUser($request->user(), [
            'title' => 'Notificações ativadas 💕',
            'body' => "Oi, {$name}! É assim que vão chegar os avisos de contas, metas e orçamentos.",
            'url' => '/avisos',
            'tag' => 'teste',
        ]);

        return $sent
            ? response()->json(['sent' => $sent])
            : response()->json(['message' => __('Não foi possível entregar a notificação. Desative e ative de novo as notificações neste aparelho.'), 'sent' => 0], 422);
    }
}

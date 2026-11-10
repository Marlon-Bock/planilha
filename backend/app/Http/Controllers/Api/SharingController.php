<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Quem pode ver as minhas finanças (somente visualização) e as de quem eu posso ver. */
class SharingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json($this->payload($request->user()));
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'viewer_ids' => ['present', 'array'],
            'viewer_ids.*' => ['integer', Rule::notIn([$user->id]), Rule::exists('users', 'id')->where('is_active', true)],
        ]);
        $user->viewers()->sync(array_unique($data['viewer_ids']));

        return response()->json($this->payload($user));
    }

    private function payload(User $user): array
    {
        $people = fn ($query) => $query->orderBy('name')->get(['users.id', 'users.name'])
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name])->values();

        return [
            // Outras pessoas do sistema (para escolher em "quem pode ver" e nas metas de casal).
            'users' => $people(User::where('is_active', true)->whereKeyNot($user->id)),
            'viewer_ids' => $user->viewers()->pluck('users.id')->values(),
            'can_view' => $people($user->viewables()->where('is_active', true)),
        ];
    }
}

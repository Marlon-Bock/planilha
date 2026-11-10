<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Cachorrinho de estimação do usuário (mora na tela do app). */
class PetController extends Controller
{
    public const COLORS = ['caramel', 'white', 'choco'];

    private const DEFAULTS = ['name' => null, 'color' => 'caramel', 'collar' => '#ec4899', 'wander' => true, 'fed_at' => null, 'love' => 0];

    private function save(User $user, array $changes): JsonResponse
    {
        $user->forceFill(['pet' => array_merge(self::DEFAULTS, $user->pet ?? [], $changes)])->save();

        return response()->json(['user' => $user->fresh()]);
    }

    /** Nome, cor do pelo, coleira (cor ou sem coleira) e se passeia sozinho. */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:20'],
            'color' => ['required', Rule::in(self::COLORS)],
            'collar' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'wander' => ['required', 'boolean'],
        ]);

        return $this->save($request->user(), $data);
    }

    public function feed(Request $request): JsonResponse
    {
        return $this->save($request->user(), ['fed_at' => now()->toIso8601String()]);
    }

    /** Carinhos: o app junta alguns toques e manda de uma vez. */
    public function love(Request $request): JsonResponse
    {
        $data = $request->validate(['count' => ['required', 'integer', 'between:1,50']]);
        $user = $request->user();

        return $this->save($user, ['love' => (int) ($user->pet['love'] ?? 0) + $data['count']]);
    }
}

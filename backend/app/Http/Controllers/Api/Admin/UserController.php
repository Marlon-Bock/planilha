<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $page = User::query()
            ->when($request->filled('search'), fn ($q) => $q->where(fn ($w) => $w
                ->where('name', 'like', '%'.$request->input('search').'%')
                ->orWhere('email', 'like', '%'.$request->input('search').'%')))
            ->when($request->filled('role'), fn ($q) => $q->where('role', $request->input('role')))
            ->when($request->filled('active'), fn ($q) => $q->where('is_active', $request->boolean('active')))
            ->withCount(['transactions' => fn ($q) => $q->withoutGlobalScopes()])
            ->latest()
            ->paginate(20);

        return response()->json([
            'data' => $page->items(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
            'stats' => [
                'users' => User::count(),
                'active' => User::where('is_active', true)->count(),
                'admins' => User::where('role', User::ROLE_ADMIN)->count(),
                'new_this_month' => User::where('created_at', '>=', now()->startOfMonth())->count(),
                'active_last_7_days' => User::where('last_login_at', '>=', now()->subDays(7))->count(),
                'transactions' => Transaction::withoutGlobalScopes()->count(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', Password::min(8)],
            'role' => ['required', Rule::in([User::ROLE_ADMIN, User::ROLE_USER])],
        ]);

        $user = DB::transaction(function () use ($data) {
            $user = User::create($data);
            AuthController::bootstrapUser($user);

            return $user;
        });

        return response()->json(['data' => $user], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'role' => ['sometimes', Rule::in([User::ROLE_ADMIN, User::ROLE_USER])],
            'is_active' => ['sometimes', 'boolean'],
            'password' => ['sometimes', 'nullable', Password::min(8)],
        ]);

        if ($user->is($request->user()) && (($data['role'] ?? 'admin') !== 'admin' || ($data['is_active'] ?? true) === false)) {
            return response()->json(['message' => 'Você não pode remover seu próprio acesso de administrador.'], 422);
        }
        if (empty($data['password'])) {
            unset($data['password']);
        }

        $user->update($data);
        if (($data['is_active'] ?? true) === false) {
            DB::table('sessions')->where('user_id', $user->id)->delete();
        }

        return response()->json(['data' => $user]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->is($request->user())) {
            return response()->json(['message' => 'Você não pode excluir a si mesmo.'], 422);
        }
        $user->delete();

        return response()->json(null, 204);
    }
}

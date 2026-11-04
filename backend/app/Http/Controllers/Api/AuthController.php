<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Category;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:180', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);

        $user = DB::transaction(function () use ($data) {
            // O primeiro usuário do sistema vira administrador.
            $role = User::query()->exists() ? User::ROLE_USER : User::ROLE_ADMIN;
            $user = User::create([...$data, 'role' => $role, 'last_login_at' => now()]);
            self::bootstrapUser($user);

            return $user;
        });

        Auth::guard('web')->login($user);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        return response()->json(['user' => $user], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::guard('web')->attempt($credentials, $request->boolean('remember'))) {
            throw ValidationException::withMessages(['email' => 'E-mail ou senha inválidos.']);
        }

        $user = Auth::guard('web')->user();
        if (! $user->is_active) {
            Auth::guard('web')->logout();
            throw ValidationException::withMessages(['email' => 'Sua conta está desativada. Fale com o administrador.']);
        }

        if ($request->hasSession()) {
            $request->session()->regenerate();
        }
        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json(['user' => $user]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['message' => 'Sessão encerrada.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $request->user()]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:180', 'unique:users,email,'.$user->id],
            'currency' => ['required', 'string', 'size:3'],
            'alert_days_before' => ['required', 'integer', 'between:0,30'],
            'partner_name' => ['nullable', 'string', 'max:80'],
            'together_since' => ['nullable', 'date', 'before_or_equal:today'],
        ]);
        $user->update($data);

        return response()->json(['user' => $user]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);
        $request->user()->update(['password' => Hash::make($request->input('password'))]);

        return response()->json(['message' => 'Senha alterada.']);
    }

    public function destroyAccount(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'current_password']]);
        $user = $request->user();
        Auth::guard('web')->logout();
        $user->delete();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['message' => 'Conta excluída.']);
    }

    /** Cria a estrutura inicial (categorias padrão + carteira) de um usuário novo. */
    public static function bootstrapUser(User $user): void
    {
        foreach (Category::defaults() as $cat) {
            Category::withoutGlobalScopes()->create([...$cat, 'user_id' => $user->id]);
        }
        Account::withoutGlobalScopes()->create([
            'user_id' => $user->id, 'name' => 'Carteira', 'type' => 'cash', 'color' => '#10b981',
        ]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AccountController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $accounts = Account::query()->withBalance()
            ->when(! $request->boolean('with_archived'), fn ($q) => $q->where('is_archived', false))
            ->orderBy('is_archived')->orderBy('name')
            ->get()
            ->map(fn (Account $a) => $this->present($a));

        $active = $accounts->where('is_archived', false)->where('include_in_total', true);

        return response()->json([
            'data' => $accounts->values(),
            'summary' => [
                'total_balance' => round($active->where('type', '!=', 'credit_card')->sum('balance'), 2),
                'projected_balance' => round($active->where('type', '!=', 'credit_card')->sum('projected_balance'), 2),
                'credit_card_debt' => round(abs($active->where('type', 'credit_card')->sum('balance')), 2),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $account = Account::create($this->validated($request));

        return response()->json(['data' => $account], 201);
    }

    public function show(Account $account): JsonResponse
    {
        $account = Account::withBalance()->findOrFail($account->id);

        return response()->json(['data' => $this->present($account)]);
    }

    public function update(Request $request, Account $account): JsonResponse
    {
        $account->update($this->validated($request));

        return response()->json(['data' => $account]);
    }

    public function destroy(Account $account): JsonResponse
    {
        if (Transaction::where('account_id', $account->id)->orWhere('transfer_account_id', $account->id)->exists()) {
            return response()->json([
                'message' => __('Esta conta possui lançamentos. Arquive-a em vez de excluir, ou exclua os lançamentos antes.'),
            ], 422);
        }
        $account->delete();

        return response()->json(null, 204);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'type' => ['required', Rule::in(Account::TYPES)],
            'initial_balance' => ['nullable', 'numeric', 'between:-999999999,999999999'],
            'credit_limit' => ['nullable', 'numeric', 'min:0'],
            'closing_day' => ['nullable', 'integer', 'between:1,31'],
            'due_day' => ['nullable', 'integer', 'between:1,31'],
            'color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'include_in_total' => ['boolean'],
            'is_archived' => ['boolean'],
        ]) + ['initial_balance' => 0];
    }

    private function present(Account $a): array
    {
        $data = $a->only(['id', 'name', 'type', 'initial_balance', 'credit_limit', 'closing_day', 'due_day', 'color', 'include_in_total', 'is_archived']);
        $data['balance'] = $a->balance;
        $data['projected_balance'] = $a->projected_balance;
        if ($a->type === 'credit_card' && $a->credit_limit) {
            $used = max(0, -$a->projected_balance);
            $data['credit_used'] = round($used, 2);
            $data['credit_available'] = round($a->credit_limit - $used, 2);
        }

        return $data;
    }
}

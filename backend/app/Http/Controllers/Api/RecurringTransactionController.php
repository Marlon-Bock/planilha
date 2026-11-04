<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RecurringTransaction;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RecurringTransactionController extends Controller
{
    public function index(): JsonResponse
    {
        $items = RecurringTransaction::with(['account:id,name,color', 'category:id,name,color,icon'])
            ->withCount('transactions')
            ->orderByDesc('is_active')->orderBy('next_date')
            ->get();

        $monthlyFactor = ['weekly' => 52 / 12, 'monthly' => 1, 'yearly' => 1 / 12];
        $active = $items->where('is_active', true);
        $sum = fn ($type) => round($active->where('type', $type)->sum(fn ($r) => $r->amount * $monthlyFactor[$r->frequency]), 2);

        return response()->json([
            'data' => $items,
            'summary' => ['monthly_income' => $sum('income'), 'monthly_expense' => $sum('expense')],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['next_date'] = $data['start_date'];
        $recurring = RecurringTransaction::create($data);
        // Já gera os lançamentos até o fim do próximo mês para aparecerem como contas a pagar.
        $created = $recurring->generateUntil(self::horizon());

        return response()->json(['data' => $recurring->fresh(), 'generated' => $created], 201);
    }

    public function update(Request $request, RecurringTransaction $recurring): JsonResponse
    {
        $data = $this->validated($request);
        $recurring->update($data);

        // Atualiza os lançamentos futuros ainda não pagos.
        if ($request->boolean('update_pending', true)) {
            Transaction::where('recurring_transaction_id', $recurring->id)
                ->where('is_paid', false)->where('date', '>=', today()->toDateString())
                ->update(collect($data)->only(['account_id', 'category_id', 'description', 'amount', 'payment_method'])->all());
        }

        return response()->json(['data' => $recurring->fresh()]);
    }

    public function destroy(Request $request, RecurringTransaction $recurring): JsonResponse
    {
        if ($request->boolean('delete_pending')) {
            Transaction::where('recurring_transaction_id', $recurring->id)
                ->where('is_paid', false)->where('date', '>=', today()->toDateString())->delete();
        }
        $recurring->delete();

        return response()->json(null, 204);
    }

    public function generate(Request $request): JsonResponse
    {
        $until = $request->filled('until') ? Carbon::parse($request->input('until')) : self::horizon();
        $total = RecurringTransaction::where('is_active', true)->get()->sum(fn ($r) => $r->generateUntil($until));

        return response()->json(['generated' => $total]);
    }

    public static function horizon(): Carbon
    {
        return today()->addMonthNoOverflow()->endOfMonth();
    }

    private function validated(Request $request): array
    {
        $uid = $request->user()->id;

        return $request->validate([
            'type' => ['required', Rule::in(['income', 'expense'])],
            'description' => ['required', 'string', 'max:160'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'frequency' => ['required', Rule::in(RecurringTransaction::FREQUENCIES)],
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'account_id' => ['required', Rule::exists('accounts', 'id')->where('user_id', $uid)],
            'category_id' => ['nullable', Rule::exists('categories', 'id')->where('user_id', $uid)],
            'payment_method' => ['nullable', Rule::in(Transaction::PAYMENT_METHODS)],
            'auto_paid' => ['boolean'],
            'is_active' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'account_ids' => ['nullable', 'array'],
        ]);

        $from = $request->filled('from') ? Carbon::parse($request->input('from'))->startOfDay() : now()->startOfYear();
        $to = $request->filled('to') ? Carbon::parse($request->input('to'))->endOfDay() : now()->endOfMonth();
        $accountIds = array_filter(array_map('intval', (array) $request->input('account_ids', [])));

        $base = fn () => Transaction::query()
            ->whereBetween('transactions.date', [$from->toDateString(), $to->toDateString()])
            ->when($accountIds, fn ($q) => $q->whereIn('transactions.account_id', $accountIds));

        $income = round((float) $base()->where('type', 'income')->sum('amount'), 2);
        $expense = round((float) $base()->where('type', 'expense')->sum('amount'), 2);
        $days = max(1, $from->diffInDays($to) + 1);
        $months = max(1, round($days / 30.44, 1));

        $group = fn (string $column, string $labelExpr, ?string $join = null) => $base()
            ->where('transactions.type', 'expense')
            ->when($join, fn ($q) => $q->leftJoin(...explode('|', $join)))
            ->selectRaw("{$labelExpr} as label, SUM(transactions.amount) as total, COUNT(*) as count")
            ->groupBy(array_unique([$column, $labelExpr]))->orderByDesc('total')->get()
            ->map(fn ($r) => ['label' => $r->label ?? 'Não informado', 'total' => round((float) $r->total, 2), 'count' => (int) $r->count,
                'percent' => $expense > 0 ? round($r->total / $expense * 100, 1) : 0]);

        $byTag = DB::table('tag_transaction')
            ->join('tags', 'tags.id', '=', 'tag_transaction.tag_id')
            ->joinSub($base()->where('transactions.type', 'expense')->select('transactions.id', 'transactions.amount'), 't', 't.id', '=', 'tag_transaction.transaction_id')
            ->selectRaw('tags.name as label, tags.color as color, SUM(t.amount) as total, COUNT(*) as count')
            ->groupBy('tags.id', 'tags.name', 'tags.color')->orderByDesc('total')->get()
            ->map(fn ($r) => ['label' => $r->label, 'color' => $r->color, 'total' => round((float) $r->total, 2), 'count' => (int) $r->count]);

        return response()->json([
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'days' => $days],
            'summary' => [
                'income' => $income,
                'expense' => $expense,
                'balance' => round($income - $expense, 2),
                'avg_daily_expense' => round($expense / $days, 2),
                'avg_monthly_expense' => round($expense / $months, 2),
                'avg_monthly_income' => round($income / $months, 2),
                'savings_rate' => $income > 0 ? round(($income - $expense) / $income * 100, 1) : null,
                'transactions' => $base()->count(),
            ],
            'expenses_by_category' => DashboardController::byCategory('expense', $from, $to),
            'income_by_category' => DashboardController::byCategory('income', $from, $to),
            'evolution' => DashboardController::evolution($from, $to),
            'by_account' => $group('transactions.account_id', 'accounts.name', 'accounts|accounts.id|=|transactions.account_id'),
            'by_payment_method' => $group('transactions.payment_method', 'transactions.payment_method'),
            'by_tag' => $byTag,
            'top_expenses' => $base()->with(['category:id,name,color', 'account:id,name'])
                ->where('type', 'expense')->orderByDesc('amount')->limit(10)->get(),
        ]);
    }
}

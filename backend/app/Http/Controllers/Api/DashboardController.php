<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Goal;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $request->validate(['month' => ['nullable', 'date_format:Y-m']]);
        $month = $request->input('month', now()->format('Y-m'));
        $start = Carbon::createFromFormat('Y-m-d', $month.'-01')->startOfDay();
        $end = $start->copy()->endOfMonth();
        $prevMonth = $start->copy()->subMonth()->format('Y-m');

        $current = $this->monthTotals($month);
        $previous = $this->monthTotals($prevMonth);

        $accounts = Account::withBalance()->where('is_archived', false)->orderBy('name')->get();
        $liquid = $accounts->where('include_in_total', true)->where('type', '!=', 'credit_card');

        $overdue = Transaction::overdue()->where('type', 'expense');

        return response()->json([
            'month' => $month,
            'summary' => [
                ...$current,
                'previous' => $previous,
                'income_variation' => $this->variation($current['income'], $previous['income']),
                'expense_variation' => $this->variation($current['expense'], $previous['expense']),
                'savings_rate' => $current['income'] > 0 ? round(($current['income'] - $current['expense']) / $current['income'] * 100, 1) : null,
                'total_balance' => round($liquid->sum('balance'), 2),
                'projected_balance' => round($liquid->sum('projected_balance'), 2),
                'overdue_count' => (clone $overdue)->count(),
                'overdue_amount' => round((float) (clone $overdue)->sum('amount'), 2),
            ],
            'accounts' => $accounts->map(fn ($a) => [
                'id' => $a->id, 'name' => $a->name, 'type' => $a->type, 'color' => $a->color,
                'balance' => $a->balance, 'projected_balance' => $a->projected_balance, 'credit_limit' => $a->credit_limit,
            ])->values(),
            'expenses_by_category' => $this->byCategory('expense', $start, $end),
            'income_by_category' => $this->byCategory('income', $start, $end),
            'evolution' => $this->evolution($start->copy()->subMonths(11), $end),
            'daily' => $this->daily($start, $end),
            'upcoming' => Transaction::with(['category:id,name,color,icon', 'account:id,name,color'])
                ->where('is_paid', false)->where('type', '!=', 'transfer')
                ->where('date', '<=', today()->addDays(15)->toDateString())
                ->orderBy('date')->limit(10)->get(),
            'recent' => Transaction::with(['category:id,name,color,icon', 'account:id,name,color'])
                ->latest('date')->latest('id')->limit(8)->get(),
            'budgets' => collect(BudgetController::forMonth($month)['data'])->take(6)->values(),
            'goals' => Goal::whereNull('completed_at')->orderBy('deadline')->limit(4)->get(),
            'unread_notifications' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    private function monthTotals(string $month): array
    {
        $q = Transaction::query()->inMonth($month);
        $row = (clone $q)->toBase()->selectRaw("
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense,
            COALESCE(SUM(CASE WHEN type = 'income' AND is_paid = 1 THEN amount ELSE 0 END), 0) AS income_paid,
            COALESCE(SUM(CASE WHEN type = 'expense' AND is_paid = 1 THEN amount ELSE 0 END), 0) AS expense_paid
        ")->first();

        $income = round((float) $row->income, 2);
        $expense = round((float) $row->expense, 2);

        return [
            'income' => $income,
            'expense' => $expense,
            'balance' => round($income - $expense, 2),
            'income_paid' => round((float) $row->income_paid, 2),
            'expense_paid' => round((float) $row->expense_paid, 2),
            'income_pending' => round($income - (float) $row->income_paid, 2),
            'expense_pending' => round($expense - (float) $row->expense_paid, 2),
        ];
    }

    private function variation(float $current, float $previous): ?float
    {
        return $previous > 0 ? round(($current - $previous) / $previous * 100, 1) : null;
    }

    public static function byCategory(string $type, Carbon $start, Carbon $end): array
    {
        $rows = Transaction::query()->where('transactions.type', $type)
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->leftJoin('categories', 'categories.id', '=', 'transactions.category_id')
            ->selectRaw("transactions.category_id, COALESCE(categories.name, 'Sem categoria') as name, COALESCE(categories.color, '#94a3b8') as color, SUM(transactions.amount) as total, COUNT(*) as count")
            ->groupBy('transactions.category_id', 'categories.name', 'categories.color')
            ->orderByDesc('total')->get();

        $sum = (float) $rows->sum('total');

        return $rows->map(fn ($r) => [
            'category_id' => $r->category_id,
            'name' => $r->name,
            'color' => $r->color,
            'total' => round((float) $r->total, 2),
            'count' => (int) $r->count,
            'percent' => $sum > 0 ? round($r->total / $sum * 100, 1) : 0,
        ])->all();
    }

    /** Receitas x despesas por mês (agrupado em PHP para funcionar em qualquer banco). */
    public static function evolution(Carbon $from, Carbon $to): array
    {
        $months = [];
        for ($m = $from->copy()->startOfMonth(); $m->lte($to); $m->addMonth()) {
            $months[$m->format('Y-m')] = ['month' => $m->format('Y-m'), 'income' => 0.0, 'expense' => 0.0];
        }

        Transaction::query()->whereIn('type', ['income', 'expense'])
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->toBase()->selectRaw('date, type, SUM(amount) as total')->groupBy('date', 'type')->get()
            ->each(function ($r) use (&$months) {
                $key = substr((string) $r->date, 0, 7);
                if (isset($months[$key])) {
                    $months[$key][$r->type] += (float) $r->total;
                }
            });

        return array_values(array_map(fn ($m) => [
            ...$m,
            'income' => round($m['income'], 2),
            'expense' => round($m['expense'], 2),
            'balance' => round($m['income'] - $m['expense'], 2),
        ], $months));
    }

    /** Fluxo diário do mês com saldo acumulado. */
    private function daily(Carbon $start, Carbon $end): array
    {
        $rows = Transaction::query()->whereIn('type', ['income', 'expense'])
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->toBase()->selectRaw('date, type, SUM(amount) as total')->groupBy('date', 'type')->get()
            ->groupBy(fn ($r) => substr((string) $r->date, 0, 10));

        $result = [];
        $acc = 0;
        for ($d = $start->copy(); $d->lte($end); $d->addDay()) {
            $day = $rows->get($d->toDateString(), collect());
            $income = (float) $day->where('type', 'income')->sum('total');
            $expense = (float) $day->where('type', 'expense')->sum('total');
            $acc += $income - $expense;
            $result[] = ['date' => $d->toDateString(), 'income' => round($income, 2), 'expense' => round($expense, 2), 'accumulated' => round($acc, 2)];
        }

        return $result;
    }
}

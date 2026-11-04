<?php

namespace App\Support;

use App\Models\Transaction;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Aplica os filtros da tela de lançamentos a uma query. Usado pela listagem,
 * pelos totais e pela exportação para que todos mostrem exatamente o mesmo conjunto.
 */
class TransactionFilter
{
    public const SORTABLE = ['date', 'amount', 'description', 'created_at', 'paid_at'];

    public static function apply(Builder $query, Request $request): Builder
    {
        $ids = fn (string $key) => array_filter(array_map('intval', (array) $request->input($key, [])));

        return $query
            ->when($request->filled('month'), fn ($q) => $q->inMonth($request->string('month')))
            ->when($request->filled('from'), fn ($q) => $q->where('date', '>=', $request->date('from')->toDateString()))
            ->when($request->filled('to'), fn ($q) => $q->where('date', '<=', $request->date('to')->toDateString()))
            ->when($request->filled('type'), fn ($q) => $q->whereIn('type', (array) $request->input('type')))
            ->when($request->filled('status'), function ($q) use ($request) {
                match ($request->input('status')) {
                    'paid' => $q->where('is_paid', true),
                    'pending' => $q->where('is_paid', false)->where('date', '>=', today()->toDateString()),
                    'overdue' => $q->overdue(),
                    'unpaid' => $q->where('is_paid', false),
                    default => null,
                };
            })
            ->when($ids('account_ids'), fn ($q, $v) => $q->where(fn ($w) => $w->whereIn('account_id', $v)->orWhereIn('transfer_account_id', $v)))
            ->when($ids('category_ids'), fn ($q, $v) => $q->whereIn('category_id', $v))
            ->when($ids('tag_ids'), fn ($q, $v) => $q->whereHas('tags', fn ($t) => $t->whereIn('tags.id', $v)))
            ->when($request->filled('payment_method'), fn ($q) => $q->whereIn('payment_method', (array) $request->input('payment_method')))
            ->when($request->filled('min_amount'), fn ($q) => $q->where('amount', '>=', (float) $request->input('min_amount')))
            ->when($request->filled('max_amount'), fn ($q) => $q->where('amount', '<=', (float) $request->input('max_amount')))
            ->when($request->boolean('installments_only'), fn ($q) => $q->whereNotNull('installment_group'))
            ->when($request->boolean('recurring_only'), fn ($q) => $q->whereNotNull('recurring_transaction_id'))
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%'.str_replace(['%', '_'], ['\%', '\_'], $request->string('search')).'%';
                $q->where(fn ($w) => $w->where('description', 'like', $term)->orWhere('notes', 'like', $term));
            });
    }

    public static function sort(Builder $query, Request $request): Builder
    {
        $sort = in_array($request->input('sort'), self::SORTABLE, true) ? $request->input('sort') : 'date';
        $dir = $request->input('direction') === 'asc' ? 'asc' : 'desc';

        return $query->orderBy($sort, $dir)->orderBy('id', $dir);
    }

    /** Totais do conjunto filtrado (transferências não entram em receita/despesa). */
    public static function totals(Builder $query): array
    {
        $row = (clone $query)->reorder()->toBase()->selectRaw("
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense,
            COALESCE(SUM(CASE WHEN type = 'income' AND is_paid = 1 THEN amount ELSE 0 END), 0) AS income_paid,
            COALESCE(SUM(CASE WHEN type = 'expense' AND is_paid = 1 THEN amount ELSE 0 END), 0) AS expense_paid,
            COUNT(*) AS count
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
            'count' => (int) $row->count,
        ];
    }
}

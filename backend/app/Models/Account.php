<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class Account extends Model
{
    use BelongsToUser;

    public const TYPES = ['checking', 'savings', 'cash', 'credit_card', 'investment', 'other'];

    protected $fillable = [
        'user_id', 'name', 'type', 'initial_balance', 'credit_limit', 'closing_day', 'due_day',
        'color', 'include_in_total', 'is_archived',
    ];

    protected $attributes = ['type' => 'checking', 'initial_balance' => 0, 'color' => '#6366f1', 'include_in_total' => true, 'is_archived' => false];

    protected function casts(): array
    {
        return [
            'initial_balance' => 'float',
            'credit_limit' => 'float',
            'closing_day' => 'integer',
            'due_day' => 'integer',
            'include_in_total' => 'boolean',
            'is_archived' => 'boolean',
        ];
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    /**
     * Adiciona as colunas calculadas `balance` (saldo atual, só lançamentos pagos)
     * e `projected_balance` (incluindo pendentes) à consulta.
     */
    public function scopeWithBalance(Builder $query, ?string $until = null): Builder
    {
        $paidSum = fn (bool $onlyPaid) => DB::table('transactions')
            ->selectRaw("COALESCE(SUM(CASE
                WHEN transactions.type = 'income' AND transactions.account_id = accounts.id THEN transactions.amount
                WHEN transactions.type = 'expense' AND transactions.account_id = accounts.id THEN -transactions.amount
                WHEN transactions.type = 'transfer' AND transactions.account_id = accounts.id THEN -transactions.amount
                WHEN transactions.type = 'transfer' AND transactions.transfer_account_id = accounts.id THEN transactions.amount
                WHEN transactions.type = 'invest' AND transactions.account_id = accounts.id THEN -transactions.amount
                WHEN transactions.type = 'redeem' AND transactions.account_id = accounts.id THEN transactions.amount
                ELSE 0 END), 0)")
            ->where(fn ($q) => $q->whereColumn('transactions.account_id', 'accounts.id')
                ->orWhereColumn('transactions.transfer_account_id', 'accounts.id'))
            ->when($onlyPaid, fn ($q) => $q->where('transactions.is_paid', true))
            ->when($until, fn ($q) => $q->where('transactions.date', '<=', $until));

        return $query
            ->select('accounts.*')
            ->selectSub($paidSum(true), 'paid_sum')
            ->selectSub($paidSum(false), 'total_sum');
    }

    public function getBalanceAttribute(): float
    {
        return round($this->initial_balance + (float) ($this->attributes['paid_sum'] ?? 0), 2);
    }

    public function getProjectedBalanceAttribute(): float
    {
        return round($this->initial_balance + (float) ($this->attributes['total_sum'] ?? 0), 2);
    }
}

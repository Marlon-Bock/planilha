<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Transaction extends Model
{
    use BelongsToUser;

    public const TYPES = ['income', 'expense', 'transfer'];
    public const PAYMENT_METHODS = ['pix', 'debit', 'credit', 'cash', 'boleto', 'transfer', 'other'];

    protected $fillable = [
        'user_id', 'account_id', 'transfer_account_id', 'category_id', 'recurring_transaction_id',
        'type', 'description', 'amount', 'date', 'is_paid', 'paid_at', 'payment_method',
        'installment_group', 'installment_number', 'installment_total', 'notes',
    ];

    protected $appends = ['status'];

    protected $attributes = ['is_paid' => false];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'date' => 'date:Y-m-d',
            'paid_at' => 'date:Y-m-d',
            'is_paid' => 'boolean',
            'installment_number' => 'integer',
            'installment_total' => 'integer',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function transferAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'transfer_account_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function recurring(): BelongsTo
    {
        return $this->belongsTo(RecurringTransaction::class, 'recurring_transaction_id');
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class);
    }

    /** paid | overdue | pending */
    public function getStatusAttribute(): string
    {
        if ($this->is_paid) {
            return 'paid';
        }

        return $this->date && $this->date->lt(today()) ? 'overdue' : 'pending';
    }

    public function scopeInMonth(Builder $q, string $month): Builder
    {
        [$start, $end] = self::monthRange($month);

        return $q->whereBetween('date', [$start, $end]);
    }

    public function scopeOverdue(Builder $q): Builder
    {
        return $q->where('is_paid', false)->where('date', '<', today()->toDateString());
    }

    /** @return array{0:string,1:string} */
    public static function monthRange(string $month): array
    {
        $start = \Carbon\Carbon::createFromFormat('Y-m-d', $month.'-01')->startOfMonth();

        return [$start->toDateString(), $start->copy()->endOfMonth()->toDateString()];
    }
}

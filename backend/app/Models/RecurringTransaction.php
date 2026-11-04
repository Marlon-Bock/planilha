<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RecurringTransaction extends Model
{
    use BelongsToUser;

    public const FREQUENCIES = ['weekly', 'monthly', 'yearly'];

    protected $fillable = [
        'user_id', 'account_id', 'category_id', 'type', 'description', 'amount', 'frequency',
        'start_date', 'end_date', 'next_date', 'payment_method', 'auto_paid', 'is_active', 'notes',
    ];

    protected $attributes = ['frequency' => 'monthly', 'auto_paid' => false, 'is_active' => true];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
            'next_date' => 'date:Y-m-d',
            'auto_paid' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    /** Data da próxima ocorrência a partir de $date, mantendo o dia original do início. */
    public function advance(Carbon $date): Carbon
    {
        $day = $this->start_date->day;

        return match ($this->frequency) {
            'weekly' => $date->copy()->addWeek(),
            'yearly' => $date->copy()->addYearNoOverflow(),
            default => (function () use ($date, $day) {
                $next = $date->copy()->startOfMonth()->addMonth();

                return $next->day(min($day, $next->daysInMonth));
            })(),
        };
    }

    /**
     * Gera os lançamentos pendentes até $until (inclusive). Retorna quantos foram criados.
     */
    public function generateUntil(Carbon $until): int
    {
        if (! $this->is_active) {
            return 0;
        }

        $created = 0;
        $next = $this->next_date->copy();

        while ($next->lte($until) && (! $this->end_date || $next->lte($this->end_date))) {
            Transaction::withoutGlobalScopes()->create([
                'user_id' => $this->user_id,
                'account_id' => $this->account_id,
                'category_id' => $this->category_id,
                'recurring_transaction_id' => $this->id,
                'type' => $this->type,
                'description' => $this->description,
                'amount' => $this->amount,
                'date' => $next->toDateString(),
                'is_paid' => $this->auto_paid && $next->lte(today()),
                'paid_at' => $this->auto_paid && $next->lte(today()) ? $next->toDateString() : null,
                'payment_method' => $this->payment_method,
                'notes' => $this->notes,
            ]);
            $created++;
            $next = $this->advance($next);
        }

        $this->next_date = $next;
        if ($this->end_date && $next->gt($this->end_date)) {
            $this->is_active = false;
        }
        $this->save();

        return $created;
    }
}

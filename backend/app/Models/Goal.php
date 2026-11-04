<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Goal extends Model
{
    use BelongsToUser;

    protected $fillable = ['user_id', 'name', 'target_amount', 'current_amount', 'deadline', 'color', 'notes', 'completed_at'];

    protected $appends = ['progress', 'monthly_needed'];

    protected function casts(): array
    {
        return [
            'target_amount' => 'float',
            'current_amount' => 'float',
            'deadline' => 'date:Y-m-d',
            'completed_at' => 'datetime',
        ];
    }

    public function contributions(): HasMany
    {
        return $this->hasMany(GoalContribution::class)->latest('date')->latest('id');
    }

    public function getProgressAttribute(): float
    {
        return $this->target_amount > 0 ? round(min(100, $this->current_amount / $this->target_amount * 100), 1) : 0;
    }

    /** Quanto precisa guardar por mês para chegar na meta até o prazo. */
    public function getMonthlyNeededAttribute(): ?float
    {
        if (! $this->deadline || $this->current_amount >= $this->target_amount) {
            return null;
        }
        $months = max(1, (int) ceil(today()->floatDiffInMonths($this->deadline, false)));

        return round(($this->target_amount - $this->current_amount) / $months, 2);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Auth;

class Goal extends Model
{
    public const KIND_MONEY = 'money';
    public const KIND_TASK = 'task';

    protected $fillable = ['user_id', 'name', 'kind', 'target_amount', 'current_amount', 'deadline', 'color', 'notes', 'completed_at'];

    protected $appends = ['progress', 'monthly_needed', 'is_owner'];

    protected $attributes = ['kind' => self::KIND_MONEY];

    protected function casts(): array
    {
        return [
            'target_amount' => 'float',
            'current_amount' => 'float',
            'deadline' => 'date:Y-m-d',
            'completed_at' => 'datetime',
        ];
    }

    /**
     * Como nos outros modelos, cada um só enxerga o que é seu; a diferença é que a meta
     * também aparece para quem foi convidado a participar dela (metas de casal).
     */
    protected static function booted(): void
    {
        static::addGlobalScope('visible', function (Builder $builder) {
            if (Auth::hasUser()) {
                $id = Auth::id();
                $builder->where(fn (Builder $q) => $q
                    ->where('goals.user_id', $id)
                    ->orWhereExists(fn ($sub) => $sub->selectRaw('1')->from('goal_user')
                        ->whereColumn('goal_user.goal_id', 'goals.id')->where('goal_user.user_id', $id)));
            }
        });

        static::creating(function (Goal $goal) {
            if (! $goal->user_id && Auth::hasUser()) {
                $goal->user_id = Auth::id();
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Outros usuários que participam da meta (veem, mas não editam). */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withTimestamps();
    }

    /** Caixinhas/investimentos vinculados: o "já guardado" vira o saldo deles. */
    public function investments(): HasMany
    {
        return $this->hasMany(Investment::class);
    }

    public function contributions(): HasMany
    {
        return $this->hasMany(GoalContribution::class)->latest('date')->latest('id');
    }

    public function isTask(): bool
    {
        return $this->kind === self::KIND_TASK;
    }

    public function getIsOwnerAttribute(): bool
    {
        return Auth::hasUser() && (int) $this->user_id === (int) Auth::id();
    }

    public function getProgressAttribute(): float
    {
        if ($this->isTask()) {
            return $this->completed_at ? 100 : 0;
        }

        return $this->target_amount > 0 ? round(min(100, $this->current_amount / $this->target_amount * 100), 1) : 0;
    }

    /** Quanto precisa guardar por mês para chegar na meta até o prazo. */
    public function getMonthlyNeededAttribute(): ?float
    {
        if ($this->isTask() || ! $this->deadline || $this->current_amount >= $this->target_amount) {
            return null;
        }
        $months = max(1, (int) ceil(today()->floatDiffInMonths($this->deadline, false)));

        return round(($this->target_amount - $this->current_amount) / $months, 2);
    }
}

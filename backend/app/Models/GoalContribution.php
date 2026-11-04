<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GoalContribution extends Model
{
    protected $fillable = ['goal_id', 'amount', 'date', 'note'];

    protected function casts(): array
    {
        return ['amount' => 'float', 'date' => 'date:Y-m-d'];
    }

    public function goal(): BelongsTo
    {
        return $this->belongsTo(Goal::class);
    }
}

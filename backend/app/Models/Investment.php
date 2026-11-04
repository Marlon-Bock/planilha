<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Investment extends Model
{
    use BelongsToUser;

    public const TYPES = ['caixinha', 'cdb', 'tesouro', 'lci_lca', 'poupanca', 'previdencia', 'acoes', 'fii', 'cripto', 'outro'];
    public const RATE_TYPES = ['cdi', 'prefixed', 'ipca', 'poupanca', 'variable'];

    protected $fillable = [
        'user_id', 'goal_id', 'name', 'institution', 'type', 'rate_type', 'rate', 'liquidity', 'maturity_date', 'color', 'is_active', 'notes',
    ];

    protected $attributes = ['type' => 'caixinha', 'rate_type' => 'cdi', 'liquidity' => 'daily', 'color' => '#8b5cf6', 'is_active' => true];

    protected function casts(): array
    {
        return [
            'rate' => 'float',
            'maturity_date' => 'date:Y-m-d',
            'is_active' => 'boolean',
        ];
    }

    /** Meta para a qual este investimento está guardando dinheiro. */
    public function goal(): BelongsTo
    {
        return $this->belongsTo(Goal::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(InvestmentMovement::class);
    }
}

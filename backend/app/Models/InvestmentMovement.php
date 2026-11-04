<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvestmentMovement extends Model
{
    public const TYPES = ['deposit', 'withdraw', 'balance'];

    protected $fillable = ['investment_id', 'account_id', 'transaction_id', 'type', 'amount', 'date', 'note', 'is_opening'];

    protected function casts(): array
    {
        return ['amount' => 'float', 'date' => 'date:Y-m-d', 'is_opening' => 'boolean'];
    }

    public function investment(): BelongsTo
    {
        return $this->belongsTo(Investment::class);
    }

    /** Conta de onde o dinheiro saiu (aplicação) ou para onde voltou (resgate). */
    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }
}

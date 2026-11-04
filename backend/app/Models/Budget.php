<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Budget extends Model
{
    use BelongsToUser;

    protected $fillable = ['user_id', 'category_id', 'month', 'amount'];

    protected function casts(): array
    {
        return ['amount' => 'float'];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }
}

<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    use BelongsToUser;

    protected $fillable = ['user_id', 'name', 'type', 'color', 'icon', 'is_archived'];

    protected $attributes = ['color' => '#64748b', 'icon' => 'tag', 'is_archived' => false];

    protected function casts(): array
    {
        return ['is_archived' => 'boolean'];
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function budgets(): HasMany
    {
        return $this->hasMany(Budget::class);
    }

    /** Categorias criadas para todo usuário novo. */
    public static function defaults(): array
    {
        return [
            ['name' => 'Salário', 'type' => 'income', 'color' => '#10b981', 'icon' => 'briefcase'],
            ['name' => 'Freelance', 'type' => 'income', 'color' => '#14b8a6', 'icon' => 'laptop'],
            ['name' => 'Investimentos', 'type' => 'income', 'color' => '#0ea5e9', 'icon' => 'trending-up'],
            ['name' => 'Outras receitas', 'type' => 'income', 'color' => '#22c55e', 'icon' => 'plus-circle'],
            ['name' => 'Moradia', 'type' => 'expense', 'color' => '#6366f1', 'icon' => 'home'],
            ['name' => 'Alimentação', 'type' => 'expense', 'color' => '#f97316', 'icon' => 'utensils'],
            ['name' => 'Mercado', 'type' => 'expense', 'color' => '#eab308', 'icon' => 'shopping-cart'],
            ['name' => 'Transporte', 'type' => 'expense', 'color' => '#3b82f6', 'icon' => 'car'],
            ['name' => 'Saúde', 'type' => 'expense', 'color' => '#ef4444', 'icon' => 'heart-pulse'],
            ['name' => 'Educação', 'type' => 'expense', 'color' => '#8b5cf6', 'icon' => 'graduation-cap'],
            ['name' => 'Lazer', 'type' => 'expense', 'color' => '#ec4899', 'icon' => 'party-popper'],
            ['name' => 'Contas e serviços', 'type' => 'expense', 'color' => '#0891b2', 'icon' => 'receipt'],
            ['name' => 'Assinaturas', 'type' => 'expense', 'color' => '#a855f7', 'icon' => 'repeat'],
            ['name' => 'Compras', 'type' => 'expense', 'color' => '#f43f5e', 'icon' => 'shopping-bag'],
            ['name' => 'Impostos e taxas', 'type' => 'expense', 'color' => '#78716c', 'icon' => 'landmark'],
            ['name' => 'Outras despesas', 'type' => 'expense', 'color' => '#64748b', 'icon' => 'tag'],
        ];
    }
}

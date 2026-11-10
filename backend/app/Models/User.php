<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLE_ADMIN = 'admin';
    public const ROLE_USER = 'user';

    protected $fillable = [
        'name', 'partner_name', 'together_since', 'email', 'password', 'role', 'is_active', 'currency', 'alert_days_before', 'last_login_at',
    ];

    protected $hidden = ['password', 'remember_token', 'avatar_path', 'cover_path', 'background_path'];

    protected $appends = ['avatar_url', 'cover_url', 'background_url'];

    protected $attributes = [
        'role' => self::ROLE_USER,
        'is_active' => true,
        'currency' => 'BRL',
        'alert_days_before' => 3,
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'together_since' => 'date:Y-m-d',
            'cover_position' => 'integer',
            'pet' => 'array',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'alert_days_before' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        // Conta excluída leva junto as fotos.
        static::deleted(fn (User $user) => Storage::disk('uploads')->deleteDirectory((string) $user->id));
    }

    /** URL da foto (rota autenticada); o ?v= muda a cada troca para furar o cache. */
    private function photoUrl(string $slot, ?string $path): ?string
    {
        return $path ? '/api/profile/photos/'.$slot.'?v='.substr(md5($path), 0, 10) : null;
    }

    public function getAvatarUrlAttribute(): ?string
    {
        return $this->photoUrl('avatar', $this->avatar_path);
    }

    public function getCoverUrlAttribute(): ?string
    {
        return $this->photoUrl('cover', $this->cover_path);
    }

    public function getBackgroundUrlAttribute(): ?string
    {
        return $this->photoUrl('background', $this->background_path);
    }

    /** Quem eu deixei ver as minhas finanças (somente visualização). */
    public function viewers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_viewers', 'owner_id', 'viewer_id')->withTimestamps();
    }

    /** De quem eu posso ver as finanças. */
    public function viewables(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_viewers', 'viewer_id', 'owner_id')->withTimestamps();
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function accounts(): HasMany
    {
        return $this->hasMany(Account::class);
    }

    public function categories(): HasMany
    {
        return $this->hasMany(Category::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function budgets(): HasMany
    {
        return $this->hasMany(Budget::class);
    }

    public function goals(): HasMany
    {
        return $this->hasMany(Goal::class);
    }

    public function recurringTransactions(): HasMany
    {
        return $this->hasMany(RecurringTransaction::class);
    }

    public function tags(): HasMany
    {
        return $this->hasMany(Tag::class);
    }
}

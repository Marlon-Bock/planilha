<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Model;

class PushSubscription extends Model
{
    use BelongsToUser;

    protected $fillable = ['user_id', 'endpoint', 'endpoint_hash', 'public_key', 'auth_token', 'content_encoding', 'device', 'last_used_at'];

    protected $hidden = ['endpoint', 'endpoint_hash', 'public_key', 'auth_token'];

    protected function casts(): array
    {
        return ['last_used_at' => 'datetime'];
    }

    public static function hashEndpoint(string $endpoint): string
    {
        return hash('sha256', $endpoint);
    }
}

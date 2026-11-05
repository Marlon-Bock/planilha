<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LocaleTest extends TestCase
{
    use RefreshDatabase;

    public function test_validation_messages_in_portuguese(): void
    {
        $user = User::factory()->create();
        $res = $this->actingAs($user)->postJson('/api/transactions', [], ['X-Locale' => 'pt-BR'])->assertStatus(422);

        $this->assertSame('O campo descrição é obrigatório.', $res->json('errors.description.0'));
        $this->assertStringNotContainsString('validation.', $res->json('message'));
    }

    public function test_validation_messages_in_english(): void
    {
        $user = User::factory()->create();
        $res = $this->actingAs($user)->postJson('/api/transactions', [], ['X-Locale' => 'en'])->assertStatus(422);

        $this->assertSame('The description field is required.', $res->json('errors.description.0'));
    }

    public function test_custom_messages_follow_language(): void
    {
        $this->postJson('/api/auth/login', ['email' => 'ninguem@x.test', 'password' => 'errada123'], ['X-Locale' => 'en'])
            ->assertStatus(422)->assertJsonPath('errors.email.0', 'Invalid email or password.');
        $this->postJson('/api/auth/login', ['email' => 'ninguem@x.test', 'password' => 'errada123'], ['X-Locale' => 'pt-BR'])
            ->assertStatus(422)->assertJsonPath('errors.email.0', 'E-mail ou senha inválidos.');
    }
}

<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PetTest extends TestCase
{
    use RefreshDatabase;

    public function test_customize_feed_and_pet_the_dog(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->getJson('/api/auth/me')->assertJsonPath('user.pet', null);

        $this->putJson('/api/profile/pet', ['name' => 'Thor', 'color' => 'choco', 'collar' => '#3b82f6', 'wander' => false])
            ->assertOk()
            ->assertJsonPath('user.pet.name', 'Thor')
            ->assertJsonPath('user.pet.color', 'choco')
            ->assertJsonPath('user.pet.collar', '#3b82f6')
            ->assertJsonPath('user.pet.wander', false)
            ->assertJsonPath('user.pet.love', 0);

        // Sem coleira.
        $this->putJson('/api/profile/pet', ['name' => 'Thor', 'color' => 'choco', 'collar' => null, 'wander' => true])
            ->assertOk()->assertJsonPath('user.pet.collar', null);

        $fed = $this->postJson('/api/profile/pet/feed')->assertOk()->json('user.pet.fed_at');
        $this->assertNotNull($fed);

        $this->postJson('/api/profile/pet/love', ['count' => 3])->assertOk()->assertJsonPath('user.pet.love', 3);
        $this->postJson('/api/profile/pet/love', ['count' => 2])->assertOk()
            ->assertJsonPath('user.pet.love', 5)
            ->assertJsonPath('user.pet.name', 'Thor');
    }

    public function test_rejects_invalid_pet_data(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->putJson('/api/profile/pet', ['name' => str_repeat('a', 30), 'color' => 'blue', 'collar' => 'red', 'wander' => true])
            ->assertStatus(422)->assertJsonValidationErrors(['name', 'color', 'collar']);
        $this->postJson('/api/profile/pet/love', ['count' => 500])->assertStatus(422);
    }

    public function test_feeding_before_customizing_creates_default_pet(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/api/profile/pet/feed')->assertOk()
            ->assertJsonPath('user.pet.color', 'caramel')
            ->assertJsonPath('user.pet.collar', '#ec4899');
    }
}

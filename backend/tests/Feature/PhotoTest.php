<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PhotoTest extends TestCase
{
    use RefreshDatabase;

    public function test_upload_show_replace_and_remove_photo(): void
    {
        Storage::fake('uploads');
        $user = User::factory()->create();

        $res = $this->actingAs($user)->post('/api/profile/photos/avatar', ['photo' => UploadedFile::fake()->image('eu.jpg', 400, 400)], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('user.cover_url', null);
        $url = $res->json('user.avatar_url');
        $this->assertStringStartsWith('/api/profile/photos/avatar?v=', $url);
        $this->assertArrayNotHasKey('avatar_path', $res->json('user'));

        $first = $user->fresh()->avatar_path;
        Storage::disk('uploads')->assertExists($first);
        $this->assertStringStartsWith($user->id.'/avatar-', $first);

        $this->get($url)->assertOk()->assertHeader('Cache-Control', 'immutable, max-age=31536000, private');

        // Trocar apaga a antiga e muda a URL.
        $res2 = $this->post('/api/profile/photos/avatar', ['photo' => UploadedFile::fake()->image('nova.png', 300, 300)], ['Accept' => 'application/json'])->assertOk();
        $this->assertNotSame($url, $res2->json('user.avatar_url'));
        Storage::disk('uploads')->assertMissing($first);

        $this->deleteJson('/api/profile/photos/avatar')->assertOk()->assertJsonPath('user.avatar_url', null);
        $this->assertCount(0, Storage::disk('uploads')->allFiles());
        $this->get('/api/profile/photos/avatar', ['Accept' => 'application/json'])->assertNotFound();
    }

    public function test_rejects_non_images_and_unknown_slots(): void
    {
        Storage::fake('uploads');
        $user = User::factory()->create();

        $this->actingAs($user)->post('/api/profile/photos/cover', ['photo' => UploadedFile::fake()->create('x.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertStatus(422);
        $this->post('/api/profile/photos/other', ['photo' => UploadedFile::fake()->image('a.jpg')], ['Accept' => 'application/json'])
            ->assertClientError();
        $this->assertCount(0, Storage::disk('uploads')->allFiles());
    }

    public function test_photos_are_private_and_removed_with_account(): void
    {
        Storage::fake('uploads');
        $owner = User::factory()->create();
        $this->actingAs($owner)->post('/api/profile/photos/background', ['photo' => UploadedFile::fake()->image('fundo.jpg', 800, 600)], ['Accept' => 'application/json'])->assertOk();

        // Outra conta vê só as próprias fotos (não tem fundo).
        $other = User::factory()->create();
        $this->actingAs($other)->get('/api/profile/photos/background', ['Accept' => 'application/json'])->assertNotFound();

        $owner->delete();
        $this->assertCount(0, Storage::disk('uploads')->allFiles());
    }

    public function test_cover_position_is_saved_and_reset_on_new_cover(): void
    {
        Storage::fake('uploads');
        $user = User::factory()->create();
        $this->actingAs($user)->post('/api/profile/photos/cover', ['photo' => UploadedFile::fake()->image('capa.jpg', 1200, 800)], ['Accept' => 'application/json'])->assertOk();

        $this->patchJson('/api/profile/photos/cover/position', ['position' => 22])->assertOk()->assertJsonPath('user.cover_position', 22);
        $this->patchJson('/api/profile/photos/cover/position', ['position' => 150])->assertStatus(422);

        $this->post('/api/profile/photos/cover', ['photo' => UploadedFile::fake()->image('outra.jpg', 1200, 800)], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('user.cover_position', null);
    }

    public function test_guest_cannot_see_photos(): void
    {
        $this->getJson('/api/profile/photos/avatar')->assertUnauthorized();
    }
}

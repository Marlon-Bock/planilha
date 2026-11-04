<?php

namespace Tests\Feature;

use Tests\TestCase;

/** Rotas web que servem o frontend estático (exportado do Next.js para public/). */
class WebRoutesTest extends TestCase
{
    public function test_root_redirects_to_dashboard(): void
    {
        $this->get('/')->assertRedirect('/dashboard');
    }

    public function test_app_pages_are_served_from_public_html(): void
    {
        if (! is_file(public_path('dashboard.html'))) {
            $this->markTestSkipped('Frontend ainda não exportado (rode npm run deploy no frontend).');
        }
        $this->get('/dashboard')->assertOk()->assertHeader('Content-Type', 'text/html; charset=UTF-8')->assertSee('<html', false);
        $this->get('/admin/usuarios')->assertOk();
    }

    public function test_unknown_pages_404_and_api_stays_json(): void
    {
        $this->get('/pagina-que-nao-existe')->assertNotFound();
        $this->get('/index.php.html')->assertNotFound(); // só caminhos simples
        $this->getJson('/api/nao-existe')->assertNotFound()->assertJsonStructure(['message']);
    }

    public function test_assetlinks_for_android_app(): void
    {
        config(['services.twa.package' => null]);
        $this->get('/.well-known/assetlinks.json')->assertOk()->assertExactJson([]);

        config(['services.twa.package' => 'br.com.teste.planilha', 'services.twa.fingerprints' => 'AA:BB, CC:DD']);
        $this->get('/.well-known/assetlinks.json')->assertOk()
            ->assertJsonPath('0.target.package_name', 'br.com.teste.planilha')
            ->assertJsonPath('0.target.sha256_cert_fingerprints', ['AA:BB', 'CC:DD']);
    }
}

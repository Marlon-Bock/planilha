<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
| As telas do app são arquivos estáticos gerados pelo Next.js (npm run deploy no frontend)
| e servidos direto pelo Apache (ver public/.htaccess). Aqui ficam só as rotas web que
| precisam do servidor.
*/

// Início: o app abre no dashboard (sem login, o próprio app manda para /login).
Route::redirect('/', '/dashboard');

/*
| Rede de segurança: se o servidor web não aplicar a regra do .htaccess (ex.: nginx,
| `artisan serve`), o Laravel entrega a tela: /dashboard -> public/dashboard.html.
| Só caminhos simples (letras, números, - _ /), sem "..": nada fora de public/.
*/
Route::fallback(function (Request $request) {
    $path = trim($request->path(), '/');
    $html = ['Content-Type' => 'text/html; charset=UTF-8', 'Cache-Control' => 'no-cache, must-revalidate'];

    if ($request->isMethod('GET') && ! $request->is('api/*') && preg_match('#^[a-z0-9_-]+(/[a-z0-9_-]+)*$#i', $path)) {
        $file = public_path("{$path}.html");
        if (is_file($file)) {
            return response(file_get_contents($file), 200, $html);
        }
    }

    // Página 404 do próprio app (na API, o Laravel responde JSON).
    if (! $request->is('api/*') && is_file(public_path('404.html'))) {
        return response(file_get_contents(public_path("404.html")), 404, $html);
    }
    abort(404);
});

/*
| Digital Asset Links: prova para o Android que o APK (TWA) e este site são do mesmo dono,
| para o app abrir em tela cheia, sem barra de endereço. Configure no .env:
|   TWA_PACKAGE_NAME=br.com.seudominio.planilha
|   TWA_SHA256_FINGERPRINTS=AA:BB:...   (vários separados por vírgula)
*/
Route::get('/.well-known/assetlinks.json', function () {
    $pkg = config('services.twa.package');
    $fingerprints = array_values(array_filter(array_map('trim', explode(',', (string) config('services.twa.fingerprints')))));

    $body = $pkg && $fingerprints
        ? [['relation' => ['delegate_permission/common.handle_all_urls'], 'target' => ['namespace' => 'android_app', 'package_name' => $pkg, 'sha256_cert_fingerprints' => $fingerprints]]]
        : [];

    return response()->json($body)->header('Cache-Control', 'public, max-age=3600');
});

<?php

use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\SetLocale;
use App\Http\Middleware\ViewAs;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Autenticação SPA via cookie de sessão (Sanctum) para o frontend Next.js.
        $middleware->statefulApi();
        // Idioma escolhido no app (português ou inglês).
        $middleware->prependToGroup('api', SetLocale::class);
        // A tela de login vive no frontend; requisições /api/* recebem 401 em JSON.
        $middleware->redirectGuestsTo(fn () => rtrim((string) env('FRONTEND_URL', 'http://localhost:3000'), '/').'/login');
        // "Ver como" troca o usuário antes de o Laravel buscar os registros da URL (ex.: /investments/5),
        // senão a busca seria feita com o usuário errado.
        $middleware->prependToPriorityList(SubstituteBindings::class, ViewAs::class);
        $middleware->alias([
            'active' => EnsureUserIsActive::class,
            'admin' => EnsureUserIsAdmin::class,
            'view-as' => ViewAs::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();

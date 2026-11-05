<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Idioma da resposta (validações e mensagens) conforme o idioma escolhido no app.
 * O frontend manda o cabeçalho X-Locale ("en" ou "pt-BR"); sem ele, vale o APP_LOCALE.
 */
class SetLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        $wanted = strtolower((string) $request->header('X-Locale', ''));
        if (str_starts_with($wanted, 'en')) {
            app()->setLocale('en');
        } elseif (str_starts_with($wanted, 'pt')) {
            app()->setLocale('pt_BR');
        }

        return $next($request);
    }
}

<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>@yield('title') · Planilha do Casal</title>
    <link rel="icon" href="/favicon.ico" sizes="48x48">
    <link rel="icon" href="/icon.svg" type="image/svg+xml">
    {{-- Página de erro do servidor: CSS embutido, funciona mesmo se o app não carregar. --}}
    <style>
        :root { --pink: #db2777; --pink-soft: #fdf2f8; --ink: #0f172a; --muted: #475569; --bg2: #f5f3ff; }
        @media (prefers-color-scheme: dark) { :root { --pink-soft: #020617; --bg2: #1e1033; --ink: #f8fafc; --muted: #cbd5e1; } }
        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
               font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
               background: linear-gradient(135deg, var(--pink-soft), var(--bg2)); color: var(--ink); text-align: center; }
        main { max-width: 32rem; }
        .cat { display: block; margin: 0 auto; }
        .code { margin: 8px 0 0; font-size: clamp(4rem, 14vw, 6rem); font-weight: 900; letter-spacing: -0.04em; line-height: 1; }
        .code svg { width: .8em; height: .8em; vertical-align: -0.04em; margin: 0 .06em; color: var(--pink); animation: beat 1.3s ease-in-out infinite; }
        h1 { margin: 16px 0 8px; font-size: 1.5rem; }
        p { margin: 0 auto; color: var(--muted); line-height: 1.6; max-width: 28rem; }
        .actions { margin-top: 28px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        a, button { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 20px; border-radius: 12px;
                    font: 600 14px/1 inherit; text-decoration: none; cursor: pointer; border: 0; }
        .primary { background: var(--pink); color: #fff; box-shadow: 0 4px 14px rgba(219, 39, 119, .3); }
        .primary:hover { background: #be185d; }
        .ghost { background: transparent; color: var(--muted); }
        .ghost:hover { background: rgba(148, 163, 184, .15); }
        @keyframes beat { 0%, 100% { transform: scale(1); } 15% { transform: scale(1.15); } 30% { transform: scale(1); } 45% { transform: scale(1.1); } }
        @media (prefers-reduced-motion: reduce) { .code svg { animation: none; } }
    </style>
</head>
<body>
<main>
    <svg viewBox="0 0 120 110" class="cat" width="128" height="117" aria-hidden="true"><g><ellipse cx="62" cy="92" rx="40" ry="17" fill="#fde7c8"></ellipse><path d="M98 94 C112 92 112 106 92 106" fill="none" stroke="#e7c79d" stroke-width="8" stroke-linecap="round"></path><g transform="translate(-14 30) rotate(-8 60 50)"><path d="M34 34 L38 8 L56 24 Z" fill="#fde7c8" stroke="#e7c79d" stroke-width="1.5" stroke-linejoin="round"></path><path d="M86 34 L82 8 L64 24 Z" fill="#fde7c8" stroke="#e7c79d" stroke-width="1.5" stroke-linejoin="round"></path><path d="M39 29 L41 15 L50 24 Z" fill="#f9a8d4"></path><path d="M81 29 L79 15 L70 24 Z" fill="#f9a8d4"></path><ellipse cx="60" cy="46" rx="30" ry="26" fill="#fde7c8" stroke="#e7c79d" stroke-width="1.5"></ellipse><path d="M44 47 q5 4 10 0" fill="none" stroke="#334155" stroke-width="2.2" stroke-linecap="round"></path><path d="M66 47 q5 4 10 0" fill="none" stroke="#334155" stroke-width="2.2" stroke-linecap="round"></path><ellipse cx="42" cy="55" rx="5" ry="3" fill="#f472b6" opacity=".45"></ellipse><ellipse cx="78" cy="55" rx="5" ry="3" fill="#f472b6" opacity=".45"></ellipse><path d="M57 52 h6 l-3 3.2 z" fill="#f472b6"></path><path d="M60 55.5 q-2 4 -5 2.5 M60 55.5 q2 4 5 2.5" fill="none" stroke="#334155" stroke-width="1.6" stroke-linecap="round"></path><g stroke="#334155" stroke-width="1.1" stroke-linecap="round" opacity=".55"><path d="M36 51 l-12 -2 M36 55 l-12 2"></path><path d="M84 51 l12 -2 M84 55 l12 2"></path></g></g></g></svg>

    {{-- Código com coração no lugar do zero (ex.: 5♥♥). --}}
    <p class="code" aria-label="@yield('code')">
        @foreach (str_split(trim($__env->yieldContent('code'))) as $digit)
            @if ($digit === '0')<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3 1.7-1.8 3.2-3 5.3-3 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>@else{{ $digit }}@endif
        @endforeach
    </p>
    <h1>@yield('title')</h1>
    <p>@yield('message')</p>

    <div class="actions">
        @hasSection('retry')
            <button class="primary" onclick="location.reload()">↻ Tentar de novo</button>
            <a class="ghost" href="/dashboard">Ir para o início</a>
        @else
            <a class="primary" href="/dashboard">Ir para o início</a>
            <button class="ghost" onclick="history.length > 1 ? history.back() : (location.href = '/dashboard')">← Voltar</button>
        @endif
    </div>
</main>
</body>
</html>

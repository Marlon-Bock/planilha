<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * "Ver as finanças de outra pessoa": com o cabeçalho X-View-As, as consultas das telas
 * financeiras respondem com os dados do outro usuário, desde que ele tenha permitido.
 * É somente leitura: qualquer coisa que não seja GET é recusada, e fora das rotas
 * financeiras (perfil, avisos, administração...) o cabeçalho é ignorado.
 */
class ViewAs
{
    private const ROUTES = [
        'api/dashboard', 'api/reports', 'api/accounts*', 'api/categories*', 'api/tags*', 'api/transactions*',
        'api/budgets*', 'api/goals*', 'api/recurring*', 'api/investments*', 'api/investment-movements*',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $viewer = $request->user();
        $id = (int) $request->header('X-View-As');
        if (! $viewer || ! $id || $id === (int) $viewer->id || ! $request->is(...self::ROUTES)) {
            return $next($request);
        }

        if (! $request->isMethod('GET')) {
            return response()->json(['message' => __('Você está só visualizando: não dá para alterar os dados de outra pessoa.')], 403);
        }

        $owner = User::where('is_active', true)->find($id);
        if (! $owner || ! $owner->viewers()->whereKey($viewer->id)->exists()) {
            return response()->json(['message' => __('Você não tem permissão para ver as finanças desta pessoa.'), 'view_denied' => true], 403);
        }

        // Daqui em diante, a requisição enxerga os dados do dono (os modelos filtram por Auth::id()).
        Auth::setUser($owner);

        return $next($request);
    }
}

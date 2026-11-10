<?php

namespace App\Services;

use App\Models\Goal;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;

/**
 * Metas vinculadas a investimentos: o "já guardado" é a soma do saldo atual
 * (com rendimento) das caixinhas ligadas. O valor é gravado em current_amount
 * para o resto do sistema (dashboard, avisos) enxergar o mesmo número, e a meta
 * é concluída/reaberta conforme o saldo atinge o objetivo.
 *
 * Em metas de casal, cada participante liga as próprias caixinhas e a soma é de
 * todas: por isso as caixinhas são buscadas sem o filtro "só as minhas".
 *
 * Cada meta recebe a relação virtual `linked_investments` (vai no JSON, não no banco).
 */
class GoalProgress
{
    public function __construct(private InvestmentCalculator $calc) {}

    /** @param  EloquentCollection<int, Goal>  $goals */
    public function hydrate(EloquentCollection $goals): Collection
    {
        // Sempre recarrega: precisa das caixinhas de todos os participantes, não só de quem está logado.
        $goals->load(['investments' => fn ($q) => $q->withoutGlobalScopes()->with('movements')->orderBy('id')]);
        $names = User::whereIn('id', $goals->flatMap(fn ($g) => $g->investments->pluck('user_id'))->unique())->pluck('name', 'id');
        $me = Auth::id();

        foreach ($goals as $goal) {
            $linked = $goal->investments->map(function ($inv) use ($names, $me) {
                $p = $this->calc->present($inv);

                return [
                    'id' => $inv->id, 'name' => $inv->name, 'institution' => $inv->institution, 'color' => $inv->color,
                    'balance' => $p['balance'], 'is_estimated' => $p['is_estimated'],
                    // De quem é a caixinha (em metas de casal, cada um liga as suas).
                    'owner' => $names[$inv->user_id] ?? null, 'mine' => $me !== null && (int) $inv->user_id === (int) $me,
                ];
            })->values();

            // Não manda os investimentos com todas as movimentações no JSON da meta.
            $goal->unsetRelation('investments');
            $goal->setRelation('linked_investments', $linked);

            if ($linked->isEmpty()) {
                continue;
            }

            $saved = round($linked->sum('balance'), 2);
            $done = $saved >= $goal->target_amount;
            $changes = [];
            if (abs($saved - $goal->current_amount) >= 0.01) {
                $changes['current_amount'] = $saved;
            }
            if ($done && ! $goal->completed_at) {
                $changes['completed_at'] = now();
            } elseif (! $done && $goal->completed_at) {
                $changes['completed_at'] = null;
            }
            if ($changes) {
                $goal->forceFill($changes)->saveQuietly();
            }
        }

        return $goals;
    }

    public function hydrateOne(Goal $goal): Goal
    {
        return $this->hydrate(new EloquentCollection([$goal]))->first();
    }
}

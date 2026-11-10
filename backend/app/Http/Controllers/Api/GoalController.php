<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Goal;
use App\Models\Investment;
use App\Services\AlertService;
use App\Services\GoalProgress;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class GoalController extends Controller
{
    /** Quem participa da meta vai junto no JSON (só id e nome). */
    private const PEOPLE = ['user:id,name', 'members:id,name'];

    public function __construct(private GoalProgress $progress) {}

    public function index(): JsonResponse
    {
        $goals = $this->progress->hydrate(
            Goal::with(['contributions' => fn ($q) => $q->limit(50), ...self::PEOPLE])->get()
        )->sortBy([
            fn ($a, $b) => ($a->completed_at !== null) <=> ($b->completed_at !== null),
            fn ($a, $b) => ($a->deadline?->timestamp ?? PHP_INT_MAX) <=> ($b->deadline?->timestamp ?? PHP_INT_MAX),
        ])->values();

        $money = $goals->where('kind', Goal::KIND_MONEY);

        return response()->json([
            'data' => $goals,
            'summary' => [
                'target' => round($money->sum('target_amount'), 2),
                'saved' => round($money->sum('current_amount'), 2),
                'completed' => $goals->whereNotNull('completed_at')->count(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        [$data, $investmentIds, $memberIds] = $this->validated($request);
        $goal = DB::transaction(function () use ($data, $investmentIds, $memberIds) {
            $goal = Goal::create(['current_amount' => 0, ...array_filter($data, fn ($v) => $v !== null)]);
            $this->linkInvestments($goal, $investmentIds ?? []);
            $goal->members()->sync($memberIds ?? []);

            return $goal;
        });
        $this->syncCompletion($goal);

        return response()->json(['data' => $this->present($goal)], 201);
    }

    public function update(Request $request, Goal $goal): JsonResponse
    {
        $this->ownerOnly($goal);
        [$data, $investmentIds, $memberIds] = $this->validated($request, $goal);
        DB::transaction(function () use ($goal, $data, $investmentIds, $memberIds) {
            $goal->update($data);
            if ($investmentIds !== null) {
                $this->linkInvestments($goal, $investmentIds);
            }
            if ($memberIds !== null) {
                $goal->members()->sync($memberIds);
                // Quem saiu da meta leva as caixinhas junto.
                Investment::withoutGlobalScopes()->where('goal_id', $goal->id)
                    ->whereNotIn('user_id', [$goal->user_id, ...$memberIds])->update(['goal_id' => null]);
            }
        });
        $this->syncCompletion($goal);

        return response()->json(['data' => $this->present($goal)]);
    }

    public function destroy(Goal $goal): JsonResponse
    {
        $this->ownerOnly($goal);
        // Os investimentos continuam existindo; só perdem o vínculo (nullOnDelete).
        $goal->delete();

        return response()->json(null, 204);
    }

    /** Meta de fazer algo: marca como feita ou desfaz. Quem participa também pode marcar. */
    public function toggle(Goal $goal): JsonResponse
    {
        abort_unless($goal->isTask(), 422, __('Só metas de fazer algo podem ser marcadas como feitas.'));
        $goal->update(['completed_at' => $goal->completed_at ? null : now()]);

        return response()->json(['data' => $this->present($goal)]);
    }

    /**
     * Minhas caixinhas nesta meta. Em metas de casal cada participante liga as suas,
     * e o "já guardado" é a soma de todas.
     */
    public function linkMine(Request $request, Goal $goal): JsonResponse
    {
        abort_if($goal->isTask(), 422, __('Esta meta não tem valor para depositar.'));
        $data = $request->validate([
            'investment_ids' => ['present', 'array'],
            'investment_ids.*' => ['integer', Rule::exists('investments', 'id')->where('user_id', $request->user()->id)],
        ]);
        // As consultas de investimento só enxergam os meus: as caixinhas dos outros ficam como estão.
        $this->linkInvestments($goal, array_map('intval', $data['investment_ids']));
        $this->syncCompletion($goal);

        return response()->json(['data' => $this->present($goal)]);
    }

    /** Depósito (valor positivo) ou retirada (valor negativo) na meta. */
    public function contribute(Request $request, Goal $goal, AlertService $alerts): JsonResponse
    {
        $this->ownerOnly($goal);
        abort_if($goal->isTask(), 422, __('Esta meta não tem valor para depositar.'));
        if ($goal->allInvestments()->exists()) {
            return response()->json([
                'message' => __('Esta meta está ligada a investimentos: aplique ou resgate na caixinha e a meta acompanha sozinha.'),
            ], 422);
        }

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'not_in:0'],
            'date' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:160'],
        ]);

        DB::transaction(function () use ($goal, $data) {
            $goal->contributions()->create([...$data, 'date' => $data['date'] ?? today()->toDateString()]);
            $goal->update(['current_amount' => max(0, round($goal->current_amount + $data['amount'], 2))]);
        });
        $this->syncCompletion($goal);
        $alerts->checkGoals($request->user());

        return response()->json(['data' => $this->present($goal, ['contributions'])]);
    }

    /** Participantes veem a meta, mas só o dono altera, exclui ou movimenta. */
    private function ownerOnly(Goal $goal): void
    {
        abort_unless($goal->is_owner, 403, __('Só quem criou a meta pode alterá-la.'));
    }

    private function present(Goal $goal, array $with = []): Goal
    {
        return $this->progress->hydrateOne($goal->fresh([...$with, ...self::PEOPLE]));
    }

    /** Define exatamente quais investimentos (de quem está logado) guardam dinheiro para a meta. */
    private function linkInvestments(Goal $goal, array $ids): void
    {
        Investment::where('goal_id', $goal->id)->whereNotIn('id', $ids)->update(['goal_id' => null]);
        if ($ids) {
            Investment::whereIn('id', $ids)->update(['goal_id' => $goal->id]);
        }
    }

    private function syncCompletion(Goal $goal): void
    {
        // Metas de fazer algo são marcadas na mão; as vinculadas, pelo GoalProgress (saldo das caixinhas).
        if ($goal->isTask() || $goal->allInvestments()->exists()) {
            return;
        }
        $done = $goal->current_amount >= $goal->target_amount;
        if ($done && ! $goal->completed_at) {
            $goal->update(['completed_at' => now()]);
        } elseif (! $done && $goal->completed_at) {
            $goal->update(['completed_at' => null]);
        }
    }

    /**
     * @return array{0: array, 1: ?array, 2: ?array} dados da meta, ids dos investimentos e dos
     *                                               participantes (null = não mexer)
     */
    private function validated(Request $request, ?Goal $goal = null): array
    {
        // O tipo é escolhido na criação e não muda depois.
        $kind = $goal?->kind ?? $request->input('kind', Goal::KIND_MONEY);
        $task = $kind === Goal::KIND_TASK;
        $me = $request->user()->id;

        $data = $request->validate([
            'kind' => ['nullable', Rule::in([Goal::KIND_MONEY, Goal::KIND_TASK])],
            'name' => ['required', 'string', 'max:80'],
            'target_amount' => $task ? ['nullable'] : ['required', 'numeric', 'gt:0'],
            'current_amount' => ['nullable', 'numeric', 'min:0'],
            'deadline' => ['nullable', 'date'],
            'color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'investment_ids' => ['nullable', 'array'],
            'investment_ids.*' => ['integer', Rule::exists('investments', 'id')->where('user_id', $me)],
            'member_ids' => ['nullable', 'array'],
            'member_ids.*' => ['integer', Rule::notIn([$me]), Rule::exists('users', 'id')->where('is_active', true)],
        ]);

        $ids = $request->has('investment_ids') ? array_map('intval', $data['investment_ids'] ?? []) : null;
        $members = $request->has('member_ids') ? array_values(array_unique(array_map('intval', $data['member_ids'] ?? []))) : null;
        unset($data['investment_ids'], $data['member_ids']);
        $data['kind'] = $kind;

        if ($task) {
            // Sem valor e sem caixinha: é só fazer e marcar.
            $data['target_amount'] = 0;
            unset($data['current_amount']);
            $ids = $goal ? [] : null;
        } elseif ($ids) {
            // Meta vinculada: o "já guardado" vem das caixinhas, não do formulário.
            unset($data['current_amount']);
        }

        return [$data, $ids, $members];
    }
}

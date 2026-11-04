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
    public function __construct(private GoalProgress $progress) {}

    public function index(): JsonResponse
    {
        $goals = $this->progress->hydrate(
            Goal::with(['contributions' => fn ($q) => $q->limit(50)])->get()
        )->sortBy([
            fn ($a, $b) => ($a->completed_at !== null) <=> ($b->completed_at !== null),
            fn ($a, $b) => ($a->deadline?->timestamp ?? PHP_INT_MAX) <=> ($b->deadline?->timestamp ?? PHP_INT_MAX),
        ])->values();

        return response()->json([
            'data' => $goals,
            'summary' => [
                'target' => round($goals->sum('target_amount'), 2),
                'saved' => round($goals->sum('current_amount'), 2),
                'completed' => $goals->whereNotNull('completed_at')->count(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        [$data, $investmentIds] = $this->validated($request);
        $goal = DB::transaction(function () use ($data, $investmentIds) {
            $goal = Goal::create(['current_amount' => 0, ...array_filter($data, fn ($v) => $v !== null)]);
            $this->linkInvestments($goal, $investmentIds);

            return $goal;
        });
        $this->syncCompletion($goal);

        return response()->json(['data' => $this->progress->hydrateOne($goal->fresh())], 201);
    }

    public function update(Request $request, Goal $goal): JsonResponse
    {
        [$data, $investmentIds] = $this->validated($request);
        DB::transaction(function () use ($goal, $data, $investmentIds) {
            $goal->update($data);
            if ($investmentIds !== null) {
                $this->linkInvestments($goal, $investmentIds);
            }
        });
        $this->syncCompletion($goal);

        return response()->json(['data' => $this->progress->hydrateOne($goal->fresh())]);
    }

    public function destroy(Goal $goal): JsonResponse
    {
        // Os investimentos continuam existindo; só perdem o vínculo (nullOnDelete).
        $goal->delete();

        return response()->json(null, 204);
    }

    /** Depósito (valor positivo) ou retirada (valor negativo) na meta. */
    public function contribute(Request $request, Goal $goal, AlertService $alerts): JsonResponse
    {
        if ($goal->investments()->exists()) {
            return response()->json([
                'message' => 'Esta meta está ligada a investimentos: aplique ou resgate na caixinha e a meta acompanha sozinha.',
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

        return response()->json(['data' => $this->progress->hydrateOne($goal->fresh('contributions'))]);
    }

    /** Define exatamente quais investimentos guardam dinheiro para a meta. */
    private function linkInvestments(Goal $goal, array $ids): void
    {
        Investment::where('goal_id', $goal->id)->whereNotIn('id', $ids)->update(['goal_id' => null]);
        if ($ids) {
            Investment::whereIn('id', $ids)->update(['goal_id' => $goal->id]);
        }
    }

    private function syncCompletion(Goal $goal): void
    {
        if ($goal->investments()->exists()) {
            return; // metas vinculadas são concluídas pelo GoalProgress, pelo saldo das caixinhas
        }
        $done = $goal->current_amount >= $goal->target_amount;
        if ($done && ! $goal->completed_at) {
            $goal->update(['completed_at' => now()]);
        } elseif (! $done && $goal->completed_at) {
            $goal->update(['completed_at' => null]);
        }
    }

    /** @return array{0: array, 1: ?array} dados da meta e ids dos investimentos (null = não mexer) */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'target_amount' => ['required', 'numeric', 'gt:0'],
            'current_amount' => ['nullable', 'numeric', 'min:0'],
            'deadline' => ['nullable', 'date'],
            'color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'investment_ids' => ['nullable', 'array'],
            'investment_ids.*' => ['integer', Rule::exists('investments', 'id')->where('user_id', $request->user()->id)],
        ]);

        $ids = $request->has('investment_ids') ? array_map('intval', $data['investment_ids'] ?? []) : null;
        unset($data['investment_ids']);
        // Meta vinculada: o "já guardado" vem das caixinhas, não do formulário.
        if ($ids) {
            unset($data['current_amount']);
        }

        return [$data, $ids];
    }
}

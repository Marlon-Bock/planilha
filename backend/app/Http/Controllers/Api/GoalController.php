<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Goal;
use App\Services\AlertService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GoalController extends Controller
{
    public function index(): JsonResponse
    {
        $goals = Goal::with(['contributions' => fn ($q) => $q->limit(50)])
            ->orderByRaw('completed_at IS NOT NULL')->orderBy('deadline')->get();

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
        $goal = Goal::create(['current_amount' => 0, ...array_filter($this->validated($request), fn ($v) => $v !== null)]);
        $this->syncCompletion($goal);

        return response()->json(['data' => $goal], 201);
    }

    public function update(Request $request, Goal $goal): JsonResponse
    {
        $goal->update($this->validated($request));
        $this->syncCompletion($goal);

        return response()->json(['data' => $goal]);
    }

    public function destroy(Goal $goal): JsonResponse
    {
        $goal->delete();

        return response()->json(null, 204);
    }

    /** Depósito (valor positivo) ou retirada (valor negativo) na meta. */
    public function contribute(Request $request, Goal $goal, AlertService $alerts): JsonResponse
    {
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

        return response()->json(['data' => $goal->fresh('contributions')]);
    }

    private function syncCompletion(Goal $goal): void
    {
        $done = $goal->current_amount >= $goal->target_amount;
        if ($done && ! $goal->completed_at) {
            $goal->update(['completed_at' => now()]);
        } elseif (! $done && $goal->completed_at) {
            $goal->update(['completed_at' => null]);
        }
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'target_amount' => ['required', 'numeric', 'gt:0'],
            'current_amount' => ['nullable', 'numeric', 'min:0'],
            'deadline' => ['nullable', 'date'],
            'color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use App\Models\Transaction;
use App\Services\AlertService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BudgetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $month = $this->month($request);

        return response()->json(self::forMonth($month));
    }

    /** Orçamentos do mês com o quanto já foi gasto em cada categoria. */
    public static function forMonth(string $month): array
    {
        [$start, $end] = Transaction::monthRange($month);

        $spent = Transaction::query()->where('type', 'expense')->whereBetween('date', [$start, $end])
            ->selectRaw('category_id, SUM(amount) as total, SUM(CASE WHEN is_paid = 1 THEN amount ELSE 0 END) as paid')
            ->groupBy('category_id')->get()->keyBy('category_id');

        $budgets = Budget::with('category:id,name,color,icon')->where('month', $month)->get()
            ->map(function (Budget $b) use ($spent) {
                $total = round((float) ($spent[$b->category_id]->total ?? 0), 2);

                return [
                    'id' => $b->id,
                    'month' => $b->month,
                    'amount' => $b->amount,
                    'category_id' => $b->category_id,
                    'category' => $b->category,
                    'spent' => $total,
                    'paid' => round((float) ($spent[$b->category_id]->paid ?? 0), 2),
                    'remaining' => round($b->amount - $total, 2),
                    'percent' => $b->amount > 0 ? round($total / $b->amount * 100, 1) : 0,
                ];
            })->sortByDesc('percent')->values();

        return [
            'month' => $month,
            'data' => $budgets,
            'summary' => [
                'budgeted' => round($budgets->sum('amount'), 2),
                'spent' => round($budgets->sum('spent'), 2),
                'remaining' => round($budgets->sum('amount') - $budgets->sum('spent'), 2),
                'over_count' => $budgets->where('percent', '>=', 100)->count(),
            ],
        ];
    }

    public function store(Request $request, AlertService $alerts): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['required', Rule::exists('categories', 'id')->where('user_id', $request->user()->id)->where('type', 'expense')],
            'month' => ['required', 'date_format:Y-m'],
            'amount' => ['required', 'numeric', 'gt:0'],
        ]);

        $budget = Budget::updateOrCreate(
            ['category_id' => $data['category_id'], 'month' => $data['month'], 'user_id' => $request->user()->id],
            ['amount' => $data['amount']],
        );
        $alerts->checkBudgets($request->user(), $data['month']);

        return response()->json(['data' => $budget], 201);
    }

    public function update(Request $request, Budget $budget): JsonResponse
    {
        $budget->update($request->validate(['amount' => ['required', 'numeric', 'gt:0']]));

        return response()->json(['data' => $budget]);
    }

    public function destroy(Budget $budget): JsonResponse
    {
        $budget->delete();

        return response()->json(null, 204);
    }

    /** Copia os orçamentos do mês anterior (ou de `from`) para o mês informado. */
    public function copy(Request $request): JsonResponse
    {
        $month = $this->month($request);
        $from = $request->input('from', Carbon::createFromFormat('Y-m-d', $month.'-01')->subMonth()->format('Y-m'));
        $copied = 0;

        foreach (Budget::where('month', $from)->get() as $b) {
            $new = Budget::firstOrCreate(
                ['user_id' => $b->user_id, 'category_id' => $b->category_id, 'month' => $month],
                ['amount' => $b->amount],
            );
            $copied += (int) $new->wasRecentlyCreated;
        }

        return response()->json(['copied' => $copied]);
    }

    private function month(Request $request): string
    {
        $request->validate(['month' => ['nullable', 'date_format:Y-m']]);

        return $request->input('month', now()->format('Y-m'));
    }
}

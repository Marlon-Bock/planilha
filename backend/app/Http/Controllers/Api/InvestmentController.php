<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Goal;
use App\Models\Investment;
use App\Models\InvestmentMovement;
use App\Models\Transaction;
use App\Services\AlertService;
use App\Services\GoalProgress;
use App\Services\InvestmentCalculator;
use App\Services\MarketRates;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InvestmentController extends Controller
{
    public function __construct(private InvestmentCalculator $calc, private MarketRates $rates, private GoalProgress $goalProgress) {}

    public function index(Request $request): JsonResponse
    {
        $investments = Investment::with(['movements', 'goal:id,name'])
            ->when(! $request->boolean('with_inactive'), fn ($q) => $q->where('is_active', true))
            ->orderBy('name')->get();
        $presented = $investments->map(fn ($i) => $this->calc->present($i));

        return response()->json([
            'data' => $presented->sortByDesc('balance')->values(),
            'summary' => $this->calc->summarize($presented),
            'evolution' => $this->calc->evolution($investments),
            'rates' => $this->rates->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $extra = $request->validate([
            'invested_amount' => ['nullable', 'numeric', 'min:0'],
            'current_balance' => ['nullable', 'numeric', 'min:0'],
            'start_date' => ['nullable', 'date', 'before_or_equal:today'],
        ]);

        $investment = DB::transaction(function () use ($data, $extra) {
            $investment = Investment::create($data);
            $invested = (float) ($extra['invested_amount'] ?? 0);
            $balance = isset($extra['current_balance']) ? (float) $extra['current_balance'] : null;
            $start = $extra['start_date'] ?? today()->toDateString();

            // Só o saldo: considera que tudo foi aportado (rendimento começa a contar agora).
            if ($invested <= 0 && $balance) {
                $invested = $balance;
            }
            if ($invested > 0) {
                $investment->movements()->create(['type' => 'deposit', 'amount' => $invested, 'date' => $start, 'note' => 'Valor investido até o cadastro']);
            }
            if ($balance !== null && $balance > 0) {
                $investment->movements()->create(['type' => 'balance', 'amount' => $balance, 'date' => today(), 'note' => 'Saldo no cadastro', 'is_opening' => true]);
            }

            return $investment;
        });

        return response()->json(['data' => $this->calc->present($investment->load('movements'))], 201);
    }

    public function update(Request $request, Investment $investment): JsonResponse
    {
        $investment->update($this->validated($request));

        return response()->json(['data' => $this->calc->present($investment->load('movements'))]);
    }

    public function destroy(Investment $investment): JsonResponse
    {
        $investment->delete();

        return response()->json(null, 204);
    }

    public function movements(Investment $investment): JsonResponse
    {
        return response()->json([
            'data' => $investment->movements()->with('account:id,name,color')->orderByDesc('date')->orderByDesc('id')->get(),
        ]);
    }

    /** Extrato de todas as aplicações, resgates e atualizações de saldo, com filtros e totais. */
    public function allMovements(Request $request): JsonResponse
    {
        $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date'], 'type' => ['nullable', Rule::in(InvestmentMovement::TYPES)]]);
        $ids = Investment::query()->pluck('id'); // só investimentos do usuário (escopo global)

        $query = InvestmentMovement::query()->whereIn('investment_id', $ids)
            ->when($request->integer('investment_id'), fn ($q, $v) => $q->where('investment_id', $v))
            ->when($request->integer('account_id'), fn ($q, $v) => $q->where('account_id', $v))
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->input('type')))
            ->when($request->filled('from'), fn ($q) => $q->where('date', '>=', $request->date('from')->toDateString()))
            ->when($request->filled('to'), fn ($q) => $q->where('date', '<=', $request->date('to')->toDateString()));

        $totals = (clone $query)->toBase()->selectRaw("
            COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) AS deposits,
            COALESCE(SUM(CASE WHEN type = 'withdraw' THEN amount ELSE 0 END), 0) AS withdrawals,
            COUNT(*) AS count")->first();

        $page = $query->with(['investment:id,name,institution,color', 'account:id,name,color'])
            ->orderByDesc('date')->orderByDesc('id')->paginate(min(max($request->integer('per_page', 30), 10), 200));

        return response()->json([
            'data' => $page->items(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
            'totals' => [
                'deposits' => round((float) $totals->deposits, 2),
                'withdrawals' => round((float) $totals->withdrawals, 2),
                'net' => round((float) $totals->deposits - (float) $totals->withdrawals, 2),
                'count' => (int) $totals->count,
            ],
        ]);
    }

    public function storeMovement(Request $request, Investment $investment, AlertService $alerts): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(InvestmentMovement::TYPES)],
            'amount' => ['required', 'numeric', 'min:0', 'max:999999999'],
            'date' => ['required', 'date', 'before_or_equal:today'],
            'note' => ['nullable', 'string', 'max:160'],
            // Conta de onde sai (aplicação) ou para onde volta (resgate). Opcional.
            'account_id' => ['nullable', 'prohibited_if:type,balance', Rule::exists('accounts', 'id')->where('user_id', $request->user()->id)],
        ], ['date.before_or_equal' => __('A data não pode ser no futuro.')]);

        if ($data['type'] !== 'balance' && $data['amount'] <= 0) {
            return response()->json(['message' => __('Informe um valor maior que zero.'), 'errors' => ['amount' => [__('Informe um valor maior que zero.')]]], 422);
        }

        DB::transaction(function () use ($investment, $data) {
            $movement = $investment->movements()->create($data);

            // Aplicação/resgate ligado a uma conta: gera o lançamento que mexe no saldo dela.
            if (! empty($data['account_id'])) {
                $deposit = $data['type'] === 'deposit';
                $tx = Transaction::create([
                    'account_id' => $data['account_id'],
                    'investment_id' => $investment->id,
                    'type' => $deposit ? 'invest' : 'redeem',
                    'description' => ($deposit ? 'Aplicação em ' : 'Resgate de ').$investment->name,
                    'amount' => $data['amount'],
                    'date' => $data['date'],
                    'is_paid' => true,
                    'paid_at' => $data['date'],
                    'payment_method' => 'transfer',
                    'notes' => $data['note'] ?? null,
                ]);
                $movement->update(['transaction_id' => $tx->id]);
            }
        });

        // Caixinha ligada a uma meta: atualiza a meta e avisa se ela acabou de ser concluída.
        $goalCompleted = null;
        if ($investment->goal_id && ($goal = Goal::find($investment->goal_id))) {
            $wasDone = (bool) $goal->completed_at;
            $goal = $this->goalProgress->hydrateOne($goal);
            if (! $wasDone && $goal->completed_at) {
                $goalCompleted = $goal->name;
                $alerts->checkGoals($request->user());
            }
        }

        return response()->json([
            'data' => $this->calc->present($investment->load(['movements', 'goal:id,name'])),
            'goal_completed' => $goalCompleted,
        ], 201);
    }

    public function destroyMovement(Investment $investment, InvestmentMovement $movement): JsonResponse
    {
        abort_unless($movement->investment_id === $investment->id, 404);
        DB::transaction(function () use ($movement) {
            // Desfaz também o efeito no saldo da conta.
            Transaction::whereKey($movement->transaction_id)->delete();
            $movement->delete();
        });

        return response()->json(['data' => $this->calc->present($investment->load('movements'))]);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'institution' => ['nullable', 'string', 'max:60'],
            'type' => ['required', Rule::in(Investment::TYPES)],
            'rate_type' => ['required', Rule::in(Investment::RATE_TYPES)],
            'rate' => ['nullable', 'numeric', 'min:0', 'max:1000', Rule::requiredIf(in_array($request->input('rate_type'), ['cdi', 'prefixed'], true))],
            'liquidity' => ['required', Rule::in(['daily', 'maturity'])],
            'maturity_date' => ['nullable', 'date'],
            'color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'is_active' => ['boolean'],
            'goal_id' => ['nullable', 'integer', fn (string $attribute, mixed $value, \Closure $fail) => Goal::whereKey($value)->where('kind', Goal::KIND_MONEY)->exists() || $fail(__('validation.exists', ['attribute' => 'meta']))],
            'notes' => ['nullable', 'string', 'max:2000'],
        ], ['rate.required' => __('Informe a taxa (ex.: 100 para 100% do CDI).')]);

        if (in_array($data['rate_type'], ['poupanca', 'variable'], true)) {
            $data['rate'] = null;
        }

        return $data;
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InvestmentMovement;
use App\Models\Transaction;
use App\Services\AlertService;
use App\Support\TransactionFilter;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TransactionController extends Controller
{
    private const RELATIONS = ['account:id,name,color,type', 'transferAccount:id,name,color', 'category:id,name,color,icon,type', 'tags:id,name,color', 'investment:id,name,color'];

    public function __construct(private AlertService $alerts) {}

    public function index(Request $request): JsonResponse
    {
        $query = TransactionFilter::apply(Transaction::query(), $request);
        $totals = TransactionFilter::totals($query);

        $page = TransactionFilter::sort($query->with(self::RELATIONS), $request)
            ->paginate(min(max($request->integer('per_page', 50), 10), 500));

        return response()->json([
            'data' => $page->items(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
            'totals' => $totals,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['installments'] = $request->validate([
            'installments' => ['nullable', 'integer', 'between:1,120'],
        ])['installments'] ?? 1;
        $splitMode = $request->input('installment_mode', 'split'); // split = valor total dividido | repeat = valor por parcela

        $created = DB::transaction(function () use ($data, $request, $splitMode) {
            $n = $data['installments'];
            unset($data['installments']);
            $tagIds = $data['tag_ids'] ?? [];
            unset($data['tag_ids']);

            if ($n <= 1) {
                $t = Transaction::create($data);
                $t->tags()->sync($tagIds);

                return collect([$t]);
            }

            $group = (string) Str::uuid();
            $base = Carbon::parse($data['date']);
            $total = (float) $data['amount'];
            $each = $splitMode === 'repeat' ? $total : floor($total / $n * 100) / 100;
            $items = collect();

            for ($i = 1; $i <= $n; $i++) {
                $amount = $splitMode === 'repeat' || $i < $n ? $each : round($total - $each * ($n - 1), 2);
                $date = $base->copy()->addMonthsNoOverflow($i - 1);
                $isPaid = $i === 1 ? ($data['is_paid'] ?? false) : false;
                $t = Transaction::create([
                    ...$data,
                    'amount' => $amount,
                    'date' => $date->toDateString(),
                    'is_paid' => $isPaid,
                    'paid_at' => $isPaid ? ($data['paid_at'] ?? today()->toDateString()) : null,
                    'installment_group' => $group,
                    'installment_number' => $i,
                    'installment_total' => $n,
                ]);
                $t->tags()->sync($tagIds);
                $items->push($t);
            }

            return $items;
        });

        $this->afterChange($request, $created->first());

        return response()->json([
            'data' => $created->first()->load(self::RELATIONS),
            'created' => $created->count(),
        ], 201);
    }

    public function show(Transaction $transaction): JsonResponse
    {
        $transaction->load([...self::RELATIONS, 'recurring:id,description,frequency']);
        $siblings = $transaction->installment_group
            ? Transaction::where('installment_group', $transaction->installment_group)
                ->orderBy('installment_number')->get(['id', 'amount', 'date', 'is_paid', 'installment_number', 'installment_total'])
            : [];

        return response()->json(['data' => $transaction, 'installments' => $siblings]);
    }

    /** Aplicações/resgates são controlados pela tela de investimentos. */
    private function guardInvestment(Transaction $t): ?JsonResponse
    {
        return $t->isInvestmentLinked()
            ? response()->json(['message' => __('Aplicações e resgates são editados na tela de Investimentos.')], 422)
            : null;
    }

    /** Ao excluir aplicações/resgates por aqui, a movimentação do investimento vai junto. */
    private function deleteLinkedMovements(array $transactionIds): void
    {
        InvestmentMovement::whereIn('transaction_id', $transactionIds)->delete();
    }

    public function update(Request $request, Transaction $transaction): JsonResponse
    {
        if ($blocked = $this->guardInvestment($transaction)) {
            return $blocked;
        }
        $data = $this->validated($request);
        $applyTo = $request->input('apply_to', 'this'); // this | future | all
        $tagIds = $data['tag_ids'] ?? null;
        unset($data['tag_ids']);

        DB::transaction(function () use ($transaction, $data, $applyTo, $tagIds) {
            $transaction->update($data);
            if ($tagIds !== null) {
                $transaction->tags()->sync($tagIds);
            }

            if ($transaction->installment_group && $applyTo !== 'this') {
                // Campos compartilhados entre parcelas (data e status ficam por parcela).
                $shared = collect($data)->only(['description', 'account_id', 'category_id', 'amount', 'payment_method', 'notes'])->all();
                $others = Transaction::where('installment_group', $transaction->installment_group)
                    ->where('id', '!=', $transaction->id)
                    ->when($applyTo === 'future', fn ($q) => $q->where('installment_number', '>', $transaction->installment_number))
                    ->get();
                foreach ($others as $other) {
                    $other->update($shared);
                    if ($tagIds !== null) {
                        $other->tags()->sync($tagIds);
                    }
                }
            }
        });

        $this->afterChange($request, $transaction);

        return response()->json(['data' => $transaction->fresh(self::RELATIONS)]);
    }

    public function destroy(Request $request, Transaction $transaction): JsonResponse
    {
        $scope = $request->input('scope', 'this');

        if ($transaction->installment_group && $scope !== 'this') {
            $deleted = Transaction::where('installment_group', $transaction->installment_group)
                ->when($scope === 'future', fn ($q) => $q->where('installment_number', '>=', $transaction->installment_number))
                ->delete();
        } else {
            DB::transaction(function () use ($transaction) {
                $this->deleteLinkedMovements([$transaction->id]);
                $transaction->delete();
            });
            $deleted = 1;
        }

        return response()->json(['deleted' => $deleted]);
    }

    public function togglePaid(Request $request, Transaction $transaction): JsonResponse
    {
        if ($blocked = $this->guardInvestment($transaction)) {
            return $blocked;
        }
        $paid = $request->has('is_paid') ? $request->boolean('is_paid') : ! $transaction->is_paid;
        $transaction->update([
            'is_paid' => $paid,
            'paid_at' => $paid ? ($request->date('paid_at')?->toDateString() ?? today()->toDateString()) : null,
        ]);

        return response()->json(['data' => $transaction->fresh(self::RELATIONS)]);
    }

    public function duplicate(Request $request, Transaction $transaction): JsonResponse
    {
        if ($blocked = $this->guardInvestment($transaction)) {
            return $blocked;
        }
        $copy = $transaction->replicate(['installment_group', 'installment_number', 'installment_total', 'recurring_transaction_id']);
        $copy->is_paid = false;
        $copy->paid_at = null;
        $copy->date = $request->date('date') ?? $transaction->date->copy()->addMonthNoOverflow();
        $copy->save();
        $copy->tags()->sync($transaction->tags()->pluck('tags.id'));

        return response()->json(['data' => $copy->load(self::RELATIONS)], 201);
    }

    public function bulk(Request $request): JsonResponse
    {
        $uid = $request->user()->id;
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:1000'],
            'ids.*' => ['integer'],
            'action' => ['required', Rule::in(['pay', 'unpay', 'delete', 'category', 'account', 'date'])],
            'category_id' => ['required_if:action,category', 'nullable', Rule::exists('categories', 'id')->where('user_id', $uid)],
            'account_id' => ['required_if:action,account', 'nullable', Rule::exists('accounts', 'id')->where('user_id', $uid)],
            'date' => ['required_if:action,date', 'nullable', 'date'],
        ]);

        $query = Transaction::whereIn('id', $data['ids']);
        // Aplicações/resgates só podem ser excluídos em massa; o resto é controlado pelo investimento.
        if ($data['action'] !== 'delete') {
            $query->whereNotIn('type', Transaction::INVESTMENT_TYPES);
        }

        $affected = match ($data['action']) {
            'pay' => $query->where('is_paid', false)->update(['is_paid' => true, 'paid_at' => today()->toDateString()]),
            'unpay' => $query->update(['is_paid' => false, 'paid_at' => null]),
            'delete' => DB::transaction(function () use ($query) {
                $this->deleteLinkedMovements((clone $query)->pluck('id')->all());

                return $query->delete();
            }),
            'category' => $query->where('type', '!=', 'transfer')->update(['category_id' => $data['category_id']]),
            'account' => $query->update(['account_id' => $data['account_id']]),
            'date' => $query->update(['date' => Carbon::parse($data['date'])->toDateString()]),
        };

        return response()->json(['affected' => $affected]);
    }

    public function export(Request $request): StreamedResponse
    {
        $query = TransactionFilter::sort(TransactionFilter::apply(Transaction::query(), $request), $request)
            ->with(self::RELATIONS);

        $types = ['income' => 'Receita', 'expense' => 'Despesa', 'transfer' => 'Transferência', 'invest' => 'Aplicação', 'redeem' => 'Resgate'];
        $status = ['paid' => 'Pago', 'pending' => 'Pendente', 'overdue' => 'Vencido'];
        $filename = 'lancamentos-'.now()->format('Y-m-d-His').'.csv';

        return response()->streamDownload(function () use ($query, $types, $status) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM para o Excel reconhecer UTF-8
            fputcsv($out, ['Data', 'Descrição', 'Tipo', 'Categoria', 'Conta', 'Conta destino', 'Valor', 'Status', 'Pago em', 'Forma de pagamento', 'Parcela', 'Tags', 'Observações'], ';');
            $query->chunk(500, function ($rows) use ($out, $types, $status) {
                foreach ($rows as $t) {
                    fputcsv($out, [
                        $t->date->format('d/m/Y'),
                        $t->description,
                        $types[$t->type] ?? $t->type,
                        $t->category?->name,
                        $t->account?->name,
                        $t->transferAccount?->name,
                        number_format($t->type === 'expense' ? -$t->amount : $t->amount, 2, ',', ''),
                        $status[$t->status],
                        $t->paid_at?->format('d/m/Y'),
                        $t->payment_method,
                        $t->installment_total ? "{$t->installment_number}/{$t->installment_total}" : '',
                        $t->tags->pluck('name')->join(', '),
                        $t->notes,
                    ], ';');
                }
            });
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function validated(Request $request): array
    {
        $uid = $request->user()->id;
        $data = $request->validate([
            'type' => ['required', Rule::in(Transaction::TYPES)],
            'description' => ['required', 'string', 'max:160'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:999999999'],
            'date' => ['required', 'date'],
            'account_id' => ['required', Rule::exists('accounts', 'id')->where('user_id', $uid)],
            'transfer_account_id' => ['nullable', 'required_if:type,transfer', 'different:account_id', Rule::exists('accounts', 'id')->where('user_id', $uid)],
            'category_id' => ['nullable', Rule::exists('categories', 'id')->where('user_id', $uid)],
            'is_paid' => ['boolean'],
            'paid_at' => ['nullable', 'date'],
            'payment_method' => ['nullable', Rule::in(Transaction::PAYMENT_METHODS)],
            'notes' => ['nullable', 'string', 'max:2000'],
            'tag_ids' => ['nullable', 'array'],
            'tag_ids.*' => ['integer', Rule::exists('tags', 'id')->where('user_id', $uid)],
        ], [
            'transfer_account_id.required_if' => __('Escolha a conta de destino da transferência.'),
            'transfer_account_id.different' => __('A conta de destino deve ser diferente da conta de origem.'),
        ]);

        if ($data['type'] === 'transfer') {
            $data['category_id'] = null;
        } else {
            $data['transfer_account_id'] = null;
        }
        $data['is_paid'] = (bool) ($data['is_paid'] ?? false);
        $data['paid_at'] = $data['is_paid'] ? ($data['paid_at'] ?? today()->toDateString()) : null;

        return $data;
    }

    private function afterChange(Request $request, Transaction $t): void
    {
        if ($t->type === 'expense' && $t->category_id) {
            $this->alerts->checkBudgets($request->user(), $t->date->format('Y-m'));
        }
    }
}

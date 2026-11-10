<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Budget;
use App\Models\Goal;
use App\Models\Transaction;
use App\Models\User;
use App\Notifications\FinanceAlert;
use Illuminate\Support\Number;

class AlertService
{
    public function notifyOnce(User $user, string $key, string $kind, string $level, string $title, string $message, ?string $link = null): bool
    {
        if ($user->notifications()->where('data->key', $key)->exists()) {
            return false;
        }

        $user->notify(new FinanceAlert($key, $kind, $level, $title, $message, $link));

        return true;
    }

    /** Roda todas as verificações para o usuário. Retorna quantos avisos novos foram criados. */
    public function checkAll(User $user): int
    {
        return $this->checkBills($user)
            + $this->checkBudgets($user, now()->format('Y-m'))
            + $this->checkGoals($user)
            + $this->checkNegativeBalances($user);
    }

    public function checkBills(User $user): int
    {
        $count = 0;
        $limit = today()->addDays($user->alert_days_before)->toDateString();

        $pending = Transaction::withoutGlobalScopes()
            ->where('user_id', $user->id)
            ->where('type', 'expense')
            ->where('is_paid', false)
            ->where('date', '<=', $limit)
            ->where('date', '>=', today()->subDays(60)->toDateString())
            ->orderBy('date')
            ->get();

        foreach ($pending as $t) {
            $value = $this->money($t->amount, $user);
            $date = $t->date->format('d/m/Y');

            if ($t->date->lt(today())) {
                $count += (int) $this->notifyOnce($user, "overdue:{$t->id}", 'bill_overdue', 'danger',
                    'Conta vencida', "\"{$t->description}\" ({$value}) venceu em {$date} e ainda não foi paga.",
                    '/transacoes?status=overdue');
            } else {
                $when = $t->date->isToday() ? 'vence hoje' : 'vence em '.$date;
                $count += (int) $this->notifyOnce($user, "due:{$t->id}", 'bill_due', 'warning',
                    'Conta a vencer', "\"{$t->description}\" ({$value}) {$when}.",
                    '/transacoes?status=pending');
            }
        }

        return $count;
    }

    public function checkBudgets(User $user, string $month): int
    {
        $count = 0;
        [$start, $end] = Transaction::monthRange($month);

        $budgets = Budget::withoutGlobalScopes()->with(['category' => fn ($q) => $q->withoutGlobalScopes()])
            ->where('user_id', $user->id)->where('month', $month)->get();

        foreach ($budgets as $budget) {
            if ($budget->amount <= 0 || ! $budget->category) {
                continue;
            }
            $spent = (float) Transaction::withoutGlobalScopes()
                ->where('user_id', $user->id)->where('type', 'expense')
                ->where('category_id', $budget->category_id)
                ->whereBetween('date', [$start, $end])->sum('amount');

            $pct = $spent / $budget->amount * 100;
            $name = $budget->category->name;

            if ($pct >= 100) {
                $count += (int) $this->notifyOnce($user, "budget100:{$budget->id}", 'budget_exceeded', 'danger',
                    'Orçamento estourado', "Você já gastou {$this->money($spent, $user)} em {$name}, acima do limite de {$this->money($budget->amount, $user)}.",
                    '/orcamentos');
            } elseif ($pct >= 80) {
                $count += (int) $this->notifyOnce($user, "budget80:{$budget->id}", 'budget_warning', 'warning',
                    'Orçamento quase no limite', sprintf('Você já usou %d%% do orçamento de %s.', $pct, $name),
                    '/orcamentos');
            }
        }

        return $count;
    }

    public function checkGoals(User $user): int
    {
        $count = 0;
        // Metas ligadas a caixinhas: atualiza o "já guardado" com o saldo de hoje antes de conferir.
        app(GoalProgress::class)->hydrate(Goal::withoutGlobalScopes()->where('user_id', $user->id)->get());
        $goals = Goal::withoutGlobalScopes()->where('user_id', $user->id)
            ->where('kind', Goal::KIND_MONEY)
            ->whereColumn('current_amount', '>=', 'target_amount')->get();

        foreach ($goals as $goal) {
            $count += (int) $this->notifyOnce($user, "goal:{$goal->id}", 'goal_reached', 'success',
                'Meta atingida! 🎉', "Parabéns! Você atingiu a meta \"{$goal->name}\".", '/metas');
        }

        return $count;
    }

    public function checkNegativeBalances(User $user): int
    {
        $count = 0;
        $accounts = Account::withoutGlobalScopes()->withBalance()
            ->where('accounts.user_id', $user->id)->where('is_archived', false)
            ->where('type', '!=', 'credit_card')->get();

        foreach ($accounts as $account) {
            if ($account->balance < 0) {
                $count += (int) $this->notifyOnce($user, 'negative:'.$account->id.':'.now()->format('Y-m-d'), 'negative_balance', 'danger',
                    'Saldo negativo', "A conta \"{$account->name}\" está com saldo de {$this->money($account->balance, $user)}.",
                    '/contas');
            }
        }

        return $count;
    }

    private function money(float $value, User $user): string
    {
        return Number::currency($value, in: $user->currency ?: 'BRL', locale: 'pt_BR');
    }
}

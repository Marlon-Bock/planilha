<?php

namespace Database\Seeders;

use App\Http\Controllers\Api\AuthController;
use App\Models\Account;
use App\Models\Budget;
use App\Models\Category;
use App\Models\Goal;
use App\Models\RecurringTransaction;
use App\Models\Tag;
use App\Models\Transaction;
use App\Models\User;
use App\Services\AlertService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::create([
            'name' => 'Administrador', 'email' => 'admin@planilha.test',
            'password' => 'senha123', 'role' => User::ROLE_ADMIN, 'email_verified_at' => now(),
        ]);
        AuthController::bootstrapUser($admin);

        $user = User::create([
            'name' => 'Usuário Demo', 'email' => 'demo@planilha.test',
            'password' => 'senha123', 'email_verified_at' => now(),
        ]);
        AuthController::bootstrapUser($user);

        $this->seedDemo($user);
        app(AlertService::class)->checkAll($user);
    }

    private function seedDemo(User $user): void
    {
        $uid = $user->id;
        $cat = Category::withoutGlobalScopes()->where('user_id', $uid)->pluck('id', 'name');

        $nubank = Account::create(['user_id' => $uid, 'name' => 'Nubank', 'type' => 'checking', 'initial_balance' => 2500, 'color' => '#8b5cf6']);
        $itau = Account::create(['user_id' => $uid, 'name' => 'Itaú', 'type' => 'checking', 'initial_balance' => 1200, 'color' => '#f97316']);
        $poupanca = Account::create(['user_id' => $uid, 'name' => 'Poupança', 'type' => 'savings', 'initial_balance' => 8000, 'color' => '#0ea5e9']);
        $cartao = Account::create(['user_id' => $uid, 'name' => 'Cartão Nubank', 'type' => 'credit_card', 'credit_limit' => 6000, 'closing_day' => 3, 'due_day' => 10, 'color' => '#a855f7']);

        $tags = collect(['Essencial' => '#ef4444', 'Família' => '#f59e0b', 'Viagem' => '#0ea5e9', 'Trabalho' => '#10b981'])
            ->map(fn ($color, $name) => Tag::create(['user_id' => $uid, 'name' => $name, 'color' => $color]));

        // Recorrências (geram contas fixas automaticamente).
        $start = today()->subMonths(5)->startOfMonth();
        $recurrings = [
            ['income', 'Salário', 7200, 'Salário', $nubank, 5, true, 'transfer'],
            ['expense', 'Aluguel', 1850, 'Moradia', $itau, 10, false, 'boleto'],
            ['expense', 'Condomínio', 420, 'Moradia', $itau, 10, false, 'boleto'],
            ['expense', 'Internet', 119.90, 'Contas e serviços', $nubank, 15, false, 'debit'],
            ['expense', 'Energia elétrica', 230, 'Contas e serviços', $nubank, 20, false, 'pix'],
            ['expense', 'Netflix', 55.90, 'Assinaturas', $cartao, 8, false, 'credit'],
            ['expense', 'Spotify', 21.90, 'Assinaturas', $cartao, 12, false, 'credit'],
            ['expense', 'Academia', 99.90, 'Saúde', $nubank, 5, false, 'debit'],
            ['expense', 'Plano de saúde', 480, 'Saúde', $itau, 25, false, 'boleto'],
        ];
        foreach ($recurrings as [$type, $desc, $amount, $catName, $account, $day, $autoPaid, $method]) {
            $r = RecurringTransaction::create([
                'user_id' => $uid, 'account_id' => $account->id, 'category_id' => $cat[$catName], 'type' => $type,
                'description' => $desc, 'amount' => $amount, 'frequency' => 'monthly',
                'start_date' => $start->copy()->day($day), 'next_date' => $start->copy()->day($day),
                'payment_method' => $method, 'auto_paid' => $autoPaid,
            ]);
            $r->generateUntil(today()->addMonthNoOverflow()->endOfMonth());
        }
        // Marca como pagas as contas fixas de meses anteriores (o usuário demo é organizado).
        Transaction::withoutGlobalScopes()->where('user_id', $uid)->where('date', '<', today()->startOfMonth())
            ->update(['is_paid' => true, 'paid_at' => \DB::raw('date')]);

        // Gastos variáveis.
        $variable = [
            ['Mercado', ['Supermercado', 'Feira', 'Atacadão', 'Hortifruti'], [80, 450], 5, [$nubank, $cartao], ['debit', 'credit', 'pix']],
            ['Alimentação', ['iFood', 'Restaurante', 'Padaria', 'Lanche'], [25, 160], 7, [$cartao, $nubank], ['credit', 'pix']],
            ['Transporte', ['Uber', 'Combustível', 'Estacionamento', '99'], [18, 250], 5, [$cartao, $nubank], ['credit', 'debit']],
            ['Lazer', ['Cinema', 'Bar', 'Show', 'Passeio'], [40, 300], 2, [$cartao], ['credit']],
            ['Compras', ['Roupas', 'Farmácia', 'Amazon', 'Presente'], [35, 400], 2, [$cartao], ['credit']],
            ['Saúde', ['Farmácia', 'Consulta'], [30, 250], 1, [$nubank], ['pix']],
        ];
        for ($m = 5; $m >= 0; $m--) {
            $month = today()->subMonths($m)->startOfMonth();
            $lastDay = $m === 0 ? today()->day : $month->daysInMonth;
            foreach ($variable as [$catName, $descs, [$min, $max], $times, $accounts, $methods]) {
                for ($i = 0; $i < $times + random_int(0, 2); $i++) {
                    $t = Transaction::create([
                        'user_id' => $uid,
                        'account_id' => $accounts[array_rand($accounts)]->id,
                        'category_id' => $cat[$catName],
                        'type' => 'expense',
                        'description' => $descs[array_rand($descs)],
                        'amount' => random_int($min * 100, $max * 100) / 100,
                        'date' => $month->copy()->day(random_int(1, $lastDay)),
                        'is_paid' => true,
                        'payment_method' => $methods[array_rand($methods)],
                    ]);
                    $t->paid_at = $t->date;
                    $t->save();
                    if (random_int(1, 4) === 1) {
                        $t->tags()->attach($tags->random()->id);
                    }
                }
            }
            if (random_int(0, 1)) {
                Transaction::create([
                    'user_id' => $uid, 'account_id' => $itau->id, 'category_id' => $cat['Freelance'], 'type' => 'income',
                    'description' => 'Projeto freelance', 'amount' => random_int(800, 2500), 'date' => $month->copy()->day(min(18, $lastDay)),
                    'is_paid' => true, 'paid_at' => $month->copy()->day(min(18, $lastDay)), 'payment_method' => 'pix',
                ])->tags()->attach($tags['Trabalho']->id);
            }
            // Pagamento da fatura do cartão (transferência).
            if ($m > 0) {
                Transaction::create([
                    'user_id' => $uid, 'account_id' => $nubank->id, 'transfer_account_id' => $cartao->id, 'type' => 'transfer',
                    'description' => 'Pagamento fatura cartão', 'amount' => 1400 + random_int(0, 600),
                    'date' => $month->copy()->day(10), 'is_paid' => true, 'paid_at' => $month->copy()->day(10),
                ]);
            }
        }

        // Compra parcelada.
        $group = (string) Str::uuid();
        for ($i = 1; $i <= 10; $i++) {
            $date = today()->subMonths(3)->day(14)->addMonthsNoOverflow($i - 1);
            Transaction::create([
                'user_id' => $uid, 'account_id' => $cartao->id, 'category_id' => $cat['Compras'], 'type' => 'expense',
                'description' => 'Notebook', 'amount' => 389.90, 'date' => $date, 'is_paid' => $date->lt(today()),
                'paid_at' => $date->lt(today()) ? $date : null, 'payment_method' => 'credit',
                'installment_group' => $group, 'installment_number' => $i, 'installment_total' => 10,
            ]);
        }

        // Uma conta vencida para demonstrar os avisos.
        Transaction::create([
            'user_id' => $uid, 'account_id' => $itau->id, 'category_id' => $cat['Impostos e taxas'], 'type' => 'expense',
            'description' => 'IPVA - parcela', 'amount' => 612.40, 'date' => today()->subDays(4), 'payment_method' => 'boleto',
        ])->tags()->attach($tags['Essencial']->id);

        // Orçamentos do mês atual e anterior.
        foreach ([today()->subMonth()->format('Y-m'), today()->format('Y-m')] as $month) {
            foreach (['Mercado' => 1500, 'Alimentação' => 700, 'Transporte' => 600, 'Lazer' => 400, 'Compras' => 500, 'Assinaturas' => 100] as $catName => $amount) {
                Budget::create(['user_id' => $uid, 'category_id' => $cat[$catName], 'month' => $month, 'amount' => $amount]);
            }
        }

        // Metas.
        $goals = [
            ['Reserva de emergência', 30000, 12500, today()->addMonths(14), '#10b981'],
            ['Viagem de férias', 8000, 3200, today()->addMonths(7), '#0ea5e9'],
            ['Trocar de carro', 45000, 9000, today()->addMonths(30), '#f97316'],
        ];
        foreach ($goals as [$name, $target, $current, $deadline, $color]) {
            $goal = Goal::create(['user_id' => $uid, 'name' => $name, 'target_amount' => $target, 'current_amount' => $current, 'deadline' => $deadline, 'color' => $color]);
            $goal->contributions()->create(['amount' => $current, 'date' => today()->subMonths(2), 'note' => 'Saldo inicial']);
        }
    }
}

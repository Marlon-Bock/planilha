<?php

use App\Http\Controllers\Api\RecurringTransactionController;
use App\Models\RecurringTransaction;
use App\Models\User;
use App\Services\AlertService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('finance:generate-recurring', function () {
    $until = RecurringTransactionController::horizon();
    $total = 0;
    RecurringTransaction::withoutGlobalScopes()->where('is_active', true)->each(function ($r) use ($until, &$total) {
        $total += $r->generateUntil($until);
    });
    $this->info("{$total} lançamento(s) recorrente(s) gerado(s) até {$until->format('d/m/Y')}.");
})->purpose('Gera os lançamentos das transações recorrentes até o fim do próximo mês');

Artisan::command('finance:check-alerts', function (AlertService $alerts) {
    $total = 0;
    User::where('is_active', true)->each(function (User $user) use ($alerts, &$total) {
        $total += $alerts->checkAll($user);
    });
    $this->info("{$total} aviso(s) criado(s).");
})->purpose('Cria avisos de contas a vencer/vencidas, orçamentos estourados, metas e saldo negativo');

Schedule::command('finance:generate-recurring')->dailyAt('00:10');
Schedule::command('finance:check-alerts')->dailyAt('07:00');

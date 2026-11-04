<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Liga aplicações/resgates às contas bancárias: a aplicação vira um lançamento
 * "invest" (sai da conta) e o resgate um lançamento "redeem" (volta para a conta).
 * Esses lançamentos mexem no saldo das contas, mas não contam como receita/despesa.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            // Se o investimento for excluído, o lançamento fica (o dinheiro saiu da conta de verdade).
            $table->foreignId('investment_id')->nullable()->after('recurring_transaction_id')->constrained()->nullOnDelete();
        });

        Schema::table('investment_movements', function (Blueprint $table) {
            $table->foreignId('account_id')->nullable()->after('investment_id')->constrained()->nullOnDelete();
            $table->foreignId('transaction_id')->nullable()->after('account_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('investment_movements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('transaction_id');
            $table->dropConstrainedForeignId('account_id');
        });
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('investment_id');
        });
    }
};

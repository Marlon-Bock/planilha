<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('investments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('institution', 60)->nullable(); // Nubank, Inter...
            // caixinha | cdb | tesouro | lci_lca | poupanca | previdencia | acoes | fii | cripto | outro
            $table->string('type', 20)->default('caixinha');
            // cdi (% do CDI) | prefixed (% a.a.) | ipca (IPCA + % a.a.) | poupanca | variable (sem taxa: só saldo informado)
            $table->string('rate_type', 12)->default('cdi');
            $table->decimal('rate', 8, 4)->nullable();
            $table->string('liquidity', 10)->default('daily'); // daily | maturity
            $table->date('maturity_date')->nullable();
            $table->string('color', 9)->default('#8b5cf6');
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('investment_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('investment_id')->constrained()->cascadeOnDelete();
            // deposit (aporte) | withdraw (resgate) | balance (saldo informado pelo banco)
            $table->string('type', 10);
            $table->decimal('amount', 15, 2);
            $table->date('date');
            $table->string('note')->nullable();
            // Saldo informado no cadastro: o rendimento até ali entra no total, mas não no "rendeu este mês".
            $table->boolean('is_opening')->default(false);
            $table->timestamps();
            $table->index(['investment_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('investment_movements');
        Schema::dropIfExists('investments');
    }
};

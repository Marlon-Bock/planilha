<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            // checking | savings | cash | credit_card | investment | other
            $table->string('type', 20)->default('checking');
            $table->decimal('initial_balance', 15, 2)->default(0);
            $table->decimal('credit_limit', 15, 2)->nullable();
            $table->unsignedTinyInteger('closing_day')->nullable();
            $table->unsignedTinyInteger('due_day')->nullable();
            $table->string('color', 9)->default('#6366f1');
            $table->boolean('include_in_total')->default(true);
            $table->boolean('is_archived')->default(false);
            $table->timestamps();
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('type', 10); // income | expense
            $table->string('color', 9)->default('#64748b');
            $table->string('icon', 40)->default('tag');
            $table->boolean('is_archived')->default(false);
            $table->timestamps();
            $table->index(['user_id', 'type']);
        });

        Schema::create('tags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('color', 9)->default('#0ea5e9');
            $table->timestamps();
            $table->unique(['user_id', 'name']);
        });

        Schema::create('recurring_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 10); // income | expense
            $table->string('description');
            $table->decimal('amount', 15, 2);
            $table->string('frequency', 10)->default('monthly'); // weekly | monthly | yearly
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->date('next_date');
            $table->string('payment_method', 20)->nullable();
            $table->boolean('auto_paid')->default(false);
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('transfer_account_id')->nullable()->constrained('accounts')->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('recurring_transaction_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 10); // income | expense | transfer
            $table->string('description');
            $table->decimal('amount', 15, 2);
            $table->date('date'); // data / vencimento
            $table->boolean('is_paid')->default(false);
            $table->date('paid_at')->nullable();
            $table->string('payment_method', 20)->nullable();
            $table->uuid('installment_group')->nullable();
            $table->unsignedSmallInteger('installment_number')->nullable();
            $table->unsignedSmallInteger('installment_total')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'date']);
            $table->index(['user_id', 'is_paid', 'date']);
            $table->index('installment_group');
        });

        Schema::create('tag_transaction', function (Blueprint $table) {
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->foreignId('transaction_id')->constrained()->cascadeOnDelete();
            $table->primary(['tag_id', 'transaction_id']);
        });

        Schema::create('budgets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->string('month', 7); // YYYY-MM
            $table->decimal('amount', 15, 2);
            $table->timestamps();
            $table->unique(['user_id', 'category_id', 'month']);
        });

        Schema::create('goals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->decimal('target_amount', 15, 2);
            $table->decimal('current_amount', 15, 2)->default(0);
            $table->date('deadline')->nullable();
            $table->string('color', 9)->default('#10b981');
            $table->text('notes')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('goal_contributions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('goal_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 15, 2); // negativo = retirada
            $table->date('date');
            $table->string('note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['goal_contributions', 'goals', 'budgets', 'tag_transaction', 'transactions', 'recurring_transactions', 'tags', 'categories', 'accounts'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};

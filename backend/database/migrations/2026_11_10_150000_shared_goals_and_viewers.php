<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('goals', function (Blueprint $table) {
            // money = juntar dinheiro; task = meta de fazer algo (sem valor).
            $table->string('kind', 10)->default('money')->after('name');
        });

        // Metas compartilhadas: quem mais participa (e vê) a meta.
        Schema::create('goal_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('goal_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['goal_id', 'user_id']);
        });

        // Quem pode ver as finanças de quem (somente visualização).
        Schema::create('user_viewers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('viewer_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['owner_id', 'viewer_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_viewers');
        Schema::dropIfExists('goal_user');
        Schema::table('goals', function (Blueprint $table) {
            $table->dropColumn('kind');
        });
    }
};

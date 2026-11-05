<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Enquadramento vertical da capa (0 = topo, 100 = base). Nulo = padrão do app.
            $table->unsignedTinyInteger('cover_position')->nullable()->after('cover_path');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('cover_position');
        });
    }
};

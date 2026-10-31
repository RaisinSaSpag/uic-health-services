<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('patients', 'age')) {
            Schema::table('patients', function (Blueprint $table) {
                $table->integer('age')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('patients', 'age')) {
            Schema::table('patients', function (Blueprint $table) {
                $table->dropColumn('age');
            });
        }
    }
};
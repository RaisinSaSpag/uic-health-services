<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medical_records', function (Blueprint $table) {
            $table->text('nurse_finalization_notes')->nullable()->after('follow_up_date');
        });
    }

    public function down(): void
    {
        Schema::table('medical_records', function (Blueprint $table) {
            $table->dropColumn('nurse_finalization_notes');
        });
    }
};
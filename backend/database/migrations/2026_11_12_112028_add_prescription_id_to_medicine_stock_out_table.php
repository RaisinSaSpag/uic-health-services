<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicine_stock_out', function (Blueprint $table) {
            $table->foreignId('prescription_id')
                  ->nullable()
                  ->after('stock_in_id')
                  ->constrained('prescriptions')
                  ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('medicine_stock_out', function (Blueprint $table) {
            $table->dropForeign(['prescription_id']);
            $table->dropColumn('prescription_id');
        });
    }
};
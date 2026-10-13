<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('consultations', function (Blueprint $table): void {
            $table->text('diagnosis')->nullable()->after('symptoms');
            $table->text('remarks')->nullable()->after('diagnosis');
            $table->string('blood_pressure', 32)->nullable()->after('triage_notes');
            $table->unsignedSmallInteger('pulse_bpm')->nullable()->after('blood_pressure');
            $table->decimal('temperature_c', 4, 1)->nullable()->after('pulse_bpm');
            $table->decimal('weight_kg', 5, 2)->nullable()->after('temperature_c');
            $table->timestamp('consulted_at')->nullable()->after('submitted_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('consultations', function (Blueprint $table): void {
            $table->dropColumn([
                'diagnosis',
                'remarks',
                'blood_pressure',
                'pulse_bpm',
                'temperature_c',
                'weight_kg',
                'consulted_at',
            ]);
        });
    }
};

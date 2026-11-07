<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->foreignId('patient_enrollment_id')
                ->nullable()
                ->after('patient_id')
                ->constrained('patient_enrollments')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->dropForeign(['patient_enrollment_id']);
            $table->dropColumn('patient_enrollment_id');
        });
    }
};
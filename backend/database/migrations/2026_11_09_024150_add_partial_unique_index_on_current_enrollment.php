<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 🚨 P3-5 FIX: Enforce "exactly one current enrollment per patient"
        // Prevents two is_current=true rows from ever existing.

        DB::statement('DROP INDEX IF EXISTS patient_enrollments_current_unique');

        DB::statement("
            CREATE UNIQUE INDEX patient_enrollments_current_unique 
            ON patient_enrollments(patient_id) 
            WHERE is_current = 1
        ");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS patient_enrollments_current_unique');
    }
};
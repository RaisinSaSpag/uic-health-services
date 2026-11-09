<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 🚨 P3-1 FIX: Partial unique index that:
        //   - Enforces uniqueness on REAL emails
        //   - Allows duplicate 'unassigned@uic.edu.ph' placeholders for minors

        DB::statement('DROP INDEX IF EXISTS users_email_unique');
        DB::statement('DROP INDEX IF EXISTS users_email_unique_real');

        DB::statement("
            CREATE UNIQUE INDEX users_email_unique_real 
            ON users(email) 
            WHERE email != 'unassigned@uic.edu.ph'
        ");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS users_email_unique_real');
    }
};
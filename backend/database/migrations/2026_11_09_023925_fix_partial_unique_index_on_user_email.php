<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 🚨 P3-1 FIX: Partial unique index that allows duplicate placeholders
        // but enforces uniqueness on real emails
        DB::statement('DROP INDEX IF EXISTS users_email_unique');
        DB::statement('DROP INDEX IF EXISTS users_email_unique_real');
        
        // Note: SQLite supports partial indexes. MySQL/Postgres use a slightly different syntax.
        // This is the SQLite version.
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
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // SQLite does not support dropping unique indexes via Schema::table.
        // We rebuild the users table without the unique constraint on email.
        // This allows multiple minors to share the placeholder 'unassigned@uic.edu.ph'.
        if (DB::getDriverName() === 'sqlite') {
            $sql = DB::selectOne("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")->sql ?? '';

            // If the current schema doesn't have UNIQUE on email, nothing to do
            if (stripos($sql, 'unique') === false) {
                return;
            }

            // Read current column list from the original table to preserve data exactly
            $columns = DB::select("PRAGMA table_info(users)");
            $columnNames = array_map(fn ($c) => $c->name, $columns);
            $columnList = implode(', ', array_map(fn ($c) => '"' . $c . '"', $columnNames));

            DB::statement('PRAGMA foreign_keys=OFF');

            DB::statement('ALTER TABLE users RENAME TO users_old');

            // Recreate users table matching the original schema but without UNIQUE on email
            DB::statement('
                CREATE TABLE "users" (
                    "id" integer primary key autoincrement not null,
                    "first_name" varchar not null,
                    "last_name" varchar not null,
                    "email" varchar not null,
                    "google_sub" varchar,
                    "role_id" integer,
                    "campus_id" integer,
                    "department_id" integer,
                    "is_active" tinyint(1) not null default 1,
                    "last_login_at" datetime,
                    "remember_token" varchar,
                    "created_at" datetime,
                    "updated_at" datetime,
                    "password" varchar,
                    "must_change_password" tinyint(1) not null default 0,
                    "tokens_valid_after" datetime
                )
            ');

            // Copy all data preserving original IDs
            DB::statement("INSERT INTO users ($columnList) SELECT $columnList FROM users_old");

            DB::statement('DROP TABLE users_old');
            DB::statement('PRAGMA foreign_keys=ON');
        } else {
            Schema::table('users', function (Blueprint $table) {
                $table->dropUnique(['email']);
            });
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unique('email');
        });
    }
};
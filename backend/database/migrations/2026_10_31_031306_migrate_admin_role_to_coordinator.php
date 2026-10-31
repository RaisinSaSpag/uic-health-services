<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Migrate all existing admin users to coordinator role, then delete the admin role.
     *
     * Destructive migration: original admin users cannot be identified after this
     * runs. Rollback is not supported — restore from a database backup if needed.
     */
    public function up(): void
    {
        $adminRole = DB::table('roles')->where('name', 'admin')->first();
        $coordinatorRole = DB::table('roles')->where('name', 'coordinator')->first();

        if (! $adminRole) {
            // Already migrated, or admin role never existed.
            return;
        }

        if (! $coordinatorRole) {
            throw new RuntimeException(
                'Cannot migrate: coordinator role is missing. Create it before running this migration.'
            );
        }

        // Reassign all users with admin role to coordinator
        DB::table('users')
            ->where('role_id', $adminRole->id)
            ->update(['role_id' => $coordinatorRole->id]);

        // Delete the admin role
        DB::table('roles')->where('id', $adminRole->id)->delete();
    }

    public function down(): void
    {
        // Irreversible: the original admin users cannot be distinguished from
        // coordinators after `up()` runs. Restore from a DB backup to roll back.
    }
};
<?php

namespace Database\Seeders;

use App\Models\Campus;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class TestUserSeeder extends Seeder
{
    public function run(): void
    {
        // 🚨 P5-6 FIX: CRITICAL — Test users must NEVER seed in production.
        // This check fails safe: it only allows the environments that are
        // explicitly expected for local development and testing.
        $env = strtolower(trim((string) app()->environment()));
        
        $allowedEnvs = ['local', 'development', 'testing', 'dev'];
        $blockedEnvs = ['production', 'prod', 'live', 'staging', 'beta', 'release'];
        
        if (in_array($env, $blockedEnvs, true)) {
            $this->command->error("🚨 BLOCKED: TestUserSeeder refuses to run in '$env' environment.");
            $this->command->error("   Test credentials (coordinator@uic.edu.ph / coord123) are dangerous in production.");
            return;
        }
        
        if (!in_array($env, $allowedEnvs, true)) {
            $this->command->error("🚨 BLOCKED: TestUserSeeder refuses to run in unknown environment '$env'.");
            $this->command->error("   Allowed environments: " . implode(', ', $allowedEnvs));
            $this->command->error("   If this is intentional, set APP_ENV explicitly in your .env file.");
            return;
        }
        
        // 🚨 P5-6 FIX (Layer 2): Detect if this DB has already been "promoted"
        // to a real system. If a coordinator already exists with a real password
        // (i.e. has changed their default password), this is likely production.
        $existingRealCoordinator = User::query()
            ->where('email', 'coordinator@uic.edu.ph')
            ->where('must_change_password', false)
            ->where('created_at', '<', now()->subDay()) // 24 hours old
            ->exists();
        
        if ($existingRealCoordinator) {
            $this->command->error("🚨 BLOCKED: A real coordinator account already exists in this database.");
            $this->command->error("   This database appears to be in production use. Refusing to overwrite accounts.");
            return;
        }
        
        // 🚨 P5-6 FIX (Layer 3): Explicit override for demo/staging servers only.
        // You can set ALLOW_TEST_USERS=true in .env to force-seed in a non-local env.
        $explicitOverride = filter_var(env('ALLOW_TEST_USERS', false), FILTER_VALIDATE_BOOLEAN);
        if (!in_array($env, ['local', 'testing', 'dev'], true) && !$explicitOverride) {
            $this->command->error("🚨 BLOCKED: This environment ('$env') requires ALLOW_TEST_USERS=true to seed test users.");
            return;
        }
        
        if ($explicitOverride) {
            $this->command->warn("⚠️  Running TestUserSeeder with ALLOW_TEST_USERS=true in '$env' environment.");
            $this->command->warn("   Make sure these accounts are changed or removed before going live.");
        }
        
        $this->command->info("✅ TestUserSeeder is running in '$env' environment.");
        
        $roleIds = Role::pluck('id', 'name')->toArray();
        $campusId = Campus::where('code', 'FATHER_SELGA')->value('id')
            ?? Campus::first()->id;
        
        if (!$campusId) {
            $this->command->error("🚨 No campus found. Please run CampusSeeder first.");
            return;
        }

        $testUsers = [
            ['email' => 'coordinator@uic.edu.ph', 'first_name' => 'Test', 'last_name' => 'Coordinator', 'role_id' => $roleIds['coordinator'] ?? null, 'password' => 'coord123'],
            ['email' => 'nurse@uic.edu.ph',       'first_name' => 'Test', 'last_name' => 'Nurse',       'role_id' => $roleIds['nurse'] ?? null,       'password' => 'nurse123'],
            ['email' => 'doctor@uic.edu.ph',      'first_name' => 'Test', 'last_name' => 'Doctor',      'role_id' => $roleIds['doctor'] ?? null,      'password' => 'doctor123'],
        ];

        foreach ($testUsers as $userData) {
            if (!$userData['role_id']) {
                continue;
            }

            User::updateOrCreate(
                ['email' => $userData['email']],
                [
                    'first_name' => $userData['first_name'],
                    'last_name' => $userData['last_name'],
                    'role_id' => $userData['role_id'],
                    'campus_id' => $campusId,
                    'google_sub' => null,
                    'password' => Hash::make($userData['password']),
                    'is_active' => true,
                    'department_id' => null,
                    // 🚨 P5-6 FIX (Layer 4): Force password change on first login
                    // So even in dev, users must rotate the shared test password.
                    'must_change_password' => true,
                ]
            );
        }
        
        $this->command->info("✅ Test users seeded. All accounts require password change on first login.");
    }
}
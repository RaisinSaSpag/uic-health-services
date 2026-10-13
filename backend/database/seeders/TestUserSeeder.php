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
        $roleIds = Role::pluck('id', 'name')->toArray();
        $campusId = Campus::where('code', 'FATHER_SELGA')->value('id')
            ?? Campus::first()->id;

        $testUsers = [
            ['email' => 'admin@uic.edu.ph',       'first_name' => 'Test', 'last_name' => 'Admin',       'role_id' => $roleIds['admin'] ?? null,       'password' => 'admin123'],
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
                    'google_sub' => 'test_' . str_replace('@', '_at_', $userData['email']),
                    'password' => Hash::make($userData['password']),
                    'is_active' => true,
                    'department_id' => null,
                ]
            );
        }
    }
}
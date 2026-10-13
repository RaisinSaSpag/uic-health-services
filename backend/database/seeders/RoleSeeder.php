<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            'student' => 'Student role',
            'employee' => 'Employee role',
            'nurse' => 'Nurse role',
            'doctor' => 'Doctor role',
            'admin' => 'Admin role',
            'coordinator' => 'HSO Coordinator role',
        ];

        foreach ($roles as $name => $description) {
            Role::firstOrCreate(
                ['name' => $name],
                ['description' => $description]
            );
        }
    }
}
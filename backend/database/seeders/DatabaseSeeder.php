<?php

namespace Database\Seeders;

use App\Models\Campus;
use App\Models\Department;
use App\Models\Role;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        foreach (['student', 'employee', 'nurse', 'doctor', 'admin'] as $roleName) {
            Role::firstOrCreate(
                ['name' => $roleName],
                ['description' => ucfirst($roleName).' role']
            );
        }

        Campus::firstOrCreate(
            ['code' => 'MAIN'],
            ['name' => 'Main Campus', 'address' => 'On-premise site']
        );

        Campus::firstOrCreate(
            ['code' => 'BAJADA'],
            ['name' => 'Bajada Campus', 'address' => 'Bajada, Davao City']
        );

        Campus::firstOrCreate(
            ['code' => 'BONIFACIO'],
            ['name' => 'Bonifacio Campus', 'address' => 'Bonifacio, Davao City']
        );

        Campus::firstOrCreate(
            ['code' => 'FATHER_SELGA'],
            ['name' => 'Father Selga Campus', 'address' => 'Father Selga, Davao City']
        );

        Department::firstOrCreate(
            ['code' => 'COLLEGE'],
            ['name' => 'College', 'category' => 'college']
        );

        Department::firstOrCreate(
            ['code' => 'BASIC_ED'],
            ['name' => 'Basic Education', 'category' => 'basic_education']
        );
    }
}

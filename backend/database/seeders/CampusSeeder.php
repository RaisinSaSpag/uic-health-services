<?php

namespace Database\Seeders;

use App\Models\Campus;
use Illuminate\Database\Seeder;

class CampusSeeder extends Seeder
{
    public function run(): void
    {
        $campuses = [
            ['code' => 'MAIN',         'name' => 'Main Campus',         'address' => 'On-premise site'],
            ['code' => 'FATHER_SELGA', 'name' => 'Father Selga Campus', 'address' => 'Father Selga, Davao City'],
            ['code' => 'BONIFACIO',    'name' => 'Bonifacio Campus',    'address' => 'Bonifacio, Davao City'],
            ['code' => 'BAJADA_GS',    'name' => 'Bajada Grade School', 'address' => 'Bajada, Davao City'],
            ['code' => 'BAJADA_JHS',   'name' => 'Bajada Junior High',  'address' => 'Bajada, Davao City'],
            ['code' => 'BAJADA_SHS',   'name' => 'Bajada Senior High',  'address' => 'Bajada, Davao City'],
        ];

        foreach ($campuses as $campus) {
            Campus::firstOrCreate(
                ['code' => $campus['code']],
                ['name' => $campus['name'], 'address' => $campus['address']]
            );
        }
    }
}
<?php

namespace Tests;

use App\Models\Campus;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use App\Services\Auth\JwtService;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Schema;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        if (Schema::hasTable('roles')) {
            $this->seedReferenceData();
        }
    }

    protected function seedReferenceData(): void
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
            ['code' => 'BAJADA_GS'],
            ['name' => 'Bajada Grade School', 'address' => 'Bajada, Davao City']
        );

        Campus::firstOrCreate(
            ['code' => 'BAJADA_JHS'],
            ['name' => 'Bajada Junior High', 'address' => 'Bajada, Davao City']
        );

        Campus::firstOrCreate(
            ['code' => 'BAJADA_SHS'],
            ['name' => 'Bajada Senior High', 'address' => 'Bajada, Davao City']
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

    protected function createUserWithRole(string $roleName): User
    {
        return User::factory()->withRole($roleName)->create();
    }

    protected function issueTokenFor(User $user): string
    {
        $user->loadMissing('role');

        return $this->app->make(JwtService::class)->issueToken($user);
    }

    protected function asUser(User $user): static
    {
        return $this->withHeader('Authorization', 'Bearer '.$this->issueTokenFor($user));
    }
}

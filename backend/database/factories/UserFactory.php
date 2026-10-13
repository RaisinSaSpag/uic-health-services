<?php

namespace Database\Factories;

use App\Models\Campus;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $role = Role::firstOrCreate(
            ['name' => 'student'],
            ['description' => 'Student role']
        );

        $campus = Campus::firstOrCreate(
            ['code' => 'MAIN'],
            ['name' => 'Main Campus', 'address' => 'On-premise site']
        );

        $firstName = fake()->firstName();
        $lastName = fake()->lastName();

        return [
            'role_id' => $role->id,
            'campus_id' => $campus->id,
            'department_id' => null,
            'google_sub' => 'google_'.Str::uuid(),
            'email' => fake()->unique()->safeEmail(),
            'first_name' => $firstName,
            'last_name' => $lastName,
            'is_active' => true,
            'last_login_at' => now(),
            'remember_token' => Str::random(10),
        ];
    }

    public function withRole(string $roleName): static
    {
        return $this->state(function () use ($roleName): array {
            $normalizedRole = strtolower($roleName);

            $role = Role::firstOrCreate(
                ['name' => $normalizedRole],
                ['description' => ucfirst($normalizedRole).' role']
            );

            return [
                'role_id' => $role->id,
            ];
        });
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => []);
    }
}

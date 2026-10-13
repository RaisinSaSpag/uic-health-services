<?php

namespace Database\Factories;

use App\Models\Campus;
use App\Models\Department;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Patient>
 */
class PatientFactory extends Factory
{
    protected $model = Patient::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $campus = Campus::firstOrCreate(
            ['code' => 'MAIN'],
            ['name' => 'Main Campus', 'address' => 'On-premise site']
        );

        $department = Department::firstOrCreate(
            ['code' => 'COLLEGE'],
            ['name' => 'College', 'category' => 'college']
        );

        return [
            'user_id' => User::factory(),
            'campus_id' => $campus->id,
            'department_id' => $department->id,
            'patient_number' => 'P-'.now()->format('Ymd').'-'.strtoupper(fake()->unique()->bothify('??##??')),
            'patient_type' => fake()->randomElement(['student', 'employee']),
            'sex' => fake()->randomElement(['male', 'female']),
            'birth_date' => fake()->date('Y-m-d', '-16 years'),
            'contact_number' => fake()->numerify('09#########'),
            'emergency_contact_name' => fake()->name(),
            'emergency_contact_number' => fake()->numerify('09#########'),
        ];
    }
}

<?php

namespace Database\Factories;

use App\Models\Consultation;
use App\Models\Medicine;
use App\Models\Prescription;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Prescription>
 */
class PrescriptionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'consultation_id' => Consultation::factory(),
            'medicine_id' => Medicine::factory(),
            'quantity' => fake()->numberBetween(1, 20),
            'dosage_instructions' => fake()->randomElement([
                'Take 1 tablet every 6 hours',
                'Take 1 capsule twice daily after meals',
                'Take 1 tablet once daily in the morning',
                'Take 5ml every 4 hours as needed',
            ]),
            'prescribed_by' => User::factory()->withRole('doctor'),
            'dispensed_by' => null,
            'dispensed_at' => null,
            'status' => 'pending',
        ];
    }
}
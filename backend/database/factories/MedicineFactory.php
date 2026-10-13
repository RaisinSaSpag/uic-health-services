<?php

namespace Database\Factories;

use App\Models\Medicine;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Medicine>
 */
class MedicineFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->words(2, true) . ' ' . fake()->randomElement(['100mg', '250mg', '500mg', '10mg']),
            'category' => fake()->randomElement([
                'Pain Relief',
                'Antibiotic',
                'Antihypertensive',
                'Antihistamine',
                'Supplement',
                'Antipyretic',
            ]),
        ];
    }
}
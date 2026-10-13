<?php

namespace Database\Factories;

use App\Models\BranchRequest;
use App\Models\Campus;
use App\Models\Medicine;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BranchRequest>
 */
class BranchRequestFactory extends Factory
{
    public function definition(): array
    {
        $campuses = Campus::query()->pluck('id')->all();

        $fromCampus = fake()->randomElement($campuses);
        $toCampus = fake()->randomElement(array_diff($campuses, [$fromCampus]));

        return [
            'from_campus_id' => $fromCampus,
            'to_campus_id' => $toCampus,
            'medicine_id' => Medicine::factory(),
            'quantity_requested' => fake()->numberBetween(10, 100),
            'status' => 'pending',
            'requested_by' => User::factory(),
            'approved_by' => null,
        ];
    }
}
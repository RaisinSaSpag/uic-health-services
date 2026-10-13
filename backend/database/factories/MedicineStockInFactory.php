<?php

namespace Database\Factories;

use App\Models\Campus;
use App\Models\Medicine;
use App\Models\MedicineStockIn;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MedicineStockIn>
 */
class MedicineStockInFactory extends Factory
{
    public function definition(): array
    {
        return [
            'medicine_id' => Medicine::factory(),
            'campus_id' => Campus::query()->value('id') ?? Campus::factory(),
            'quantity' => fake()->numberBetween(50, 500),
            'date_received' => now()->subDays(fake()->numberBetween(1, 30))->format('Y-m-d'),
            'expiration_date' => now()->addMonths(fake()->numberBetween(6, 24))->format('Y-m-d'),
            'received_by' => null,
        ];
    }
}
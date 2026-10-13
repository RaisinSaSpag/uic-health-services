<?php

namespace Database\Factories;

use App\Models\Consultation;
use App\Models\Referral;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Referral>
 */
class ReferralFactory extends Factory
{
    protected $model = Referral::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'consultation_id' => Consultation::factory()->referredToDoctor(),
            'doctor_id' => User::factory()->withRole('doctor'),
            'status' => 'pending_doctor',
            'referral_reason' => fake()->sentence(),
            'doctor_remarks' => null,
            'prescription' => null,
            'referred_at' => now(),
            'completed_at' => null,
        ];
    }
}

<?php

namespace Database\Factories;

use App\Models\Consultation;
use App\Models\Patient;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Consultation>
 */
class ConsultationFactory extends Factory
{
    protected $model = Consultation::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'patient_id' => Patient::factory(),
            'nurse_id' => null,
            'consultation_type' => fake()->randomElement(['walk_in', 'scheduled']),
            'status' => 'pending_consultation',
            'chief_complaint' => fake()->sentence(),
            'symptoms' => fake()->sentence(),
            'triage_notes' => null,
            'referred_to_doctor' => false,
            'submitted_at' => now(),
            'started_at' => null,
            'completed_at' => null,
        ];
    }

    public function referredToDoctor(?int $nurseId = null): static
    {
        return $this->state(fn (): array => [
            'status' => 'referred_to_doctor',
            'referred_to_doctor' => true,
            'nurse_id' => $nurseId,
            'started_at' => now(),
        ]);
    }
}

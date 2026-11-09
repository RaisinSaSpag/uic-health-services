<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Phase5ConsentTest extends TestCase
{
    use RefreshDatabase;

    private function nurse(): User
    {
        return $this->createUserWithRole('nurse');
    }

    private function basePayload(array $overrides = []): array
    {
        $campus = Campus::query()->first();

        return array_merge([
            'first_name' => 'Test',
            'last_name' => 'Minor',
            'birth_date' => '2015-01-01',
            'sex' => 'Male',
            'patient_category' => 'grade_school',
            'patient_type' => 'student',
            'campus_id' => $campus->id,
            'emergency_contact_name' => 'Parent',
            'emergency_contact_number' => '0917-000-0000',
            'emergency_contact_relationship' => 'Parent',
            'parent_guardian_name' => 'Parent Name',
            'parent_contact_number' => '0917-000-0000',
        ], $overrides);
    }

    public function test_minor_without_signature_or_consent_is_rejected(): void
    {
        $nurse = $this->nurse();
        $response = $this->asUser($nurse)->postJson('/api/v1/patients', $this->basePayload());
        $response->assertStatus(422);
    }

    public function test_minor_with_verbal_phone_consent_passes(): void
    {
        $nurse = $this->nurse();
        $response = $this->asUser($nurse)->postJson('/api/v1/patients', $this->basePayload([
            'consent_method' => 'verbal_phone',
            'consent_notes' => 'Called mother, gave verbal consent.',
        ]));
        $response->assertStatus(201);
    }

    public function test_minor_with_emergency_consent_passes(): void
    {
        $nurse = $this->nurse();
        $response = $this->asUser($nurse)->postJson('/api/v1/patients', $this->basePayload([
            'consent_method' => 'emergency',
        ]));
        $response->assertStatus(201);
    }

    public function test_invalid_signature_format_is_rejected(): void
    {
        $nurse = $this->nurse();
        $response = $this->asUser($nurse)->postJson('/api/v1/patients', $this->basePayload([
            'guardian_signature_base64' => 'not a real signature',
        ]));
        $response->assertStatus(422);
    }

    public function test_valid_signature_passes(): void
    {
        $nurse = $this->nurse();
        $validSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
        $response = $this->asUser($nurse)->postJson('/api/v1/patients', $this->basePayload([
            'guardian_signature_base64' => $validSignature,
            'guardian_printed_name' => 'Parent Name',
            'guardian_relationship' => 'Mother',
            'consent_method' => 'in_person',
        ]));
        $response->assertStatus(201);
    }
}
<?php

namespace Tests\Feature;

use App\Models\Consultation;
use App\Models\Patient;
use App\Models\Referral;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Phase4WorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_can_submit_consultation(): void
    {
        $student = $this->createUserWithRole('student');
        $patient = $this->createPatientProfile($student, 'student');

        $response = $this->asUser($student)->postJson('/api/v1/consultations', [
            'consultation_type' => 'walk_in',
            'chief_complaint' => 'Headache and dizziness',
            'symptoms' => 'Intermittent headache since morning',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('status', 'pending_consultation')
            ->assertJsonPath('patient_id', $patient->id)
            ->assertJsonPath('nurse_id', null);

        $consultationId = (int) $response->json('id');

        $this->assertDatabaseHas('consultations', [
            'id' => $consultationId,
            'patient_id' => $patient->id,
            'status' => 'pending_consultation',
            'referred_to_doctor' => 0,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'consultation.submitted',
            'entity_type' => 'consultation',
            'entity_id' => $consultationId,
        ]);
    }

    public function test_nurse_can_start_consultation(): void
    {
        $student = $this->createUserWithRole('student');
        $patient = $this->createPatientProfile($student, 'student');
        $nurse = $this->createUserWithRole('nurse');

        $consultation = Consultation::factory()->for($patient)->create([
            'status' => 'pending_consultation',
        ]);

        $response = $this->asUser($nurse)
            ->patchJson("/api/v1/consultations/{$consultation->id}", [
                'action' => 'start',
            ]);

        $response
            ->assertOk()
            ->assertJsonPath('status', 'nurse_assessment')
            ->assertJsonPath('nurse_id', $nurse->id);

        $consultation->refresh();

        $this->assertNotNull($consultation->started_at);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'consultation.started',
            'entity_type' => 'consultation',
            'entity_id' => $consultation->id,
        ]);
    }

    public function test_nurse_can_triage_without_referral(): void
    {
        $student = $this->createUserWithRole('student');
        $patient = $this->createPatientProfile($student, 'student');
        $nurse = $this->createUserWithRole('nurse');

        $consultation = Consultation::factory()->for($patient)->create([
            'status' => 'nurse_assessment',
            'nurse_id' => $nurse->id,
            'started_at' => now(),
        ]);

        $response = $this->asUser($nurse)
            ->patchJson("/api/v1/consultations/{$consultation->id}", [
                'action' => 'triage',
                'triage_notes' => 'Patient stable and for observation.',
                'referred_to_doctor' => false,
            ]);

        $response
            ->assertOk()
            ->assertJsonPath('status', 'nurse_assessment')
            ->assertJsonPath('referred_to_doctor', false);

        $this->assertDatabaseHas('consultations', [
            'id' => $consultation->id,
            'status' => 'nurse_assessment',
            'referred_to_doctor' => 0,
            'triage_notes' => 'Patient stable and for observation.',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'consultation.triaged',
            'entity_type' => 'consultation',
            'entity_id' => $consultation->id,
        ]);
    }

    public function test_nurse_can_triage_with_referral_flag(): void
    {
        $student = $this->createUserWithRole('student');
        $patient = $this->createPatientProfile($student, 'student');
        $nurse = $this->createUserWithRole('nurse');

        $consultation = Consultation::factory()->for($patient)->create([
            'status' => 'nurse_assessment',
            'nurse_id' => $nurse->id,
            'started_at' => now(),
        ]);

        $response = $this->asUser($nurse)
            ->patchJson("/api/v1/consultations/{$consultation->id}", [
                'action' => 'triage',
                'triage_notes' => 'Needs doctor review for further assessment.',
                'referred_to_doctor' => true,
            ]);

        $response
            ->assertOk()
            ->assertJsonPath('status', 'referred_to_doctor')
            ->assertJsonPath('referred_to_doctor', true);

        $this->assertDatabaseHas('consultations', [
            'id' => $consultation->id,
            'status' => 'referred_to_doctor',
            'referred_to_doctor' => 1,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'consultation.triaged',
            'entity_type' => 'consultation',
            'entity_id' => $consultation->id,
        ]);
    }

    public function test_nurse_can_create_referral_for_referred_consultation(): void
    {
        $student = $this->createUserWithRole('student');
        $patient = $this->createPatientProfile($student, 'student');
        $nurse = $this->createUserWithRole('nurse');
        $doctor = $this->createUserWithRole('doctor');

        $consultation = Consultation::factory()->for($patient)->create([
            'status' => 'referred_to_doctor',
            'referred_to_doctor' => true,
            'nurse_id' => $nurse->id,
            'started_at' => now(),
        ]);

        $response = $this->asUser($nurse)->postJson('/api/v1/referrals', [
            'consultation_id' => $consultation->id,
            'doctor_id' => $doctor->id,
            'referral_reason' => 'Persistent symptoms requiring doctor evaluation.',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('consultation_id', $consultation->id)
            ->assertJsonPath('doctor_id', $doctor->id)
            ->assertJsonPath('status', 'pending_doctor');

        $referralId = (int) $response->json('id');

        $this->assertDatabaseHas('referrals', [
            'id' => $referralId,
            'consultation_id' => $consultation->id,
            'doctor_id' => $doctor->id,
            'status' => 'pending_doctor',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'referral.created',
            'entity_type' => 'referral',
            'entity_id' => $referralId,
        ]);
    }

    public function test_doctor_can_complete_referral_and_move_consultation_to_nurse_finalization(): void
    {
        $student = $this->createUserWithRole('student');
        $patient = $this->createPatientProfile($student, 'student');
        $nurse = $this->createUserWithRole('nurse');
        $doctor = $this->createUserWithRole('doctor');

        $consultation = Consultation::factory()->for($patient)->create([
            'status' => 'referred_to_doctor',
            'referred_to_doctor' => true,
            'nurse_id' => $nurse->id,
            'started_at' => now(),
        ]);

        $referral = Referral::factory()->create([
            'consultation_id' => $consultation->id,
            'doctor_id' => $doctor->id,
            'status' => 'pending_doctor',
            'referral_reason' => 'Needs specialist review.',
        ]);

        $response = $this->asUser($doctor)
            ->patchJson("/api/v1/referrals/{$referral->id}", [
                'action' => 'complete',
                'doctor_remarks' => 'No severe findings; continue monitoring.',
                'prescription' => 'Paracetamol 500mg as needed',
            ]);

        $response
            ->assertOk()
            ->assertJsonPath('status', 'completed')
            ->assertJsonPath('doctor_id', $doctor->id);

        $referral->refresh();
        $consultation->refresh();

        $this->assertNotNull($referral->completed_at);
        $this->assertSame('nurse_finalization', $consultation->status);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'referral.completed',
            'entity_type' => 'referral',
            'entity_id' => $referral->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'consultation.nurse_finalization',
            'entity_type' => 'consultation',
            'entity_id' => $consultation->id,
        ]);
    }

    public function test_student_cannot_update_consultation_workflow(): void
    {
        $student = $this->createUserWithRole('student');
        $patient = $this->createPatientProfile($student, 'student');

        $consultation = Consultation::factory()->for($patient)->create([
            'status' => 'pending_consultation',
        ]);

        $response = $this->asUser($student)
            ->patchJson("/api/v1/consultations/{$consultation->id}", [
                'action' => 'start',
            ]);

        $response->assertForbidden();

        $this->assertDatabaseMissing('audit_logs', [
            'action' => 'consultation.started',
            'entity_type' => 'consultation',
            'entity_id' => $consultation->id,
        ]);
    }

    public function test_admin_can_filter_audit_logs_for_consultation_actions(): void
    {
        $student = $this->createUserWithRole('student');
        $this->createPatientProfile($student, 'student');
        $nurse = $this->createUserWithRole('nurse');
        $admin = $this->createUserWithRole('admin');

        $createResponse = $this->asUser($student)->postJson('/api/v1/consultations', [
            'consultation_type' => 'walk_in',
            'chief_complaint' => 'Mild fever',
            'symptoms' => 'Body aches',
        ]);

        $createResponse->assertCreated();
        $consultationId = (int) $createResponse->json('id');

        $this->asUser($nurse)
            ->patchJson("/api/v1/consultations/{$consultationId}", [
                'action' => 'start',
            ])
            ->assertOk();

        $response = $this->asUser($admin)
            ->getJson("/api/v1/audit-logs?entity_type=consultation&entity_id={$consultationId}");

        $response->assertOk();

        $data = $response->json('data');

        $this->assertIsArray($data);
        $this->assertGreaterThanOrEqual(2, count($data));

        $actions = collect($data)->pluck('action')->all();

        $this->assertContains('consultation.submitted', $actions);
        $this->assertContains('consultation.started', $actions);
    }

    private function createPatientProfile(User $user, string $patientType): Patient
    {
        return Patient::factory()->create([
            'user_id' => $user->id,
            'campus_id' => $user->campus_id,
            'department_id' => $user->department_id,
            'patient_type' => $patientType,
        ]);
    }
}

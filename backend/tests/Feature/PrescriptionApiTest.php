<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\Consultation;
use App\Models\Medicine;
use App\Models\MedicineStockIn;
use App\Models\Prescription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PrescriptionApiTest extends TestCase
{
    use RefreshDatabase;

    // ------------------------------------------------------------
    // CREATE
    // ------------------------------------------------------------

    public function test_doctor_can_create_prescription(): void
    {
        $doctor = $this->createUserWithRole('doctor');
        $student = $this->createUserWithRole('student');
        $patient = \App\Models\Patient::factory()->create(['user_id' => $student->id]);
        $consultation = Consultation::factory()->create(['patient_id' => $patient->id]);
        $medicine = Medicine::factory()->create();

        $response = $this->asUser($doctor)->postJson('/api/v1/prescriptions', [
            'consultation_id' => $consultation->id,
            'medicine_id' => $medicine->id,
            'quantity' => 10,
            'dosage_instructions' => 'Take 1 tablet twice daily',
        ]);

        $response->assertCreated()
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('quantity', 10);

        $this->assertDatabaseHas('prescriptions', [
            'consultation_id' => $consultation->id,
            'medicine_id' => $medicine->id,
            'quantity' => 10,
            'status' => 'pending',
            'prescribed_by' => $doctor->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'prescription.created',
            'entity_type' => 'prescription',
        ]);
    }

    public function test_create_prescription_fails_without_required_fields(): void
    {
        $doctor = $this->createUserWithRole('doctor');

        $response = $this->asUser($doctor)->postJson('/api/v1/prescriptions', []);

        $response->assertStatus(422);
    }

    // ------------------------------------------------------------
    // LIST + SHOW
    // ------------------------------------------------------------

    public function test_doctor_can_list_prescriptions_for_consultation(): void
    {
        $doctor = $this->createUserWithRole('doctor');
        $student = $this->createUserWithRole('student');
        $patient = \App\Models\Patient::factory()->create(['user_id' => $student->id]);
        $consultation = Consultation::factory()->create(['patient_id' => $patient->id]);

        Prescription::factory()->count(2)->create([
            'consultation_id' => $consultation->id,
        ]);

        $response = $this->asUser($doctor)->getJson(
            '/api/v1/prescriptions?consultation_id=' . $consultation->id
        );

        $response->assertOk();
        $this->assertGreaterThanOrEqual(2, count($response->json()));
    }

    public function test_doctor_can_view_single_prescription(): void
    {
        $doctor = $this->createUserWithRole('doctor');
        $prescription = Prescription::factory()->create();

        $response = $this->asUser($doctor)->getJson("/api/v1/prescriptions/{$prescription->id}");

        $response->assertOk()->assertJsonPath('id', $prescription->id);
    }

    // ------------------------------------------------------------
    // DISPENSE — THE INTEGRATION POINT
    // ------------------------------------------------------------

    public function test_nurse_can_dispense_prescription(): void
    {
        $doctor = $this->createUserWithRole('doctor');
        $nurse = $this->createUserWithRole('nurse');

        $campus = Campus::query()->first();
        $medicine = Medicine::factory()->create();
        $stockIn = MedicineStockIn::factory()->create([
            'medicine_id' => $medicine->id,
            'campus_id' => $campus->id,
            'quantity' => 100,
        ]);

        $student = $this->createUserWithRole('student');
        $patient = \App\Models\Patient::factory()->create(['user_id' => $student->id]);
        $consultation = Consultation::factory()->create(['patient_id' => $patient->id]);

        $prescription = Prescription::factory()->create([
            'consultation_id' => $consultation->id,
            'medicine_id' => $medicine->id,
            'quantity' => 10,
            'status' => 'pending',
        ]);

        $response = $this->asUser($nurse)->patchJson(
            "/api/v1/prescriptions/{$prescription->id}/dispense",
            ['stock_in_id' => $stockIn->id]
        );

        $response->assertOk()->assertJsonPath('status', 'dispensed');

        $this->assertDatabaseHas('prescriptions', [
            'id' => $prescription->id,
            'status' => 'dispensed',
            'dispensed_by' => $nurse->id,
        ]);

        $this->assertDatabaseHas('medicine_stock_out', [
            'stock_in_id' => $stockIn->id,
            'quantity_dispensed' => 10,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'prescription.dispensed',
            'entity_type' => 'prescription',
            'entity_id' => $prescription->id,
        ]);
    }

    public function test_dispense_fails_with_insufficient_stock(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $campus = Campus::query()->first();
        $medicine = Medicine::factory()->create();
        $stockIn = MedicineStockIn::factory()->create([
            'medicine_id' => $medicine->id,
            'campus_id' => $campus->id,
            'quantity' => 5,
        ]);

        $prescription = Prescription::factory()->create([
            'medicine_id' => $medicine->id,
            'quantity' => 100,
            'status' => 'pending',
        ]);

        $response = $this->asUser($nurse)->patchJson(
            "/api/v1/prescriptions/{$prescription->id}/dispense",
            ['stock_in_id' => $stockIn->id]
        );

        $response->assertStatus(409);
    }

    public function test_dispense_fails_if_already_dispensed(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $prescription = Prescription::factory()->create(['status' => 'dispensed']);

        $response = $this->asUser($nurse)->patchJson(
            "/api/v1/prescriptions/{$prescription->id}/dispense",
            ['stock_in_id' => 1]
        );

        $response->assertStatus(409);
    }

    // ------------------------------------------------------------
    // CANCEL
    // ------------------------------------------------------------

    public function test_doctor_can_cancel_pending_prescription(): void
    {
        $doctor = $this->createUserWithRole('doctor');
        $prescription = Prescription::factory()->create(['status' => 'pending']);

        $response = $this->asUser($doctor)->patchJson(
            "/api/v1/prescriptions/{$prescription->id}/cancel"
        );

        $response->assertOk()->assertJsonPath('status', 'cancelled');

        $this->assertDatabaseHas('prescriptions', [
            'id' => $prescription->id,
            'status' => 'cancelled',
        ]);
    }

    // ------------------------------------------------------------
    // PERMISSIONS
    // ------------------------------------------------------------

    public function test_student_cannot_create_prescription(): void
    {
        $student = $this->createUserWithRole('student');
        $medicine = Medicine::factory()->create();

        $response = $this->asUser($student)->postJson('/api/v1/prescriptions', [
            'consultation_id' => 1,
            'medicine_id' => $medicine->id,
            'quantity' => 10,
        ]);

        $response->assertForbidden();
    }

    public function test_doctor_cannot_dispense_prescription(): void
    {
        $doctor = $this->createUserWithRole('doctor');
        $prescription = Prescription::factory()->create(['status' => 'pending']);

        $response = $this->asUser($doctor)->patchJson(
            "/api/v1/prescriptions/{$prescription->id}/dispense",
            ['stock_in_id' => 1]
        );

        $response->assertForbidden();
    }
}
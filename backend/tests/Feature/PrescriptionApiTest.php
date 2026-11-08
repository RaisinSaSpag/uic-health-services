<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\Consultation;
use App\Models\Medicine;
use App\Models\MedicineStockIn;
use App\Models\Patient;
use App\Models\Prescription;
use App\Models\Referral;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PrescriptionApiTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Create a Referral that assigns the given doctor to the consultation.
     * This makes the doctor "authorized" to access the consultation's prescriptions.
     */
    private function seedDoctorReferral($doctor, Consultation $consultation): Referral
    {
        return Referral::factory()->create([
            'consultation_id' => $consultation->id,
            'doctor_id' => $doctor->id,
            'status' => 'in_progress',
        ]);
    }

    // ------------------------------------------------------------
    // CREATE
    // ------------------------------------------------------------

    public function test_doctor_can_create_prescription(): void
    {
        $doctor = $this->createUserWithRole('doctor');
        $student = $this->createUserWithRole('student');
        $patient = Patient::factory()->create(['user_id' => $student->id]);
        $consultation = Consultation::factory()->create(['patient_id' => $patient->id]);
        $medicine = Medicine::factory()->create();

        $this->seedDoctorReferral($doctor, $consultation);

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
        $patient = Patient::factory()->create(['user_id' => $student->id]);
        $consultation = Consultation::factory()->create(['patient_id' => $patient->id]);

        $this->seedDoctorReferral($doctor, $consultation);

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

        $consultation = Consultation::find($prescription->consultation_id);
        $this->seedDoctorReferral($doctor, $consultation);

        $response = $this->asUser($doctor)->getJson("/api/v1/prescriptions/{$prescription->id}");

        $response->assertOk()->assertJsonPath('id', $prescription->id);
    }

    // ------------------------------------------------------------
    // DISPENSE — FIFO ENDPOINT
    // ------------------------------------------------------------

    public function test_nurse_can_dispense_prescription(): void
    {
        $nurse = $this->createUserWithRole('nurse');

        $campus = Campus::query()->first();
        $nurse->update(['campus_id' => $campus->id]);

        $medicine = Medicine::factory()->create();
        $stockIn = MedicineStockIn::factory()->create([
            'medicine_id' => $medicine->id,
            'campus_id' => $campus->id,
            'quantity' => 100,
            'expiration_date' => now()->addYear()->toDateString(),
            'date_received' => now()->toDateString(),
        ]);

        $student = $this->createUserWithRole('student');
        $patient = Patient::factory()->create(['user_id' => $student->id]);
        $consultation = Consultation::factory()->create(['patient_id' => $patient->id]);

        $prescription = Prescription::factory()->create([
            'consultation_id' => $consultation->id,
            'medicine_id' => $medicine->id,
            'quantity' => 10,
            'status' => 'pending',
        ]);

        $response = $this->asUser($nurse)->postJson(
            "/api/v1/prescriptions/{$prescription->id}/dispense-fifo"
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
            'action' => 'prescription.dispensed_fifo',
            'entity_type' => 'prescription',
            'entity_id' => $prescription->id,
        ]);
    }

    public function test_dispense_fails_with_insufficient_stock(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $campus = Campus::query()->first();
        $nurse->update(['campus_id' => $campus->id]);

        $medicine = Medicine::factory()->create();
        MedicineStockIn::factory()->create([
            'medicine_id' => $medicine->id,
            'campus_id' => $campus->id,
            'quantity' => 5,
            'expiration_date' => now()->addYear()->toDateString(),
            'date_received' => now()->toDateString(),
        ]);

        $prescription = Prescription::factory()->create([
            'medicine_id' => $medicine->id,
            'quantity' => 100,
            'status' => 'pending',
        ]);

        $response = $this->asUser($nurse)->postJson(
            "/api/v1/prescriptions/{$prescription->id}/dispense-fifo"
        );

        $response->assertStatus(422);
    }

    public function test_dispense_fails_if_already_dispensed(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $prescription = Prescription::factory()->create(['status' => 'dispensed']);

        $response = $this->asUser($nurse)->postJson(
            "/api/v1/prescriptions/{$prescription->id}/dispense-fifo"
        );

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Only pending prescriptions can be dispensed.');
    }

    /**
     * FIFO behavior: when multiple non-expired batches exist at the nurse's campus,
     * the oldest-by-expiration-date (then oldest-by-date_received) is used.
     * (Replaces the old "wrong medicine batch" test, which was structurally
     * impossible once the manual PATCH /dispense endpoint was removed.)
     */
    public function test_dispense_fifo_picks_oldest_batch(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $campus = Campus::query()->first();
        $nurse->update(['campus_id' => $campus->id]);

        $medicine = Medicine::factory()->create();

        $laterExpiry = MedicineStockIn::factory()->create([
            'medicine_id' => $medicine->id,
            'campus_id' => $campus->id,
            'quantity' => 100,
            'expiration_date' => now()->addYear()->toDateString(),
            'date_received' => now()->toDateString(),
        ]);

        $soonerExpiry = MedicineStockIn::factory()->create([
            'medicine_id' => $medicine->id,
            'campus_id' => $campus->id,
            'quantity' => 100,
            'expiration_date' => now()->addMonths(3)->toDateString(),
            'date_received' => now()->toDateString(),
        ]);

        $prescription = Prescription::factory()->create([
            'medicine_id' => $medicine->id,
            'quantity' => 10,
            'status' => 'pending',
        ]);

        $response = $this->asUser($nurse)->postJson(
            "/api/v1/prescriptions/{$prescription->id}/dispense-fifo"
        );

        $response->assertOk()->assertJsonPath('status', 'dispensed');

        // The sooner-expiring batch should have been consumed.
        $this->assertDatabaseHas('medicine_stock_out', [
            'stock_in_id' => $soonerExpiry->id,
            'quantity_dispensed' => 10,
        ]);
        $this->assertDatabaseMissing('medicine_stock_out', [
            'stock_in_id' => $laterExpiry->id,
        ]);
    }

    // ------------------------------------------------------------
    // CANCEL
    // ------------------------------------------------------------

    public function test_doctor_can_cancel_pending_prescription(): void
    {
        $doctor = $this->createUserWithRole('doctor');
        $prescription = Prescription::factory()->create(['status' => 'pending']);

        $consultation = Consultation::find($prescription->consultation_id);
        $this->seedDoctorReferral($doctor, $consultation);

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

        $response = $this->asUser($doctor)->postJson(
            "/api/v1/prescriptions/{$prescription->id}/dispense-fifo"
        );

        $response->assertForbidden();
    }

    public function test_doctor_cannot_create_prescription_with_invalid_consultation_or_medicine(): void
    {
        $doctor = $this->createUserWithRole('doctor');
        $medicine = Medicine::factory()->create();

        // 1. Invalid consultation ID → our code aborts with 404 (not found)
        $response = $this->asUser($doctor)->postJson('/api/v1/prescriptions', [
            'consultation_id' => 999999,
            'medicine_id' => $medicine->id,
            'quantity' => 10,
        ]);
        $response->assertStatus(404)
            ->assertJsonPath('message', 'Consultation not found.');

        // 2. Invalid medicine ID on a real consultation assigned to this doctor
        $student = $this->createUserWithRole('student');
        $patient = Patient::factory()->create(['user_id' => $student->id]);
        $consultation = Consultation::factory()->create(['patient_id' => $patient->id]);

        $this->seedDoctorReferral($doctor, $consultation);

        $response = $this->asUser($doctor)->postJson('/api/v1/prescriptions', [
            'consultation_id' => $consultation->id,
            'medicine_id' => 999999,
            'quantity' => 10,
        ]);
        $response->assertStatus(422)
            ->assertJsonPath('message', 'Medicine not found.');
    }
}
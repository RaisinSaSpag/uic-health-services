<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\Consultation;
use App\Models\Medicine;
use App\Models\MedicineStockIn;
use App\Models\Patient;
use App\Models\Prescription;
use App\Models\Referral;
use App\Services\Clinic\ConsultationService;
use App\Services\Clinic\EnrollmentService;
use App\Services\Clinic\PrescriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
use RuntimeException;

class Phase2VerificationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * P2-2: FIFO Dispense must ignore archived stock.
     */
    public function test_fifo_dispense_calculates_archived_stock_correctly()
    {
        $nurse = $this->createUserWithRole('nurse');
        $campus = Campus::query()->first();
        $nurse->update(['campus_id' => $campus->id]);

        $medicine = Medicine::factory()->create();
        
        // We create a batch of 5, but archive all 5.
        $stockIn = MedicineStockIn::factory()->create([
            'medicine_id' => $medicine->id,
            'campus_id' => $campus->id,
            'quantity' => 5,
        ]);
        
        DB::table('medicine_archived')->insert([
            'stock_in_id' => $stockIn->id,
            'quantity' => 5,
            'reason' => 'test',
            'archived_by' => $nurse->id,
            'archived_at' => now(),
        ]);

        // Create a prescription for 1 unit.
        $prescription = Prescription::factory()->create([
            'medicine_id' => $medicine->id,
            'quantity' => 1,
            'status' => 'pending',
        ]);

        $service = app(PrescriptionService::class);

        // It should throw because the 5 stock are archived, so available is 0.
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('No single available stock batch has enough quantity');
        $service->dispenseFifo($prescription->id, $nurse->id);
    }

    /**
     * P2-3: Cannot dispense a prescription for a completed consultation.
     */
    public function test_cannot_dispense_if_consultation_is_completed()
    {
        $nurse = $this->createUserWithRole('nurse');
        $campus = Campus::query()->first();
        $nurse->update(['campus_id' => $campus->id]);

        $medicine = Medicine::factory()->create();
        MedicineStockIn::factory()->create([
            'medicine_id' => $medicine->id,
            'campus_id' => $campus->id,
            'quantity' => 100,
            'expiration_date' => now()->addYear()->toDateString(),
        ]);

        $consultation = Consultation::factory()->create(['status' => 'completed']);
        $prescription = Prescription::factory()->create([
            'consultation_id' => $consultation->id,
            'medicine_id' => $medicine->id,
            'quantity' => 1,
            'status' => 'pending',
        ]);

        $service = app(PrescriptionService::class);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Cannot dispense a prescription for a completed or cancelled consultation.');
        $service->dispenseFifo($prescription->id, $nurse->id);
    }

    /**
     * P2-10: Cannot complete consultation if there are pending prescriptions.
     */
    public function test_cannot_complete_consultation_with_pending_prescriptions()
    {
        $nurse = $this->createUserWithRole('nurse');
        $consultation = Consultation::factory()->create(['status' => 'nurse_assessment']);
        
        $medicine = Medicine::factory()->create();
        Prescription::factory()->create([
            'consultation_id' => $consultation->id,
            'medicine_id' => $medicine->id,
            'status' => 'pending',
        ]);

        $service = app(ConsultationService::class);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Cannot complete consultation while there are pending prescriptions.');
        
        $service->updateByNurse($nurse, $consultation, [
            'action' => 'complete',
            'summary' => 'Test',
            'final_diagnosis' => 'Test',
            'treatment_plan' => 'Test',
        ]);
    }

    /**
     * P2-11: Cannot un-refer if doctor is in_progress.
     */
    public function test_cannot_unrefer_if_doctor_is_in_progress()
    {
        $nurse = $this->createUserWithRole('nurse');
        $doctor = $this->createUserWithRole('doctor');
        $consultation = Consultation::factory()->create(['status' => 'referred_to_doctor', 'referred_to_doctor' => true]);
        
        Referral::factory()->create([
            'consultation_id' => $consultation->id,
            'doctor_id' => $doctor->id,
            'status' => 'in_progress',
        ]);

        $service = app(ConsultationService::class);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Cannot cancel the referral while the doctor is actively assessing the patient.');
        
        $service->updateByNurse($nurse, $consultation, [
            'action' => 'triage',
            'referred_to_doctor' => false,
        ]);
    }

    /**
     * P2-19: Cannot refer to a deactivated doctor.
     */
    public function test_cannot_refer_to_deactivated_doctor()
    {
        $nurse = $this->createUserWithRole('nurse');
        $doctor = $this->createUserWithRole('doctor');
        $doctor->update(['is_active' => false]);
        
        $consultation = Consultation::factory()->create(['status' => 'referred_to_doctor', 'referred_to_doctor' => true]);

        $service = app(\App\Services\Clinic\ReferralService::class);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Cannot refer to a deactivated doctor.');
        
        $service->create($nurse, [
            'consultation_id' => $consultation->id,
            'doctor_id' => $doctor->id,
            'referral_reason' => 'Test',
        ]);
    }

    /**
     * P2-14: RollUp must sync academic fields to the patients table.
     */
    public function test_rollup_syncs_fields_to_patients_table()
    {
        $nurse = $this->createUserWithRole('nurse');
        $campus = Campus::query()->first();
        
        $patient = Patient::factory()->create([
            'campus_id' => $campus->id,
            'student_level' => 'basic',
            'grade_level' => 'Grade 10',
        ]);

        $enrollmentService = app(EnrollmentService::class);
        // Create initial enrollment
        $enrollmentService->createInitial($patient, [
            'campus_id' => $campus->id,
            'category' => 'basic_ed',
            'student_level' => 'basic',
            'grade_level' => 'Grade 10',
            'valid_from' => now()->subYear()->toDateString(),
        ], $nurse);

        // RollUp to Grade 11
        $enrollmentService->rollUp($patient, [
            'campus_id' => $campus->id,
            'category' => 'senior_high',
            'student_level' => 'basic',
            'grade_level' => 'Grade 11',
        ], $nurse);

        // The patient table should now say Grade 11 (synced from the enrollment)
        $this->assertDatabaseHas('patients', [
            'id' => $patient->id,
            'grade_level' => 'Grade 11',
        ]);
    }
}
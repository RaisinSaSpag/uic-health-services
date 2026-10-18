<?php

namespace App\Services\Clinic;

use App\Models\Consultation;
use App\Models\Medicine;
use App\Models\MedicineStockIn;
use App\Models\Prescription;
use Illuminate\Database\Eloquent\Collection;
use RuntimeException;

class PrescriptionService
{
    public function __construct(
        private readonly AuditLogService $auditLogService,
        private readonly InventoryService $inventoryService,
    ) {
    }

    public function listForConsultation(int $consultationId): Collection
    {
        return Prescription::with(['medicine', 'prescribedBy', 'dispensedBy'])
            ->where('consultation_id', $consultationId)
            ->orderBy('created_at')
            ->get();
    }

    public function create(array $payload, int $doctorId): Prescription
    {
        $consultationId = (int) ($payload['consultation_id'] ?? 0);
        $medicineId = (int) ($payload['medicine_id'] ?? 0);
        $quantity = (int) ($payload['quantity'] ?? 0);
        $instructions = trim((string) ($payload['dosage_instructions'] ?? ''));

        if ($consultationId <= 0) {
            throw new RuntimeException('Consultation is required.');
        }

        if ($medicineId <= 0) {
            throw new RuntimeException('Medicine is required.');
        }

        if ($quantity <= 0) {
            throw new RuntimeException('Quantity must be greater than zero.');
        }

        // 1. Verify the consultation exists
        $consultation = Consultation::find($consultationId);
        if (!$consultation) {
            throw new RuntimeException('Consultation not found.');
        }

        // 2. Verify the medicine exists
        if (!Medicine::where('id', $medicineId)->exists()) {
            throw new RuntimeException('Medicine not found.');
        }

        $prescription = Prescription::create([
            'consultation_id' => $consultationId,
            'medicine_id' => $medicineId,
            'quantity' => $quantity,
            'dosage_instructions' => $instructions ?: null,
            'prescribed_by' => $doctorId,
            'status' => 'pending',
        ]);

        $this->auditLogService->record($doctorId, 'prescription.created', 'prescription', $prescription->id, [
            'consultation_id' => $consultationId,
            'medicine_id' => $medicineId,
            'quantity' => $quantity,
        ]);

        return $prescription;
    }

    public function dispense(int $prescriptionId, array $payload, int $nurseId): Prescription
    {
        $stockInId = (int) ($payload['stock_in_id'] ?? 0);

        if ($stockInId <= 0) {
            throw new RuntimeException('Stock-in record is required.');
        }

        $prescription = Prescription::find($prescriptionId);

        if (!$prescription) {
            throw new RuntimeException('Prescription not found.');
        }

        if ($prescription->status !== 'pending') {
            throw new RuntimeException('Only pending prescriptions can be dispensed.');
        }

        // 3. Verify the stock batch exists and matches the prescribed medicine
        $stockIn = MedicineStockIn::find($stockInId);
        if (!$stockIn) {
            throw new RuntimeException('Stock-in record not found.');
        }

        if ((int) $stockIn->medicine_id !== (int) $prescription->medicine_id) {
            throw new RuntimeException('The selected stock batch does not match the prescribed medicine.');
        }

        $this->inventoryService->dispense([
            'stock_in_id' => $stockInId,
            'quantity_dispensed' => $prescription->quantity,
        ], $nurseId);

        $prescription->update([
            'dispensed_by' => $nurseId,
            'dispensed_at' => now(),
            'status' => 'dispensed',
        ]);

        $this->auditLogService->record($nurseId, 'prescription.dispensed', 'prescription', $prescription->id, [
            'stock_in_id' => $stockInId,
            'quantity' => $prescription->quantity,
        ]);

        return $prescription->fresh();
    }

    public function cancel(int $prescriptionId, int $actorId): Prescription
    {
        $prescription = Prescription::find($prescriptionId);

        if (!$prescription) {
            throw new RuntimeException('Prescription not found.');
        }

        if ($prescription->status !== 'pending') {
            throw new RuntimeException('Only pending prescriptions can be cancelled.');
        }

        $prescription->update(['status' => 'cancelled']);

        $this->auditLogService->record($actorId, 'prescription.cancelled', 'prescription', $prescription->id);

        return $prescription->fresh();
    }
}
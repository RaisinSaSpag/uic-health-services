<?php

namespace App\Services\Clinic;

use App\Models\Prescription;
use App\Models\MedicineStockIn;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PrescriptionService
{
    public function __construct(
        private readonly AuditLogService $auditLogService,
        private readonly InventoryService $inventoryService,
    ) {}

    /**
     * Create a new prescription.
     * NOTE: Order matches controller call: create(array $payload, int $actorId)
     */
    public function create(array $payload, int $actorId): Prescription
    {
        $validated = [
            'consultation_id' => (int) ($payload['consultation_id'] ?? 0),
            'medicine_id' => (int) ($payload['medicine_id'] ?? 0),
            'quantity' => (int) ($payload['quantity'] ?? 0),
            'dosage_instructions' => trim((string) ($payload['dosage_instructions'] ?? '')),
        ];

        if ($validated['consultation_id'] <= 0) {
            throw new RuntimeException('Consultation is required.');
        }

        if ($validated['medicine_id'] <= 0) {
            throw new RuntimeException('Medicine is required.');
        }

        if ($validated['quantity'] <= 0) {
            throw new RuntimeException('Quantity must be greater than zero.');
        }

        // Verify consultation exists
        $consultationExists = \App\Models\Consultation::where('id', $validated['consultation_id'])->exists();
        if (!$consultationExists) {
            throw new RuntimeException('Consultation not found.');
        }

        // Verify medicine exists
        $medicineExists = \App\Models\Medicine::where('id', $validated['medicine_id'])->exists();
        if (!$medicineExists) {
            throw new RuntimeException('Medicine not found.');
        }

        $prescription = Prescription::create([
            'consultation_id' => $validated['consultation_id'],
            'medicine_id' => $validated['medicine_id'],
            'quantity' => $validated['quantity'],
            'dosage_instructions' => $validated['dosage_instructions'] ?: null,
            'status' => 'pending',
            'prescribed_by' => $actorId,
        ]);

        $this->auditLogService->record($actorId, 'prescription.created', 'prescription', $prescription->id, [
            'consultation_id' => $validated['consultation_id'],
            'medicine_id' => $validated['medicine_id'],
            'quantity' => $validated['quantity'],
        ]);

        return $prescription;
    }

    /**
     * Dispense a prescription with strict campus authorization.
     */
    public function dispense(int $prescriptionId, array $payload, int $nurseId): Prescription
    {
        $stockInId = (int) ($payload['stock_in_id'] ?? 0);

        if ($stockInId <= 0) {
            throw new RuntimeException('Stock-in record is required.');
        }

        return DB::transaction(function () use ($prescriptionId, $stockInId, $nurseId) {
            // 1. Lock the prescription to prevent double-dispensing
            $prescription = Prescription::lockForUpdate()->find($prescriptionId);

            if (!$prescription) {
                throw new RuntimeException('Prescription not found.');
            }

            if ($prescription->status !== 'pending') {
                throw new RuntimeException('Only pending prescriptions can be dispensed.');
            }

            // 2. Load the nurse to enforce campus rules
            $nurse = \App\Models\User::with('role')->find($nurseId);
            if (!$nurse) {
                throw new RuntimeException('Acting user not found.');
            }

            // 3. Load the stock batch
            $stockIn = MedicineStockIn::lockForUpdate()->find($stockInId);
            if (!$stockIn) {
                throw new RuntimeException('Stock-in record not found.');
            }

            // 4. Verify medicine matches
            if ((int) $stockIn->medicine_id !== (int) $prescription->medicine_id) {
                throw new RuntimeException('The selected stock batch does not match the prescribed medicine.');
            }

            // 5. Verify campus authorization (Nurse = own campus, Coordinator = any)
            $roleName = strtolower((string) $nurse->role?->name);
            if ($roleName !== 'coordinator' && (int) $nurse->campus_id !== (int) $stockIn->campus_id) {
                throw new RuntimeException('You do not have permission to dispense stock from another campus.');
            }

            // 6. Deduct stock
            $this->inventoryService->dispense([
                'stock_in_id' => $stockInId,
                'quantity_dispensed' => $prescription->quantity,
            ], $nurseId);

            // 7. Mark prescription as dispensed
            $prescription->update([
                'dispensed_by' => $nurseId,
                'dispensed_at' => now(),
                'status' => 'dispensed',
            ]);

            // 8. Audit
            $this->auditLogService->record($nurseId, 'prescription.dispensed', 'prescription', $prescription->id, [
                'stock_in_id' => $stockInId,
                'quantity' => $prescription->quantity,
                'campus_id' => $stockIn->campus_id,
            ]);

            return $prescription->fresh();
        });
    }

    /**
     * Cancel a prescription.
     */
    public function cancel(int $prescriptionId, int $actorId): Prescription
    {
        $prescription = Prescription::find($prescriptionId);

        if (!$prescription) {
            throw new RuntimeException('Prescription not found.');
        }

        if ($prescription->status !== 'pending') {
            throw new RuntimeException('Only pending prescriptions can be cancelled.');
        }

        $prescription->update([
            'status' => 'cancelled',
        ]);

        $this->auditLogService->record($actorId, 'prescription.cancelled', 'prescription', $prescription->id, [
            'status' => 'cancelled',
        ]);

        return $prescription->fresh();
    }

    /**
     * List prescriptions for a specific consultation.
     * (Renamed from `list` to match the controller's call.)
     */
    public function listForConsultation(int $consultationId): \Illuminate\Database\Eloquent\Collection
    {
        return Prescription::with(['medicine', 'consultation', 'prescribedBy', 'dispensedBy'])
            ->where('consultation_id', $consultationId)
            ->orderByDesc('created_at')
            ->get();
    }

    /**
     * Show a single prescription.
     */
    public function show(int $prescriptionId): Prescription
    {
        $prescription = Prescription::with(['medicine', 'consultation', 'prescribedBy', 'dispensedBy'])->find($prescriptionId);

        if (!$prescription) {
            throw new RuntimeException('Prescription not found.');
        }

        return $prescription;
    }
}
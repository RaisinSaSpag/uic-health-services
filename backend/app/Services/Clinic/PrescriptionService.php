<?php

namespace App\Services\Clinic;

use App\Models\Prescription;
use App\Models\MedicineStockIn;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PrescriptionService
{
    public function __construct(
        private readonly AuditLogService $auditLogService,
        private readonly InventoryService $inventoryService,
    ) {}

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

        $consultation = \App\Models\Consultation::find($validated['consultation_id']);
        if (!$consultation) {
            throw new RuntimeException('Consultation not found.');
        }

        if (in_array($consultation->status, ['completed', 'cancelled'])) {
            throw new RuntimeException('Cannot create a prescription for a completed or cancelled consultation.');
        }

        $medicineExists = \App\Models\Medicine::where('id', $validated['medicine_id'])->exists();
        if (!$medicineExists) {
            throw new RuntimeException('Medicine not found.');
        }

        return DB::transaction(function () use ($validated, $actorId) {
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
        });
    }

    public function dispenseFifo(int $prescriptionId, int $nurseId): Prescription
    {
        return DB::transaction(function () use ($prescriptionId, $nurseId) {
            $prescription = Prescription::with('consultation')->lockForUpdate()->find($prescriptionId);
            if (!$prescription) {
                throw new RuntimeException('Prescription not found.');
            }
            if ($prescription->status !== 'pending') {
                throw new RuntimeException('Only pending prescriptions can be dispensed.');
            }

            if (in_array($prescription->consultation->status, ['completed', 'cancelled'])) {
                throw new RuntimeException('Cannot dispense a prescription for a completed or cancelled consultation.');
            }

            $nurse = User::with('role')->find($nurseId);
            if (!$nurse) {
                throw new RuntimeException('Acting user not found.');
            }

            $campusId = (int) $nurse->campus_id;
            if ($campusId <= 0) {
                throw new RuntimeException('Acting user has no assigned campus.');
            }

            $today = Carbon::today()->toDateString();
            $batch = MedicineStockIn::query()
                ->where('medicine_id', (int) $prescription->medicine_id)
                ->where('campus_id', $campusId)
                ->where(function ($q) use ($today) {
                    $q->whereNull('expiration_date')
                      ->orWhere('expiration_date', '>=', $today);
                })
                ->whereRaw('
                    (quantity - 
                     (SELECT COALESCE(SUM(quantity_dispensed), 0) FROM medicine_stock_out WHERE medicine_stock_out.stock_in_id = medicine_stock_in.id) -
                     (SELECT COALESCE(SUM(quantity), 0) FROM medicine_archived WHERE medicine_archived.stock_in_id = medicine_stock_in.id)
                    ) >= ?
                ', [(int) $prescription->quantity])
                ->orderBy('expiration_date', 'asc')
                ->orderBy('date_received', 'asc')
                ->lockForUpdate()
                ->first();

            if (!$batch) {
                throw new RuntimeException('No single available stock batch has enough quantity of this medicine at your campus. Mark it as unavailable instead.');
            }

            $this->inventoryService->dispense([
                'stock_in_id' => $batch->id,
                'quantity_dispensed' => $prescription->quantity,
            ], $nurseId);

            $prescription->update([
                'dispensed_by' => $nurseId,
                'dispensed_at' => now(),
                'status' => 'dispensed',
            ]);

            $this->auditLogService->record($nurseId, 'prescription.dispensed_fifo', 'prescription', $prescription->id, [
                'stock_in_id' => $batch->id,
                'quantity' => $prescription->quantity,
                'campus_id' => $campusId,
            ]);

            return $prescription->fresh();
        });
    }

    public function markUnavailable(int $prescriptionId, int $nurseId, ?string $reason = null): Prescription
    {
        return DB::transaction(function () use ($prescriptionId, $nurseId, $reason) {
            $prescription = Prescription::with('consultation')->lockForUpdate()->find($prescriptionId);
            if (!$prescription) {
                throw new RuntimeException('Prescription not found.');
            }
            if ($prescription->status !== 'pending') {
                throw new RuntimeException('Only pending prescriptions can be marked unavailable.');
            }

            // 🚨 P2-6 FIX: Cannot mark unavailable if the consultation is closed
            if (in_array($prescription->consultation->status, ['completed', 'cancelled'])) {
                throw new RuntimeException('Cannot mark a prescription unavailable for a completed or cancelled consultation.');
            }

            // 🚨 P2-6 FIX: Nurses can only affect their own campus's prescriptions
            $nurse = User::with('role')->find($nurseId);
            if (!$nurse) {
                throw new RuntimeException('Acting user not found.');
            }

            $roleName = strtolower((string) $nurse->role?->name);
            if ($roleName !== 'coordinator') {
                $patientCampusId = \App\Models\Patient::where('id', $prescription->consultation->patient_id)
                    ->value('campus_id');
                
                if ($patientCampusId && (int) $nurse->campus_id !== (int) $patientCampusId) {
                    throw new RuntimeException('You can only mark prescriptions unavailable for your own campus.');
                }
            }

            $prescription->update(['status' => 'unavailable']);

            $this->auditLogService->record($nurseId, 'prescription.marked_unavailable', 'prescription', $prescription->id, [
                'medicine_id' => $prescription->medicine_id,
                'quantity' => $prescription->quantity,
                'prescribed_by' => $prescription->prescribed_by,
                'reason' => $reason ?? 'Out of stock at campus',
            ]);

            return $prescription->fresh();
        });
    }

    public function cancel(int $prescriptionId, int $actorId): Prescription
    {
        return DB::transaction(function () use ($prescriptionId, $actorId) {
            $prescription = Prescription::lockForUpdate()->find($prescriptionId);
            if (!$prescription) {
                throw new RuntimeException('Prescription not found.');
            }
            
            if (!in_array($prescription->status, ['pending', 'unavailable'])) {
                throw new RuntimeException('Only pending or unavailable prescriptions can be cancelled.');
            }

            $prescription->update(['status' => 'cancelled']);

            $this->auditLogService->record($actorId, 'prescription.cancelled', 'prescription', $prescription->id, [
                'status' => 'cancelled',
            ]);

            return $prescription->fresh();
        });
    }

    public function listForConsultation(int $consultationId): \Illuminate\Database\Eloquent\Collection
    {
        return Prescription::with(['medicine', 'consultation', 'prescribedBy', 'dispensedBy'])
            ->where('consultation_id', $consultationId)
            ->orderByDesc('created_at')
            ->get();
    }

    public function show(int $prescriptionId): Prescription
    {
        $prescription = Prescription::with(['medicine', 'consultation', 'prescribedBy', 'dispensedBy'])->find($prescriptionId);
        if (!$prescription) {
            throw new RuntimeException('Prescription not found.');
        }
        return $prescription;
    }
}
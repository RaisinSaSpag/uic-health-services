<?php

namespace App\Services\Clinic;

use App\Models\Consultation;
use App\Models\Referral;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ReferralService
{
    public function __construct(
        private readonly AuditLogService $auditLogService,
        private readonly PrescriptionService $prescriptionService // 🚨 P2-15 FIX: Injected to handle prescription creation and logging
    ) {
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function create(User $actor, array $payload): Referral
    {
        $actorRole = strtolower((string) $actor->role?->name);

        if (! in_array($actorRole, ['nurse', 'coordinator'], true)) {
            throw new RuntimeException('Only nurse or coordinator users can create referrals.');
        }

        $consultation = Consultation::query()
            ->with(['referral'])
            ->find((int) $payload['consultation_id']);

        if (! $consultation) {
            throw new RuntimeException('Consultation not found.');
        }

        if ($consultation->referral) {
            throw new RuntimeException('Referral already exists for this consultation.');
        }

        if (! $consultation->referred_to_doctor || $consultation->status !== 'referred_to_doctor') {
            throw new RuntimeException('Consultation is not ready for referral creation.');
        }

        $doctor = User::query()
            ->with('role')
            ->find((int) $payload['doctor_id']);

        if (! $doctor || strtolower((string) $doctor->role?->name) !== 'doctor') {
            throw new RuntimeException('Assigned doctor is invalid.');
        }

        // 🚨 P2-19 FIX: Prevent referring to a deactivated doctor
        if (! $doctor->is_active) {
            throw new RuntimeException('Cannot refer to a deactivated doctor.');
        }

        $referral = Referral::create([
            'consultation_id' => $consultation->id,
            'doctor_id' => $doctor->id,
            'status' => 'pending_doctor',
            'referral_reason' => (string) $payload['referral_reason'],
            'referred_at' => now(),
        ]);

        $this->auditLogService->log(
            actor: $actor,
            action: 'referral.created',
            entityType: 'referral',
            entityId: $referral->id,
            newValues: [
                'consultation_id' => $referral->consultation_id,
                'doctor_id' => $referral->doctor_id,
                'status' => $referral->status,
                'referred_at' => (string) $referral->referred_at,
            ],
        );

        return $referral->load(['doctor', 'consultation.patient.user']);
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function list(User $user, array $filters, int $perPage): LengthAwarePaginator
    {
        $query = Referral::query()
            ->with(['doctor', 'consultation.patient.user']);

        $role = strtolower((string) $user->role?->name);

        if ($role === 'doctor') {
            $query->where('doctor_id', $user->id);
        } elseif ($role === 'nurse') {
            $query->whereHas('consultation', fn ($consultationQuery) => $consultationQuery->where('nurse_id', $user->id));
        }

        if (isset($filters['status']) && $filters['status'] !== '') {
            $query->where('status', (string) $filters['status']);
        }

        if (isset($filters['consultation_id']) && $filters['consultation_id'] !== null) {
            $query->where('consultation_id', (int) $filters['consultation_id']);
        }

        return $query
            ->orderByDesc('referred_at')
            ->paginate(min(max($perPage, 1), 100));
    }

    public function getVisible(User $user, Referral $referral): Referral
    {
        $referral->load(['doctor', 'consultation.patient.user']);

        $role = strtolower((string) $user->role?->name);

        // 🚨 #33: doctors can only view their own referrals
        if ($role === 'doctor' && (int) $referral->doctor_id !== (int) $user->id) {
            throw new RuntimeException('You are not allowed to view this referral.');
        }

        // 🚨 #33: nurses can only view referrals from their own consultations
        if ($role === 'nurse') {
            $consultationNurseId = (int) ($referral->consultation?->nurse_id ?? 0);
            if ($consultationNurseId !== (int) $user->id) {
                throw new RuntimeException('You are not allowed to view this referral.');
            }
        }

        return $referral;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function updateByDoctor(User $actor, Referral $referral, array $payload): Referral
    {
        $referral->load(['consultation']);

        $role = strtolower((string) $actor->role?->name);

        if (! in_array($role, ['doctor', 'coordinator'], true)) {
            throw new RuntimeException('Only doctor or coordinator users can update referrals.');
        }

        if ($role === 'doctor' && (int) $referral->doctor_id !== (int) $actor->id) {
            throw new RuntimeException('Doctors can only update referrals assigned to them.');
        }

        $action = (string) $payload['action'];

        if ($action === 'in_progress') {
            if ($referral->status !== 'pending_doctor') {
                throw new RuntimeException('Only pending referrals can be moved to in_progress.');
            }

            $oldValues = ['status' => $referral->status];

            $referral->update([
                'status' => 'in_progress',
            ]);

            $this->auditLogService->log(
                actor: $actor,
                action: 'referral.in_progress',
                entityType: 'referral',
                entityId: $referral->id,
                oldValues: $oldValues,
                newValues: ['status' => $referral->status],
            );

            return $referral->refresh()->load(['doctor', 'consultation.patient.user']);
        }

        if ($action === 'complete') {
            if (! in_array($referral->status, ['pending_doctor', 'in_progress'], true)) {
                throw new RuntimeException('Only pending or in-progress referrals can be completed.');
            }

            // 🚨 P2-1 FIX: Wrap the entire 6-write process in a single transaction
            return DB::transaction(function () use ($referral, $payload, $actor) {
                $oldValues = [
                    'status' => $referral->status,
                    'doctor_remarks' => $referral->doctor_remarks,
                    'prescription' => $referral->prescription,
                ];

                $referral->update([
                    'status' => 'completed',
                    'doctor_remarks' => (string) $payload['doctor_remarks'],
                    'prescription' => (string) ($payload['prescription'] ?? ''),
                    'completed_at' => now(),
                ]);

                // 🚨 FIX T07: Save Final Diagnosis and Treatment Plan to MedicalRecord
                $consultation = $referral->consultation;
                
                $consultation->medicalRecord()->updateOrCreate(
                    ['consultation_id' => $consultation->id],
                    [
                        'patient_id' => $consultation->patient_id,
                        'nurse_id' => $consultation->nurse_id,
                        'doctor_id' => $actor->id,
                        'summary' => $payload['doctor_remarks'] ?? '',
                        'final_diagnosis' => $payload['final_diagnosis'] ?? 'N/A',
                        'treatment_plan' => $payload['treatment_plan'] ?? 'N/A',
                        'prescription' => $payload['prescription'] ?? null,
                        'finalized_at' => now(),
                    ]
                );

                // 🚨 P2-15 & P2-16 FIX: Use the service so it throws on bad data and logs the audit trail.
                $prescriptions = $payload['prescriptions'] ?? [];
                foreach ($prescriptions as $rx) {
                    // If it's an empty row from the UI, skip it.
                    if (empty($rx['medicine_id']) && empty($rx['quantity'])) {
                        continue;
                    }
                    
                    $this->prescriptionService->create([
                        'consultation_id' => $consultation->id,
                        'medicine_id' => $rx['medicine_id'] ?? 0,
                        'quantity' => $rx['quantity'] ?? 0,
                        'dosage_instructions' => $rx['dosage_instructions'] ?? null,
                    ], $actor->id);
                }

                $consultation->update([
                    'status' => 'nurse_finalization',
                ]);

                $this->auditLogService->log(
                    actor: $actor,
                    action: 'referral.completed',
                    entityType: 'referral',
                    entityId: $referral->id,
                    oldValues: $oldValues,
                    newValues: [
                        'status' => $referral->status,
                        'doctor_remarks' => $referral->doctor_remarks,
                        'prescription' => $referral->prescription,
                        'completed_at' => (string) $referral->completed_at,
                    ],
                );

                $this->auditLogService->log(
                    actor: $actor,
                    action: 'consultation.nurse_finalization',
                    entityType: 'consultation',
                    entityId: $referral->consultation_id,
                    newValues: [
                        'status' => 'nurse_finalization',
                    ],
                );

                return $referral->refresh()->load(['doctor', 'consultation.patient.user']);
            });
        }

        throw new RuntimeException('Unsupported referral action.');
    }
}
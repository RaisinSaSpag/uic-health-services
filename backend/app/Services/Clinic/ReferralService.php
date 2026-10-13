<?php

namespace App\Services\Clinic;

use App\Models\Consultation;
use App\Models\Referral;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use RuntimeException;

class ReferralService
{
    public function __construct(private readonly AuditLogService $auditLogService)
    {
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function create(User $actor, array $payload): Referral
    {
        $actorRole = strtolower((string) $actor->role?->name);

        if (! in_array($actorRole, ['nurse', 'admin'], true)) {
            throw new RuntimeException('Only nurse or admin users can create referrals.');
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

        if ($role === 'doctor' && (int) $referral->doctor_id !== (int) $user->id) {
            throw new RuntimeException('You are not allowed to view this referral.');
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

        if (! in_array($role, ['doctor', 'admin'], true)) {
            throw new RuntimeException('Only doctor or admin users can update referrals.');
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

            $oldValues = [
                'status' => $referral->status,
                'doctor_remarks' => $referral->doctor_remarks,
                'prescription' => $referral->prescription,
            ];

            $referral->update([
                'status' => 'completed',
                'doctor_remarks' => (string) $payload['doctor_remarks'],
                'prescription' => (string) $payload['prescription'],
                'completed_at' => now(),
            ]);

            $referral->consultation->update([
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
        }

        throw new RuntimeException('Unsupported referral action.');
    }
}

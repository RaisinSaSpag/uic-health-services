<?php

namespace App\Services\Clinic;

use App\Models\Consultation;
use App\Models\MedicalRecord;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class ConsultationService
{
    public function __construct(private readonly AuditLogService $auditLogService)
    {
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function create(User $user, array $payload): Consultation
    {
        $role = strtolower((string) $user->role?->name);

        if (! in_array($role, ['student', 'employee', 'nurse', 'admin'], true)) {
            throw new RuntimeException('You are not allowed to submit consultations.');
        }

        $patient = $this->resolveTargetPatient($user, $payload);

        $consultationType = (string) $payload['consultation_type'];
        $isWalkIn = $consultationType === 'walk_in';

        $consultedAt = $isWalkIn
            ? now()
            : $this->parseConsultedAt((string) $payload['consultation_date'], (string) $payload['consultation_time']);

        $referredToDoctor = (bool) ($payload['referred_to_doctor'] ?? false);

        $status = match (true) {
            $referredToDoctor => 'referred_to_doctor',
            $isWalkIn => 'nurse_assessment',
            default => 'pending_consultation',
        };

        $submittedAt = now();

        $consultation = Consultation::create([
            'patient_id' => $patient->id,
            'nurse_id' => in_array($role, ['nurse', 'admin'], true) ? $user->id : null,
            'consultation_type' => $consultationType,
            'status' => $status,
            'chief_complaint' => (string) $payload['chief_complaint'],
            'symptoms' => $payload['symptoms'] ?? null,
            'triage_notes' => $payload['remarks'] ?? null,
            'referred_to_doctor' => $referredToDoctor,
            'submitted_at' => $submittedAt,
            'started_at' => $isWalkIn ? $consultedAt : null,
            'consulted_at' => $consultedAt,
            'blood_pressure' => $payload['blood_pressure'] ?? null,
            'pulse_bpm' => $payload['pulse_bpm'] ?? null,
            'temperature_c' => $payload['temperature_c'] ?? null,
            'weight_kg' => $payload['weight_kg'] ?? null,
            'last_menstrual_period' => $payload['last_menstrual_period'] ?? null,
            'diagnosis' => $payload['diagnosis'] ?? null,
            'remarks' => $payload['remarks'] ?? null,
        ]);

        $this->auditLogService->log(
            actor: $user,
            action: 'consultation.submitted',
            entityType: 'consultation',
            entityId: $consultation->id,
            newValues: [
                'status' => $consultation->status,
                'consultation_type' => $consultation->consultation_type,
                'referred_to_doctor' => $consultation->referred_to_doctor,
                'consulted_at' => (string) $consultation->consulted_at,
                'submitted_at' => (string) $consultation->submitted_at,
            ],
        );

        return $consultation->load(['patient.user', 'nurse', 'referral', 'medicalRecord']);
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function list(User $user, array $filters, int $perPage): LengthAwarePaginator
    {
        $query = Consultation::query()
            ->with(['patient.user', 'nurse', 'referral', 'medicalRecord']);

        $role = strtolower((string) $user->role?->name);

        if (in_array($role, ['student', 'employee'], true)) {
            $query->whereHas('patient', fn ($patientQuery) => $patientQuery->where('user_id', $user->id));
        } elseif ($role === 'doctor') {
            $query->whereHas('referral', fn ($referralQuery) => $referralQuery->where('doctor_id', $user->id));
        }

        if (isset($filters['status']) && $filters['status'] !== '') {
            $query->where('status', (string) $filters['status']);
        }

        if (isset($filters['consultation_type']) && $filters['consultation_type'] !== '') {
            $query->where('consultation_type', (string) $filters['consultation_type']);
        }

        if (array_key_exists('referred_to_doctor', $filters) && $filters['referred_to_doctor'] !== null) {
            $query->where('referred_to_doctor', (bool) $filters['referred_to_doctor']);
        }

        if (isset($filters['submitted_date']) && $filters['submitted_date'] !== '') {
            $query->whereDate('submitted_at', (string) $filters['submitted_date']);
        }

        if (isset($filters['patient_id']) && $filters['patient_id'] !== null) {
            $query->where('patient_id', (int) $filters['patient_id']);
        }

        return $query
            ->orderByDesc('submitted_at')
            ->paginate(min(max($perPage, 1), 100));
    }

    public function getVisible(User $user, Consultation $consultation): Consultation
    {
        $consultation->load(['patient.user', 'nurse', 'referral', 'medicalRecord']);

        if (! $this->canView($user, $consultation)) {
            throw new RuntimeException('You are not allowed to view this consultation.');
        }

        return $consultation;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function updateByNurse(User $actor, Consultation $consultation, array $payload): Consultation
    {
        $role = strtolower((string) $actor->role?->name);

        if (! in_array($role, ['nurse', 'admin'], true)) {
            throw new RuntimeException('Only nurse or admin users can update consultation workflow.');
        }

        $action = (string) $payload['action'];

        return match ($action) {
            'start' => $this->startConsultation($actor, $consultation),
            'triage' => $this->triageConsultation($actor, $consultation, $payload),
            'complete' => $this->completeConsultation($actor, $consultation, $payload),
            'cancel' => $this->cancelConsultation($actor, $consultation),
            default => throw new RuntimeException('Unsupported consultation action.'),
        };
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function resolveTargetPatient(User $actor, array $payload): Patient
    {
        $role = strtolower((string) $actor->role?->name);

        if (in_array($role, ['student', 'employee'], true)) {
            $patient = $actor->patient;

            if (! $patient) {
                throw new RuntimeException('Patient profile is required before submitting consultations.');
            }

            return $patient;
        }

        if (! isset($payload['patient_id'])) {
            throw new RuntimeException('Target patient is required for nurse consultation submission.');
        }

        $patient = Patient::query()->find((int) $payload['patient_id']);

        if (! $patient) {
            throw new RuntimeException('Selected patient was not found.');
        }

        return $patient;
    }

    private function parseConsultedAt(string $consultationDate, string $consultationTime): Carbon
    {
        $value = trim(sprintf('%s %s', $consultationDate, $consultationTime));

        try {
            $parsed = Carbon::createFromFormat('Y-m-d H:i', $value);
        } catch (Throwable) {
            throw new RuntimeException('Consultation date/time is invalid.');
        }

        if (! $parsed) {
            throw new RuntimeException('Consultation date/time is invalid.');
        }

        return $parsed->second(0);
    }

    private function canView(User $user, Consultation $consultation): bool
    {
        $role = strtolower((string) $user->role?->name);

        if (in_array($role, ['admin', 'nurse'], true)) {
            return true;
        }

        if ($role === 'doctor') {
            return (int) ($consultation->referral?->doctor_id ?? 0) === (int) $user->id;
        }

        if (in_array($role, ['student', 'employee'], true)) {
            return (int) ($consultation->patient?->user_id ?? 0) === (int) $user->id;
        }

        return false;
    }

    private function startConsultation(User $actor, Consultation $consultation): Consultation
    {
        if ($consultation->status !== 'pending_consultation') {
            throw new RuntimeException('Only pending consultations can be started.');
        }

        $oldValues = [
            'status' => $consultation->status,
            'nurse_id' => $consultation->nurse_id,
            'started_at' => (string) $consultation->started_at,
        ];

        $consultation->update([
            'nurse_id' => $actor->id,
            'status' => 'nurse_assessment',
            'started_at' => now(),
        ]);

        $this->auditLogService->log(
            actor: $actor,
            action: 'consultation.started',
            entityType: 'consultation',
            entityId: $consultation->id,
            oldValues: $oldValues,
            newValues: [
                'status' => $consultation->status,
                'nurse_id' => $consultation->nurse_id,
                'started_at' => (string) $consultation->started_at,
            ],
        );

        return $consultation->refresh()->load(['patient.user', 'nurse', 'referral', 'medicalRecord']);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function triageConsultation(User $actor, Consultation $consultation, array $payload): Consultation
    {
        if (! in_array($consultation->status, ['pending_consultation', 'nurse_assessment', 'referred_to_doctor'], true)) {
            throw new RuntimeException('Consultation cannot be triaged in its current status.');
        }

        $oldValues = [
            'status' => $consultation->status,
            'triage_notes' => $consultation->triage_notes,
            'referred_to_doctor' => $consultation->referred_to_doctor,
            'nurse_id' => $consultation->nurse_id,
        ];

        $referredToDoctor = (bool) $payload['referred_to_doctor'];

        $consultation->update([
            'nurse_id' => $consultation->nurse_id ?? $actor->id,
            'started_at' => $consultation->started_at ?? now(),
            'triage_notes' => $payload['triage_notes'] ?? null,
            'referred_to_doctor' => $referredToDoctor,
            'status' => $referredToDoctor ? 'referred_to_doctor' : 'nurse_assessment',
        ]);

        $this->auditLogService->log(
            actor: $actor,
            action: 'consultation.triaged',
            entityType: 'consultation',
            entityId: $consultation->id,
            oldValues: $oldValues,
            newValues: [
                'status' => $consultation->status,
                'triage_notes' => $consultation->triage_notes,
                'referred_to_doctor' => $consultation->referred_to_doctor,
            ],
        );

        return $consultation->refresh()->load(['patient.user', 'nurse', 'referral', 'medicalRecord']);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function completeConsultation(User $actor, Consultation $consultation, array $payload): Consultation
    {
        if ($consultation->status === 'completed') {
            throw new RuntimeException('Consultation is already completed.');
        }

        if ($consultation->status === 'cancelled') {
            throw new RuntimeException('Cancelled consultations cannot be completed.');
        }

        $summary = (string) $payload['summary'];
        $finalDiagnosis = (string) $payload['final_diagnosis'];
        $treatmentPlan = (string) $payload['treatment_plan'];

        DB::transaction(function () use ($actor, $consultation, $payload, $summary, $finalDiagnosis, $treatmentPlan): void {
            $consultation->refresh()->load(['referral', 'medicalRecord']);

            $doctorId = null;
            $prescription = $payload['prescription'] ?? null;

            if ($consultation->referred_to_doctor) {
                if (! $consultation->referral || $consultation->referral->status !== 'completed') {
                    throw new RuntimeException('Doctor referral must be completed before finalization.');
                }

                if ($consultation->status !== 'nurse_finalization') {
                    throw new RuntimeException('Consultation must be in nurse_finalization status before completion.');
                }

                $doctorId = $consultation->referral->doctor_id;
                $prescription ??= $consultation->referral->prescription;
            }

            $medicalRecordPayload = [
                'consultation_id' => $consultation->id,
                'patient_id' => $consultation->patient_id,
                'nurse_id' => $consultation->nurse_id ?? $actor->id,
                'doctor_id' => $doctorId,
                'summary' => $summary,
                'final_diagnosis' => $finalDiagnosis,
                'treatment_plan' => $treatmentPlan,
                'prescription' => $prescription,
                'follow_up_date' => $payload['follow_up_date'] ?? null,
                'finalized_at' => now(),
            ];

            $medicalRecord = $consultation->medicalRecord;

            if ($medicalRecord) {
                $medicalRecord->update($medicalRecordPayload);
            } else {
                $medicalRecord = MedicalRecord::create($medicalRecordPayload);
            }

            $oldValues = [
                'status' => $consultation->status,
                'completed_at' => (string) $consultation->completed_at,
            ];

            $consultation->update([
                'nurse_id' => $consultation->nurse_id ?? $actor->id,
                'status' => 'completed',
                'completed_at' => now(),
            ]);

            $this->auditLogService->log(
                actor: $actor,
                action: 'medical_record.finalized',
                entityType: 'medical_record',
                entityId: $medicalRecord->id,
                newValues: [
                    'consultation_id' => $medicalRecord->consultation_id,
                    'final_diagnosis' => $medicalRecord->final_diagnosis,
                    'finalized_at' => (string) $medicalRecord->finalized_at,
                ],
            );

            $this->auditLogService->log(
                actor: $actor,
                action: 'consultation.completed',
                entityType: 'consultation',
                entityId: $consultation->id,
                oldValues: $oldValues,
                newValues: [
                    'status' => $consultation->status,
                    'completed_at' => (string) $consultation->completed_at,
                ],
            );
        });

        return $consultation->refresh()->load(['patient.user', 'nurse', 'referral', 'medicalRecord']);
    }

    private function cancelConsultation(User $actor, Consultation $consultation): Consultation
    {
        if (in_array($consultation->status, ['completed', 'cancelled'], true)) {
            throw new RuntimeException('Consultation cannot be cancelled in its current status.');
        }

        $oldValues = [
            'status' => $consultation->status,
        ];

        $consultation->update([
            'nurse_id' => $consultation->nurse_id ?? $actor->id,
            'status' => 'cancelled',
        ]);

        $this->auditLogService->log(
            actor: $actor,
            action: 'consultation.cancelled',
            entityType: 'consultation',
            entityId: $consultation->id,
            oldValues: $oldValues,
            newValues: [
                'status' => $consultation->status,
            ],
        );

        return $consultation->refresh()->load(['patient.user', 'nurse', 'referral', 'medicalRecord']);
    }
}

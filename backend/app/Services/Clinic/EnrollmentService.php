<?php

namespace App\Services\Clinic;

use App\Models\Patient;
use App\Models\PatientEnrollment;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * EnrollmentService — the engine that manages patient academic/employment status.
 *
 * Core rule: enrollments are append-only history. Once created, an enrollment
 * can be *corrected* (typo fix) but never *reinterpreted* (status change). When
 * a patient's status changes (SHS → College), we close the old enrollment and
 * create a new one — we never mutate the old one.
 *
 * This guarantees perfect historical accuracy: every consultation always points
 * to the enrollment that was actually active on the visit date.
 */
class EnrollmentService
{
    public function __construct(private readonly AuditLogService $auditLogService)
    {
    }

    // ============================================================
    // READ OPERATIONS
    // ============================================================

    public function currentFor(Patient $patient): ?PatientEnrollment
    {
        return PatientEnrollment::query()
            ->where('patient_id', $patient->id)
            ->where('is_current', true)
            ->first();
    }

    public function effectiveOn(Patient $patient, Carbon|string $date): ?PatientEnrollment
    {
        $dateString = $date instanceof Carbon ? $date->toDateString() : Carbon::parse($date)->toDateString();

        return PatientEnrollment::query()
            ->where('patient_id', $patient->id)
            ->whereDate('valid_from', '<=', $dateString)
            ->where(function ($q) use ($dateString) {
                $q->whereNull('valid_to')
                  ->orWhereDate('valid_to', '>=', $dateString);
            })
            ->orderByDesc('valid_from')
            ->first();
    }

    public function historyFor(Patient $patient)
    {
        return PatientEnrollment::query()
            ->where('patient_id', $patient->id)
            ->orderByDesc('valid_from')
            ->orderByDesc('id')
            ->get();
    }

    // ============================================================
    // WRITE OPERATIONS
    // ============================================================

    public function createInitial(Patient $patient, array $data, User $actor): PatientEnrollment
    {
        return DB::transaction(function () use ($patient, $data, $actor) {
            $existing = PatientEnrollment::query()
                ->where('patient_id', $patient->id)
                ->where('is_current', true)
                ->lockForUpdate()
                ->first();

            if ($existing) {
                $existing->update([
                    'is_current' => false,
                    'valid_to' => now()->subDay()->toDateString(),
                ]);
            }

            $validFrom = isset($data['valid_from'])
                ? Carbon::parse((string) $data['valid_from'])->toDateString()
                : now()->toDateString();

            $enrollment = PatientEnrollment::create([
                'patient_id'          => $patient->id,
                'campus_id'           => (int) $data['campus_id'],
                'category'            => (string) $data['category'],
                'student_level'       => $data['student_level'] ?? null,
                'grade_level'         => $data['grade_level'] ?? null,
                'course_program'      => $data['course_program'] ?? null,
                'year_level'          => $data['year_level'] ?? null,
                'section'             => $data['section'] ?? null,
                'student_id_number'   => $data['student_id_number'] ?? null,
                'employee_id'         => $data['employee_id'] ?? null,
                'employee_type'       => $data['employee_type'] ?? null,
                'office_unit_department' => $data['office_unit_department'] ?? null,
                'position_job_title'  => $data['position_job_title'] ?? null,
                'employment_status'   => $data['employment_status'] ?? null,
                'valid_from'          => $validFrom,
                'valid_to'            => null,
                'is_current'          => true,
                'created_by_user_id'  => $actor->id,
                'change_reason'       => (string) ($data['change_reason'] ?? 'initial_registration'),
            ]);

            // 🚨 P2-14 FIX: Sync the duplicated academic fields to the patients table
            $patient->update([
                'campus_id' => $enrollment->campus_id,
                'student_level' => $enrollment->student_level,
                'grade_level' => $enrollment->grade_level,
                'course_program' => $enrollment->course_program,
                'year_level' => $enrollment->year_level,
                'section' => $enrollment->section,
                'student_id_number' => $enrollment->student_id_number,
                'employee_id' => $enrollment->employee_id,
                'employee_type' => $enrollment->employee_type,
                'office_unit_department' => $enrollment->office_unit_department,
                'position_job_title' => $enrollment->position_job_title,
                'employment_status' => $enrollment->employment_status,
            ]);

            $this->auditLogService->log(
                actor: $actor,
                action: 'enrollment.created',
                entityType: 'patient_enrollment',
                entityId: $enrollment->id,
                newValues: [
                    'patient_id' => $patient->id,
                    'category' => $enrollment->category,
                    'valid_from' => $enrollment->valid_from?->toDateString(),
                ],
            );

            return $enrollment;
        });
    }

    public function rollUp(Patient $patient, array $data, User $actor): PatientEnrollment
    {
        return DB::transaction(function () use ($patient, $data, $actor) {
            $current = PatientEnrollment::query()
                ->where('patient_id', $patient->id)
                ->where('is_current', true)
                ->lockForUpdate()
                ->first();

            if (! $current) {
                throw new RuntimeException(
                    'Cannot roll up: this patient has no current enrollment. ' .
                    'Please create an initial enrollment first.'
                );
            }

            $newValidFrom = isset($data['valid_from'])
                ? Carbon::parse((string) $data['valid_from'])->startOfDay()
                : now()->startOfDay();

            if ($newValidFrom->isFuture()) {
                throw new RuntimeException('Roll-up date cannot be in the future.');
            }

            $currentValidFrom = $current->valid_from instanceof Carbon
                ? $current->valid_from->startOfDay()
                : Carbon::parse((string) $current->valid_from)->startOfDay();

            if ($newValidFrom->lte($currentValidFrom)) {
                throw new RuntimeException(
                    'New enrollment date must be after the current enrollment start date (' .
                    $currentValidFrom->toDateString() . ').'
                );
            }

            $oldSnapshot = [
                'enrollment_id' => $current->id,
                'category' => $current->category,
                'valid_from' => $currentValidFrom->toDateString(),
            ];

            $current->update([
                'is_current' => false,
                'valid_to' => $newValidFrom->copy()->subDay()->toDateString(),
            ]);

            $new = PatientEnrollment::create([
                'patient_id'          => $patient->id,
                'campus_id'           => (int) $data['campus_id'],
                'category'            => (string) $data['category'],
                'student_level'       => $data['student_level'] ?? null,
                'grade_level'         => $data['grade_level'] ?? null,
                'course_program'      => $data['course_program'] ?? null,
                'year_level'          => $data['year_level'] ?? null,
                'section'             => $data['section'] ?? null,
                'student_id_number'   => $data['student_id_number'] ?? null,
                'employee_id'         => $data['employee_id'] ?? null,
                'employee_type'       => $data['employee_type'] ?? null,
                'office_unit_department' => $data['office_unit_department'] ?? null,
                'position_job_title'  => $data['position_job_title'] ?? null,
                'employment_status'   => $data['employment_status'] ?? null,
                'valid_from'          => $newValidFrom->toDateString(),
                'valid_to'            => null,
                'is_current'          => true,
                'created_by_user_id'  => $actor->id,
                'change_reason'       => (string) ($data['change_reason'] ?? 'level_up'),
            ]);

            // 🚨 P2-14 FIX: Sync the duplicated academic fields back to the patients table
            $patient->update([
                'campus_id' => $new->campus_id,
                'student_level' => $new->student_level,
                'grade_level' => $new->grade_level,
                'course_program' => $new->course_program,
                'year_level' => $new->year_level,
                'section' => $new->section,
                'student_id_number' => $new->student_id_number,
                'employee_id' => $new->employee_id,
                'employee_type' => $new->employee_type,
                'office_unit_department' => $new->office_unit_department,
                'position_job_title' => $new->position_job_title,
                'employment_status' => $new->employment_status,
            ]);

            $this->auditLogService->log(
                actor: $actor,
                action: 'enrollment.rolled_up',
                entityType: 'patient_enrollment',
                entityId: $new->id,
                oldValues: $oldSnapshot,
                newValues: [
                    'new_enrollment_id' => $new->id,
                    'category' => $new->category,
                    'valid_from' => $new->valid_from?->toDateString(),
                ],
            );

            return $new;
        });
    }

    public function correct(PatientEnrollment $enrollment, array $corrections, User $actor): PatientEnrollment
    {
        if (! $enrollment->is_current) {
            throw new RuntimeException(
                'Cannot correct a closed enrollment. Corrections only apply to the current one.'
            );
        }

        $allowedFields = [
            'grade_level', 'section', 'course_program', 'year_level',
            'student_id_number', 'employee_id', 'employee_type',
            'office_unit_department', 'position_job_title', 'employment_status',
        ];

        $updates = array_intersect_key($corrections, array_flip($allowedFields));

        if ($updates === []) {
            return $enrollment;
        }

        $oldValues = [];
        $newValues = [];
        foreach ($updates as $field => $value) {
            $current = $enrollment->getAttribute($field);
            if ($current !== $value) {
                $oldValues[$field] = $current;
                $newValues[$field] = $value;
            }
        }

        if ($newValues === []) {
            return $enrollment;
        }

        // 🚨 P2-4 FIX: Wrap in transaction AND sync the changes to the patients table
        return DB::transaction(function () use ($enrollment, $updates, $newValues, $actor, $oldValues) {
            $enrollment->update($updates);

            // Sync the corrected fields back to the patients table
            $patient = \App\Models\Patient::find($enrollment->patient_id);
            if ($patient) {
                $patient->update($newValues);
            }

            $this->auditLogService->log(
                actor: $actor,
                action: 'enrollment.corrected',
                entityType: 'patient_enrollment',
                entityId: $enrollment->id,
                oldValues: $oldValues,
                newValues: $newValues,
            );

            return $enrollment->fresh();
        });
    }
}
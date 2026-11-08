<?php

namespace App\Services\Clinic;

use App\Models\Campus;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;
use RuntimeException;

class PatientService
{
    public function __construct(private readonly AuditLogService $auditLogService)
    {
    }

    public function getOwnPatient(User $user): ?Patient
    {
        return Patient::with(['user', 'campus', 'department'])
            ->where('user_id', $user->id)
            ->first();
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function updateOwnProfile(User $user, array $payload): Patient
    {
        $patient = Patient::query()->where('user_id', $user->id)->first();

        if (! $patient) {
            throw new RuntimeException('Patient profile not found.');
        }

        $commonFields = [
            'address',
            'contact_number',
            'emergency_contact_name',
            'emergency_contact_number',
            'emergency_contact_relationship',
            'allergies',
            'existing_medical_condition',
            'with_maintenance_medicine',
            'notes',
        ];

        if ($patient->patient_type === 'student') {
            $studentFields = ['special_health_concern'];

            // 🚨 P2-14 FIX: Removed grade_level, section, course_program, year_level, campus_code.
            // Students cannot edit their academic status directly; that requires EnrollmentService::rollUp().
            if ($patient->student_level === 'basic') {
                $studentFields = array_merge($studentFields, [
                    'parent_guardian_name',
                    'parent_contact_number',
                    'parent_address',
                    'immunization_status',
                    'fit_for_school',
                ]);
            }

            if ($patient->student_level === 'college') {
                $studentFields = array_merge($studentFields, [
                    'working_student',
                ]);
            }

            $updates = $this->onlyAllowedFields($payload, array_merge($commonFields, $studentFields));
        } elseif ($patient->patient_type === 'employee') {
            $employeeFields = [
                'office_unit_department',
                'position_job_title',
                'employment_status',
                'fit_to_work',
                'blood_type',
                'philhealth_number',
            ];

            $updates = $this->onlyAllowedFields($payload, array_merge($commonFields, $employeeFields));
        } else {
            throw new RuntimeException('Only student and employee profiles can be updated in this flow.');
        }

        $updates = $this->normalizeProfileUpdateValues($updates);

        if ($updates === []) {
            return $patient->load(['user', 'campus', 'department']);
        }

        $oldValues = [];
        $newValues = [];

        foreach ($updates as $field => $value) {
            $currentValue = $patient->getAttribute($field);

            if ($currentValue !== $value) {
                $oldValues[$field] = $currentValue;
                $newValues[$field] = $value;
            }
        }

        if ($newValues === []) {
            return $patient->load(['user', 'campus', 'department']);
        }

        $patient->fill($updates);
        $patient->save();

        $this->auditLogService->log(
            actor: $user,
            action: 'patient.profile_updated',
            entityType: 'patient',
            entityId: $patient->id,
            oldValues: $oldValues,
            newValues: $newValues,
        );

        return $patient->fresh(['user', 'campus', 'department']);
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function list(array $filters, int $perPage): LengthAwarePaginator
    {
        $query = Patient::query()->with(['user', 'campus', 'department']);

        if (isset($filters['patient_type']) && $filters['patient_type'] !== '') {
            $query->where('patient_type', (string) $filters['patient_type']);
        }

        if (isset($filters['department_id']) && $filters['department_id'] !== null) {
            $query->where('department_id', (int) $filters['department_id']);
        }

        if (isset($filters['campus_id']) && $filters['campus_id'] !== null) {
            $query->where('campus_id', (int) $filters['campus_id']);
        }

        if (isset($filters['search']) && $filters['search'] !== '') {
            $search = (string) $filters['search'];

            $query->where(function ($innerQuery) use ($search): void {
                $innerQuery
                    ->where('patient_number', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($userQuery) use ($search): void {
                        $userQuery
                            ->where('email', 'like', "%{$search}%")
                            ->orWhere('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    });
            });
        }

        return $query
            ->orderByDesc('id')
            ->paginate(min(max($perPage, 1), 100));
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  list<string>  $fields
     * @return array<string, mixed>
     */
    private function onlyAllowedFields(array $payload, array $fields): array
    {
        return array_intersect_key($payload, array_flip($fields));
    }

    /**
     * @param  array<string, mixed>  $updates
     * @return array<string, mixed>
     */
    private function normalizeProfileUpdateValues(array $updates): array
    {
        $requiredTextFields = [
            'address',
            'contact_number',
            'emergency_contact_name',
            'emergency_contact_number',
            'emergency_contact_relationship',
            'parent_guardian_name',
            'parent_contact_number',
            'parent_address',
            'immunization_status',
            'office_unit_department',
            'position_job_title',
            'employment_status',
            'blood_type',
        ];

        foreach ($requiredTextFields as $field) {
            if (array_key_exists($field, $updates) && is_string($updates[$field])) {
                $updates[$field] = trim($updates[$field]);
            }
        }

        $nullableTextFields = [
            'allergies',
            'existing_medical_condition',
            'notes',
            'special_health_concern',
            'philhealth_number',
        ];

        foreach ($nullableTextFields as $field) {
            if (array_key_exists($field, $updates) && is_string($updates[$field])) {
                $trimmedValue = trim($updates[$field]);
                $updates[$field] = $trimmedValue === '' ? null : $trimmedValue;
            }
        }

        foreach (['with_maintenance_medicine', 'fit_for_school', 'working_student', 'fit_to_work'] as $field) {
            if (array_key_exists($field, $updates)) {
                $updates[$field] = (bool) $updates[$field];
            }
        }

        return $updates;
    }

    private function generatePatientNumber(): string
    {
        do {
            $patientNumber = 'P-'.now()->format('Ymd').'-'.strtoupper(Str::random(6));
        } while (Patient::where('patient_number', $patientNumber)->exists());

        return $patientNumber;
    }

    private function inferStudentLevelFromEmail(string $email): ?string
    {
        $localPart = Str::before(Str::lower($email), '@');

        if (preg_match('/^[a-z][a-z]+_\d{10}$/', $localPart) === 1) {
            return 'basic';
        }

        if (preg_match('/^[a-z][a-z]+_\d{12}$/', $localPart) === 1) {
            return 'college';
        }

        return null;
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function resolveStudentCampusId(string $studentLevel, array $payload): int
    {
        if ($studentLevel === 'basic') {
            $gradeLevel = (string) ($payload['grade_level'] ?? '');
            $campusCode = $this->isSeniorHighGradeLevel($gradeLevel) ? 'BONIFACIO' : 'BAJADA_GS';

            return $this->campusIdByCode($campusCode);
        }

        $preferredCampusCode = Str::upper((string) ($payload['campus_code'] ?? 'FATHER_SELGA'));

        if (! in_array($preferredCampusCode, ['BONIFACIO', 'FATHER_SELGA'], true)) {
            throw new RuntimeException('College students may only be assigned to Bonifacio or Father Selga campus.');
        }

        return $this->campusIdByCode($preferredCampusCode);
    }

    private function campusIdByCode(string $campusCode): int
    {
        $normalizedCode = Str::upper($campusCode);
        $campusId = Campus::where('code', $normalizedCode)->value('id');

        if ($campusId === null) {
            throw new RuntimeException(sprintf('Campus code [%s] is not configured.', $normalizedCode));
        }

        return (int) $campusId;
    }

    private function isSeniorHighGradeLevel(string $gradeLevel): bool
    {
        $normalizedGradeLevel = Str::lower(trim($gradeLevel));

        if ($normalizedGradeLevel === '') {
            return false;
        }

        if (str_contains($normalizedGradeLevel, 'senior high')) {
            return true;
        }

        return preg_match('/\b(11|12)\b/', $normalizedGradeLevel) === 1;
    }
}
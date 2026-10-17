<?php

namespace App\Services\Clinic;

use App\Models\Campus;
use App\Models\Department;
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

    /**
     * @param  array<string, mixed>  $payload
     */
    public function register(User $user, array $payload): Patient
    {
        if ($user->patient()->exists()) {
            throw new RuntimeException('Patient profile already exists for this user.');
        }

        $roleName = Str::lower((string) $user->role?->name);

        if (! in_array($roleName, ['student', 'employee'], true)) {
            throw new RuntimeException('Only student or employee users can self-register as patients.');
        }

        if (($payload['patient_type'] ?? null) !== $roleName) {
            throw new RuntimeException('Patient type must match the authenticated user role.');
        }

        $studentLevel = null;
        $departmentId = $user->department_id;
        $campusId = $user->campus_id;

        if ($roleName === 'student') {
            $studentLevel = Str::lower((string) ($payload['student_level'] ?? ''));

            if (! in_array($studentLevel, ['basic', 'college'], true)) {
                throw new RuntimeException('Student level is required for student registration.');
            }

            $inferredStudentLevel = $this->inferStudentLevelFromEmail((string) $user->email);

            if ($inferredStudentLevel === null) {
                throw new RuntimeException('Student email format is not recognized for level assignment.');
            }

            if ($studentLevel !== $inferredStudentLevel) {
                throw new RuntimeException('Student level does not match the authenticated account format.');
            }

            $departmentId = Department::where('code', $studentLevel === 'basic' ? 'BASIC_ED' : 'COLLEGE')->value('id');
            $campusId = $this->resolveStudentCampusId($studentLevel, $payload);
        }

        $patient = Patient::create([
            'user_id' => $user->id,
            'campus_id' => $campusId,
            'department_id' => $departmentId,
            'patient_number' => $this->generatePatientNumber(),
            'patient_type' => (string) $payload['patient_type'],
            'sex' => (string) $payload['sex'],
            'birth_date' => (string) $payload['birth_date'],
            'age' => $payload['age'],
            'address' => $payload['address'],
            'contact_number' => $payload['contact_number'] ?? null,
            'emergency_contact_name' => $payload['emergency_contact_name'],
            'emergency_contact_number' => $payload['emergency_contact_number'],
            'emergency_contact_relationship' => $payload['emergency_contact_relationship'],
            'allergies' => $payload['allergies'] ?? null,
            'existing_medical_condition' => $payload['existing_medical_condition'] ?? null,
            'with_maintenance_medicine' => (bool) $payload['with_maintenance_medicine'],
            'notes' => $payload['notes'] ?? null,
            'student_level' => $studentLevel,
            'student_id_number' => $payload['student_id_number'] ?? null,
            'grade_level' => $payload['grade_level'] ?? null,
            'section' => $payload['section'] ?? null,
            'parent_guardian_name' => $payload['parent_guardian_name'] ?? null,
            'parent_contact_number' => $payload['parent_contact_number'] ?? null,
            'parent_address' => $payload['parent_address'] ?? null,
            'immunization_status' => $payload['immunization_status'] ?? null,
            'fit_for_school' => array_key_exists('fit_for_school', $payload)
                ? (bool) $payload['fit_for_school']
                : null,
            'special_health_concern' => $payload['special_health_concern'] ?? null,
            'course_program' => $payload['course_program'] ?? null,
            'year_level' => $payload['year_level'] ?? null,
            'working_student' => array_key_exists('working_student', $payload)
                ? (bool) $payload['working_student']
                : null,
            'employee_id' => $payload['employee_id'] ?? null,
            'employee_type' => $payload['employee_type'] ?? null,
            'office_unit_department' => $payload['office_unit_department'] ?? null,
            'position_job_title' => $payload['position_job_title'] ?? null,
            'employment_status' => $payload['employment_status'] ?? null,
            'fit_to_work' => array_key_exists('fit_to_work', $payload)
                ? (bool) $payload['fit_to_work']
                : null,
            'blood_type' => $payload['blood_type'] ?? null,
            'philhealth_number' => $payload['philhealth_number'] ?? null,
        ]);

        $this->auditLogService->log(
            actor: $user,
            action: 'patient.registered',
            entityType: 'patient',
            entityId: $patient->id,
            newValues: [
                'patient_number' => $patient->patient_number,
                'patient_type' => $patient->patient_type,
                'student_level' => $patient->student_level,
                'employee_type' => $patient->employee_type,
                'sex' => $patient->sex,
                'birth_date' => (string) $patient->birth_date,
            ],
        );

        if ($campusId !== null && (int) $user->campus_id !== (int) $campusId) {
            $user->forceFill(['campus_id' => $campusId])->save();
        }

        return $patient->load(['user', 'campus', 'department']);
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

            if ($patient->student_level === 'basic') {
                $studentFields = array_merge($studentFields, [
                    'grade_level',
                    'section',
                    'parent_guardian_name',
                    'parent_contact_number',
                    'parent_address',
                    'immunization_status',
                    'fit_for_school',
                ]);
            }

            if ($patient->student_level === 'college') {
                $studentFields = array_merge($studentFields, [
                    'course_program',
                    'year_level',
                    'working_student',
                    'campus_code',
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

        if (
            $patient->patient_type === 'student'
            && $patient->student_level === 'basic'
            && array_key_exists('grade_level', $updates)
        ) {
            $updates['campus_id'] = $this->resolveStudentCampusId('basic', [
                'grade_level' => (string) $updates['grade_level'],
            ]);
        }

        if (
            $patient->patient_type === 'student'
            && $patient->student_level === 'college'
            && array_key_exists('campus_code', $updates)
        ) {
            $updates['campus_id'] = $this->campusIdByCode((string) $updates['campus_code']);
            unset($updates['campus_code']);
        }

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

        if (array_key_exists('campus_id', $newValues) && (int) $user->campus_id !== (int) $patient->campus_id) {
            $user->forceFill(['campus_id' => $patient->campus_id])->save();
        }

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
            'grade_level',
            'section',
            'parent_guardian_name',
            'parent_contact_number',
            'parent_address',
            'immunization_status',
            'course_program',
            'year_level',
            'office_unit_department',
            'position_job_title',
            'employment_status',
            'blood_type',
            'campus_code',
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

        if (array_key_exists('campus_code', $updates) && is_string($updates['campus_code'])) {
            $updates['campus_code'] = Str::upper($updates['campus_code']);
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

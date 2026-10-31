<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Services\Clinic\PatientService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use RuntimeException;

class PatientController extends Controller
{
    public function __construct(private readonly PatientService $patientService)
    {
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'patient_type' => ['nullable', 'in:student,employee'],
            'campus_id' => ['nullable', 'integer', 'exists:campuses,id'], // 🚨 #30
            'department_id' => ['nullable', 'integer', 'exists:departments,id'], // 🚨 #30
            'search' => ['nullable', 'string', 'max:120'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $patients = $this->patientService->list($validated, $validated['per_page'] ?? 20);

        return response()->json($patients);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'patient_type' => ['required', 'in:student,employee'],
            'student_level' => [
                Rule::requiredIf(fn () => $request->input('patient_type') === 'student'),
                'nullable',
                Rule::in(['basic', 'college']),
            ],
            'sex' => ['required', 'string', 'max:20'],
            'birth_date' => ['required', 'date', 'before_or_equal:today'],
            'age' => ['required', 'integer', 'min:1', 'max:120'],
            'address' => ['required', 'string', 'max:255'],
            'contact_number' => ['required', 'string', 'max:30'],
            'emergency_contact_name' => ['required', 'string', 'max:120'],
            'emergency_contact_number' => ['required', 'string', 'max:30'],
            'emergency_contact_relationship' => ['required', 'string', 'max:100'],
            'campus_code' => ['nullable', 'string', 'max:40'],
            'allergies' => ['nullable', 'string', 'max:2000'],
            'existing_medical_condition' => ['nullable', 'string', 'max:2000'],
            'with_maintenance_medicine' => ['required', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],

            'student_id_number' => [
                Rule::requiredIf(fn () => $request->input('patient_type') === 'student'),
                'nullable',
                'string',
                'max:40',
            ],
            'grade_level' => [
                Rule::requiredIf(
                    fn () => $request->input('patient_type') === 'student'
                        && $request->input('student_level') === 'basic'
                ),
                'nullable',
                'string',
                'max:40',
            ],
            'section' => [
                Rule::requiredIf(
                    fn () => $request->input('patient_type') === 'student'
                        && $request->input('student_level') === 'basic'
                ),
                'nullable',
                'string',
                'max:80',
            ],
            'parent_guardian_name' => [
                Rule::requiredIf(
                    fn () => $request->input('patient_type') === 'student'
                        && $request->input('student_level') === 'basic'
                ),
                'nullable',
                'string',
                'max:120',
            ],
            'parent_contact_number' => [
                Rule::requiredIf(
                    fn () => $request->input('patient_type') === 'student'
                        && $request->input('student_level') === 'basic'
                ),
                'nullable',
                'string',
                'max:30',
            ],
            'parent_address' => [
                Rule::requiredIf(
                    fn () => $request->input('patient_type') === 'student'
                        && $request->input('student_level') === 'basic'
                ),
                'nullable',
                'string',
                'max:255',
            ],
            'immunization_status' => [
                Rule::requiredIf(
                    fn () => $request->input('patient_type') === 'student'
                        && $request->input('student_level') === 'basic'
                ),
                'nullable',
                Rule::in(['complete', 'incomplete', 'unknown']),
            ],
            'fit_for_school' => [
                Rule::requiredIf(
                    fn () => $request->input('patient_type') === 'student'
                        && $request->input('student_level') === 'basic'
                ),
                'nullable',
                'boolean',
            ],
            'course_program' => [
                Rule::requiredIf(
                    fn () => $request->input('patient_type') === 'student'
                        && $request->input('student_level') === 'college'
                ),
                'nullable',
                'string',
                'max:120',
            ],
            'year_level' => [
                Rule::requiredIf(
                    fn () => $request->input('patient_type') === 'student'
                        && $request->input('student_level') === 'college'
                ),
                'nullable',
                'string',
                'max:20',
            ],
            'working_student' => [
                Rule::requiredIf(
                    fn () => $request->input('patient_type') === 'student'
                        && $request->input('student_level') === 'college'
                ),
                'nullable',
                'boolean',
            ],
            'special_health_concern' => ['nullable', 'string', 'max:2000'],

            'employee_id' => [
                Rule::requiredIf(fn () => $request->input('patient_type') === 'employee'),
                'nullable',
                'string',
                'max:40',
            ],
            'employee_type' => [
                Rule::requiredIf(fn () => $request->input('patient_type') === 'employee'),
                'nullable',
                Rule::in([
                    'teaching',
                    'non_teaching',
                    'utility',
                    'security',
                    'maintenance',
                    'admin',
                    'contractual',
                ]),
            ],
            'office_unit_department' => [
                Rule::requiredIf(fn () => $request->input('patient_type') === 'employee'),
                'nullable',
                'string',
                'max:120',
            ],
            'position_job_title' => [
                Rule::requiredIf(fn () => $request->input('patient_type') === 'employee'),
                'nullable',
                'string',
                'max:120',
            ],
            'employment_status' => [
                Rule::requiredIf(fn () => $request->input('patient_type') === 'employee'),
                'nullable',
                Rule::in(['regular', 'contractual', 'part_time', 'probationary']),
            ],
            'fit_to_work' => [
                Rule::requiredIf(fn () => $request->input('patient_type') === 'employee'),
                'nullable',
                'boolean',
            ],
            'blood_type' => [
                'nullable',
                Rule::in(['a+', 'a-', 'b+', 'b-', 'ab+', 'ab-', 'o+', 'o-', 'unknown']),
            ],
            'philhealth_number' => ['nullable', 'string', 'max:40'],
        ]);

        try {
            $patient = $this->patientService->register($request->user(), $validated);

            return response()->json($patient, 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }
    }

    public function me(Request $request): JsonResponse
    {
        $patient = $this->patientService->getOwnPatient($request->user());

        if (! $patient) {
            return response()->json(['message' => 'Patient profile not found.'], 404);
        }

        return response()->json($patient);
    }

    public function updateMe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'address' => ['sometimes', 'required', 'string', 'max:255'],
            'contact_number' => ['sometimes', 'required', 'string', 'max:30'],
            'emergency_contact_name' => ['sometimes', 'required', 'string', 'max:120'],
            'emergency_contact_number' => ['sometimes', 'required', 'string', 'max:30'],
            'emergency_contact_relationship' => ['sometimes', 'required', 'string', 'max:100'],
            'allergies' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'existing_medical_condition' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'with_maintenance_medicine' => ['sometimes', 'boolean'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],

            'grade_level' => ['sometimes', 'required', 'string', 'max:40'],
            'section' => ['sometimes', 'required', 'string', 'max:80'],
            'parent_guardian_name' => ['sometimes', 'required', 'string', 'max:120'],
            'parent_contact_number' => ['sometimes', 'required', 'string', 'max:30'],
            'parent_address' => ['sometimes', 'required', 'string', 'max:255'],
            'immunization_status' => ['sometimes', Rule::in(['complete', 'incomplete', 'unknown'])],
            'fit_for_school' => ['sometimes', 'boolean'],
            'special_health_concern' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'course_program' => ['sometimes', 'required', 'string', 'max:120'],
            'year_level' => ['sometimes', 'required', 'string', 'max:20'],
            'working_student' => ['sometimes', 'boolean'],
            'campus_code' => ['sometimes', Rule::in(['BONIFACIO', 'FATHER_SELGA'])],

            'office_unit_department' => ['sometimes', 'required', 'string', 'max:120'],
            'position_job_title' => ['sometimes', 'required', 'string', 'max:120'],
            'employment_status' => ['sometimes', Rule::in(['regular', 'contractual', 'part_time', 'probationary'])],
            'fit_to_work' => ['sometimes', 'boolean'],
            'blood_type' => ['sometimes', 'nullable', Rule::in(['a+', 'a-', 'b+', 'b-', 'ab+', 'ab-', 'o+', 'o-', 'unknown'])],
            'philhealth_number' => ['sometimes', 'nullable', 'string', 'max:40'],
        ]);

        try {
            $patient = $this->patientService->updateOwnProfile($request->user(), $validated);

            return response()->json($patient);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(Patient $patient): JsonResponse
    {
        return response()->json($patient->load(['user', 'campus', 'department']));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        return response()->json([
            'message' => 'Patient update is not part of current Phase 4 scope.',
        ], 405);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        return response()->json([
            'message' => 'Patient delete is not part of current workflow.',
            'patient_id' => $id,
        ], 405);
    }

    /**
     * Register a walk-in patient (Nurse creates profile without a user account).
     */
    public function walkIn(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'age' => ['nullable', 'integer', 'min:1', 'max:120'],
            'sex' => ['required', 'string', 'max:20'],
            'patient_category' => ['required', 'in:grade_school,high_school,college,employee'],
            'patient_type' => ['required', 'in:student,employee'],
            'campus_id' => ['required', 'integer', 'exists:campuses,id'],
            'course_program' => ['nullable', 'string', 'max:255'],
            'year_level' => ['nullable', 'string', 'max:255'],
            'section' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ]);

        // 🚨 BUG FIX: role must match patient_type (student vs employee)
        $roleName = $validated['patient_type'] === 'employee' ? 'employee' : 'student';

        // Create the real User account using the student's UIC email
        $user = \App\Models\User::create([
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'email' => strtolower($validated['email']),
            'password' => Hash::make(strtolower($validated['email'])),
            'role_id' => \App\Models\Role::where('name', $roleName)->value('id'),
            'campus_id' => $validated['campus_id'],
            'is_active' => true,
            'must_change_password' => true,
        ]);

        // 🚨 FIX Issue 15: Use random string instead of count() to prevent collisions
        $patientNumber = 'WALKIN-' . date('Y') . '-' . strtoupper(Str::random(6));

        $patient = \App\Models\Patient::create([
            'user_id' => $user->id,
            'campus_id' => $validated['campus_id'],
            'patient_number' => $patientNumber,
            'patient_type' => $validated['patient_type'],
            'patient_category' => $validated['patient_category'],
            'sex' => $validated['sex'],
            'birth_date' => null, // 🚨 #23: don't fabricate DOB
            'age' => $validated['age'] ?? null,
            'course_program' => $validated['course_program'] ?? null,
            'year_level' => $validated['year_level'] ?? null,
            'section' => $validated['section'] ?? null,
            'notes' => $validated['remarks'] ?? null,
        ]);

        return response()->json($patient->load('user'), 201);
    }

    /**
     * Quick Injury Log: Creates an injury consultation.
     * Links to an existing patient if patient_id is provided, otherwise creates a new patient.
     */
    public function quickInjuryLog(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'patient_id' => ['nullable', 'integer', 'exists:patients,id'],
            'first_name' => ['required_without:patient_id', 'string', 'max:255'],
            'last_name' => ['required_without:patient_id', 'string', 'max:255'],
            'patient_category' => ['required_without:patient_id', 'in:grade_school,high_school,college,employee'],
            'campus_id' => ['required_without:patient_id', 'integer', 'exists:campuses,id'],
            'chief_complaint' => ['required', 'string', 'max:1000'],
        ]);

        $patient = null;

        if (isset($validated['patient_id'])) {
            $patient = \App\Models\Patient::findOrFail($validated['patient_id']);
        } else {
            // Create new User + Patient
            $email = 'walkin.' . uniqid() . '@uic.edu.ph';

            // 🚨 BUG FIX: role must match patient_category (employee vs student)
            $isEmployee = $validated['patient_category'] === 'employee';
            $roleName = $isEmployee ? 'employee' : 'student';

            $user = \App\Models\User::create([
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'email' => $email,
                'password' => Hash::make($email),
                'role_id' => \App\Models\Role::where('name', $roleName)->value('id'),
                'campus_id' => $validated['campus_id'],
                'is_active' => true,
                'must_change_password' => true,
            ]);

            // 🚨 FIX Issue 15: Use random string instead of count() to prevent collisions
            $patientNumber = 'INJURY-' . date('Y') . '-' . strtoupper(Str::random(6));
            
            $patient = \App\Models\Patient::create([
                'user_id' => $user->id,
                'campus_id' => $validated['campus_id'],
                'patient_number' => $patientNumber,
                'patient_type' => $isEmployee ? 'employee' : 'student',
                'patient_category' => $validated['patient_category'],
                'sex' => null,       // 🚨 #23: don't fabricate sex
                'birth_date' => null, // 🚨 #23: don't fabricate DOB
                'age' => null,        // 🚨 #23: don't fabricate age
            ]);
        }

        // Create Injury Consultation
        $consultation = \App\Models\Consultation::create([
            'patient_id' => $patient->id,
            'nurse_id' => $request->user()->id,
            'consultation_type' => 'injury',
            'status' => 'nurse_assessment',
            'chief_complaint' => $validated['chief_complaint'],
            'submitted_at' => now(),
            'started_at' => now(),
        ]);

        return response()->json([
            'message' => 'Injury logged successfully.',
            'consultation_id' => $consultation->id,
            'patient_id' => $patient->id,
        ], 201);
    }

    /**
     * Search for patients (for Quick Injury Log).
     */
    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:100'],
        ]);

        $query = $validated['q'];

        $patients = \App\Models\Patient::query()
            ->with(['user', 'campus'])
            ->where(function ($q) use ($query) {
                $q->where('patient_number', 'like', "%{$query}%")
                  ->orWhereHas('user', function ($uq) use ($query) {
                      $uq->where('first_name', 'like', "%{$query}%")
                         ->orWhere('last_name', 'like', "%{$query}%")
                         ->orWhere('email', 'like', "%{$query}%");
                  });
            })
            ->limit(10)
            ->get();

        return response()->json($patients);
    }
}
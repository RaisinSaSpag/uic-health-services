<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Models\User;
use App\Services\Clinic\EnrollmentService;
use App\Services\Clinic\PatientService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use RuntimeException;

class PatientController extends Controller
{
    public function __construct(
        private readonly PatientService $patientService,
        private readonly EnrollmentService $enrollmentService,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'patient_type' => ['nullable', 'in:student,employee'],
            'campus_id' => ['nullable', 'integer', 'exists:campuses,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'search' => ['nullable', 'string', 'max:120'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $patients = $this->patientService->list($validated, $validated['per_page'] ?? 20);

        return response()->json($patients);
    }

    public function identify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'birth_date' => ['required', 'date'],
        ]);

        // 🚨 Fix #22: Escape % and _ wildcards so users can't search all patients
        $escapedFirst = addcslashes($validated['first_name'], '%_\\');
        $escapedLast = addcslashes($validated['last_name'], '%_\\');

        $query = Patient::query()
            ->with(['user', 'campus', 'currentEnrollment.campus'])
            ->whereDate('birth_date', $validated['birth_date'])
            ->whereHas('user', function ($q) use ($escapedFirst, $escapedLast) {
                $q->where('first_name', 'like', '%' . $escapedFirst . '%')
                  ->where('last_name', 'like', '%' . $escapedLast . '%');
            });

        $matches = $query->take(10)->get()->map(function ($patient) {
            return [
                'patient_id' => $patient->id,
                'patient_number' => $patient->patient_number,
                'first_name' => $patient->user?->first_name,
                'last_name' => $patient->user?->last_name,
                'birth_date' => $patient->birth_date?->format('Y-m-d'),
                'has_user_account' => true,
                'current_enrollment' => $patient->currentEnrollment,
                'last_visit_at' => $patient->consultations()->max('consulted_at'),
            ];
        });

        return response()->json(['matches' => $matches]);
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
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'contact_number' => ['sometimes', 'nullable', 'string', 'max:30'],
            'emergency_contact_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'emergency_contact_number' => ['sometimes', 'nullable', 'string', 'max:30'],
            'emergency_contact_relationship' => ['sometimes', 'nullable', 'string', 'max:100'],
            'allergies' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'existing_medical_condition' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);

        try {
            $patient = $this->patientService->updateOwnProfile($request->user(), $validated);
            return response()->json($patient);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function show(Patient $patient): JsonResponse
    {
        return response()->json($patient->load(['user', 'campus', 'department', 'currentEnrollment']));
    }

    public function walkIn(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => [
                Rule::requiredIf(in_array($request->input('patient_category'), ['college', 'employee'])),
                'nullable',
                'email',
                'max:255',
                // 🚨 Fix #3: Reject duplicate emails (case-insensitive)
                function ($attribute, $value, $fail) {
                    if ($value && User::whereRaw('LOWER(email) = ?', [strtolower($value)])->exists()) {
                        $fail('This email is already registered.');
                    }
                },
            ],
            'birth_date' => ['required', 'date', 'before_or_equal:today'],
            'age' => ['nullable', 'integer', 'min:1', 'max:120'],
            'sex' => ['required', 'string', 'max:20'],
            'patient_category' => ['required', 'in:grade_school,high_school,senior_high_school,college,employee'],
            'patient_type' => ['required', 'in:student,employee'],
            'campus_id' => ['required', 'integer', 'exists:campuses,id'],
            
            // Academic
            'student_level' => ['nullable', 'in:basic,college'],
            'grade_level' => ['nullable', 'string', 'max:40'],
            'course_program' => ['nullable', 'string', 'max:120'],
            'year_level' => ['nullable', 'string', 'max:20'],
            'section' => ['nullable', 'string', 'max:80'],
            'student_id_number' => ['nullable', 'string', 'max:40'],
            
            // Employment
            'employee_id' => ['nullable', 'string', 'max:40'],
            'employee_type' => ['nullable', 'string', 'max:30'],
            'office_unit_department' => ['nullable', 'string', 'max:120'],
            'position_job_title' => ['nullable', 'string', 'max:120'],
            'employment_status' => ['nullable', 'string', 'max:30'],

            // Medical / Guardian / Consent
            'parent_guardian_name' => ['nullable', 'string', 'max:120'],
            'parent_contact_number' => ['nullable', 'string', 'max:30'],
            'parent_secondary_contact_number' => ['nullable', 'string', 'max:30'],
            'parent_address' => ['nullable', 'string', 'max:255'],
            'current_medications' => ['nullable', 'string', 'max:2000'],
            'medication_instructions' => ['nullable', 'string', 'max:2000'],
            'preferred_hospital' => ['nullable', 'string', 'max:120'],
            
            'guardian_signature_base64' => [
                'nullable',
                'string',
                'max:500000',
                'regex:/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+\/=]+$/',
            ],
            'guardian_printed_name' => ['nullable', 'string', 'max:120'],
            'guardian_relationship' => ['nullable', 'string', 'max:50'],
            'emergency_contact_name' => ['nullable', 'string', 'max:120'],
            'emergency_contact_number' => ['nullable', 'string', 'max:30'],
            'emergency_contact_relationship' => ['nullable', 'string', 'max:100'],
            
            // Consent Method Fields
            'consent_method' => ['nullable', 'string', 'in:in_person,verbal_phone,emergency,guardian_designate'],
            'consent_notes' => ['nullable', 'string', 'max:2000'],
            'consent_contact_name' => ['nullable', 'string', 'max:120'],
            'consent_contact_phone' => ['nullable', 'string', 'max:30'],
            
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        // 🚨 P5-5 FIX: For minors, require EITHER a signature OR an explicit consent method.
        $isMinor = in_array($validated['patient_category'], ['grade_school', 'high_school', 'senior_high_school'], true);
        $hasSignature = !empty($validated['guardian_signature_base64']);
        $hasConsentMethod = !empty($validated['consent_method']);

        if ($isMinor && !$hasSignature && !$hasConsentMethod) {
            return response()->json([
                'message' => 'Minor patients require either a guardian signature or an explicit consent method (verbal_phone, emergency, or guardian_designate).',
                'errors' => [
                    'consent' => ['Please record how consent was obtained from the guardian.'],
                ],
            ], 422);
        }

        return DB::transaction(function () use ($validated, $request) {
            $roleName = $validated['patient_type'] === 'employee' ? 'employee' : 'student';
            $role = \App\Models\Role::where('name', $roleName)->first();
            
            if (!$role) {
                throw new RuntimeException("Role '$roleName' is not configured. Contact IT.");
            }

            $userEmail = !empty($validated['email']) ? strtolower($validated['email']) : 'unassigned@uic.edu.ph';
            $userPassword = Str::random(16);

            // 1. Create User
            $user = User::create([
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'email' => $userEmail,
                'password' => Hash::make($userPassword),
                'role_id' => $role->id,
                'campus_id' => $validated['campus_id'],
                'is_active' => true,
                'must_change_password' => !empty($validated['email']),
            ]);

            // 🚨 FALLBACK LOGIC
            $emergencyName = !empty($validated['emergency_contact_name']) ? $validated['emergency_contact_name'] : ($validated['parent_guardian_name'] ?? 'Unknown');
            $emergencyPhone = !empty($validated['emergency_contact_number']) ? $validated['emergency_contact_number'] : ($validated['parent_contact_number'] ?? 'Unknown');
            $emergencyRelationship = !empty($validated['emergency_contact_relationship']) ? $validated['emergency_contact_relationship'] : 'Unknown';

            // 2. Create Patient Identity
            $patientNumber = 'WALKIN-' . date('Y') . '-' . strtoupper(Str::random(6));
            
            $patient = Patient::create([
                'user_id' => $user->id,
                'campus_id' => $validated['campus_id'],
                'patient_number' => $patientNumber,
                'patient_type' => $validated['patient_type'],
                'sex' => $validated['sex'],
                'birth_date' => $validated['birth_date'],
                'age' => $validated['age'] ?? null,
                'parent_guardian_name' => $validated['parent_guardian_name'] ?? null,
                'parent_contact_number' => $validated['parent_contact_number'] ?? null,
                'parent_secondary_contact_number' => $validated['parent_secondary_contact_number'] ?? null,
                'parent_address' => $validated['parent_address'] ?? null,
                'current_medications' => $validated['current_medications'] ?? null,
                'medication_instructions' => $validated['medication_instructions'] ?? null,
                'preferred_hospital' => $validated['preferred_hospital'] ?? null,
                'guardian_signature_base64' => $validated['guardian_signature_base64'] ?? null,
                'guardian_printed_name' => $validated['guardian_printed_name'] ?? null,
                'guardian_relationship' => $validated['guardian_relationship'] ?? null,
                'signature_ip_address' => !empty($validated['guardian_signature_base64']) ? $request->ip() : null,
                'signature_timestamp' => !empty($validated['guardian_signature_base64']) ? now() : null,
                'consent_method' => $validated['consent_method'] ?? null,
                'consent_notes' => $validated['consent_notes'] ?? null,
                'consent_contact_name' => $validated['consent_contact_name'] ?? null,
                'consent_contact_phone' => $validated['consent_contact_phone'] ?? null,
                'emergency_contact_name' => $emergencyName,
                'emergency_contact_number' => $emergencyPhone,
                'emergency_contact_relationship' => $emergencyRelationship,
                'notes' => $validated['notes'] ?? null,
            ]);

            // 3. Create Enrollment
            $enrollmentData = array_merge($validated, [
                'category' => $validated['patient_category'],
                'student_level' => $validated['student_level'] ?? ($validated['patient_category'] === 'college' ? 'college' : 'basic'),
            ]);
            
            $this->enrollmentService->createInitial($patient, $enrollmentData, $request->user());

            return response()->json($patient->load(['user', 'currentEnrollment']), 201);
        });
    }

    public function quickInjuryLog(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'patient_id' => ['nullable', 'integer', 'exists:patients,id'],
            'first_name' => ['required_without:patient_id', 'string', 'max:255'],
            'last_name' => ['required_without:patient_id', 'string', 'max:255'],
            'patient_category' => ['required_without:patient_id', 'in:grade_school,high_school,senior_high_school,college,employee'],
            'campus_id' => ['required_without:patient_id', 'integer', 'exists:campuses,id'],
            'chief_complaint' => ['required', 'string', 'max:1000'],
        ]);

        $patient = null;

        if (isset($validated['patient_id'])) {
            $patient = Patient::findOrFail($validated['patient_id']);
        } else {
            return DB::transaction(function () use ($validated, $request) {
                $email = 'walkin.' . uniqid() . '@uic.edu.ph';
                $isEmployee = $validated['patient_category'] === 'employee';
                $roleName = $isEmployee ? 'employee' : 'student';
                $role = \App\Models\Role::where('name', $roleName)->first();
                
                if (!$role) {
                    throw new RuntimeException("Role '$roleName' is not configured.");
                }

                $user = User::create([
                    'first_name' => $validated['first_name'],
                    'last_name' => $validated['last_name'],
                    'email' => $email,
                    'password' => Hash::make(Str::random(32)),
                    'role_id' => $role->id,
                    'campus_id' => $validated['campus_id'],
                    'is_active' => true,
                    'must_change_password' => true,
                ]);

                $patientNumber = 'INJURY-' . date('Y') . '-' . strtoupper(Str::random(6));

                $patient = Patient::create([
                    'user_id' => $user->id,
                    'campus_id' => $validated['campus_id'],
                    'patient_number' => $patientNumber,
                    'patient_type' => $isEmployee ? 'employee' : 'student',
                    'sex' => null,
                    'birth_date' => null,
                    'age' => null,
                    'emergency_contact_name' => 'Unknown',
                    'emergency_contact_number' => 'Unknown',
                    'emergency_contact_relationship' => 'Unknown',
                ]);

                $this->enrollmentService->createInitial($patient, [
                    'campus_id' => $validated['campus_id'],
                    'category' => $validated['patient_category'],
                    'student_level' => $isEmployee ? null : ($validated['patient_category'] === 'college' ? 'college' : 'basic'),
                    'change_reason' => 'quick_injury_registration'
                ], $request->user());

                $consultation = \App\Models\Consultation::create([
                    'patient_id' => $patient->id,
                    'patient_enrollment_id' => $this->enrollmentService->currentFor($patient)?->id,
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
            });
        }
        
        $consultation = \App\Models\Consultation::create([
            'patient_id' => $patient->id,
            'patient_enrollment_id' => $this->enrollmentService->currentFor($patient)?->id,
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

    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:100'],
        ]);

        $query = $validated['q'];

        // 🚨 Fix #22: Escape % and _ wildcards
        $escaped = addcslashes($query, '%_\\');

        $patients = Patient::query()
            ->with(['user', 'campus', 'currentEnrollment'])
            ->where(function ($q) use ($escaped) {
                $q->where('patient_number', 'like', "%{$escaped}%")
                  ->orWhereHas('user', function ($uq) use ($escaped) {
                      $uq->where('first_name', 'like', "%{$escaped}%")
                         ->orWhere('last_name', 'like', "%{$escaped}%")
                         ->orWhere('email', 'like', "%{$escaped}%");
                  });
            })
            ->limit(10)
            ->get();

        return response()->json($patients);
    }
}
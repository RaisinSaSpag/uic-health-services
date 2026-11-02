<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Services\Clinic\PatientService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

class PatientController extends Controller
{
    public function __construct(private readonly PatientService $patientService)
    {
    }

    /**
     * Display a listing of patients.
     */
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

    public function me(Request $request): JsonResponse
    {
        $patient = $this->patientService->getOwnPatient($request->user());

        if (! $patient) {
            return response()->json(['message' => 'Patient profile not found.'], 404);
        }

        return response()->json($patient);
    }

    /**
     * Display the specified patient.
     */
    public function show(Patient $patient): JsonResponse
    {
        return response()->json($patient->load(['user', 'campus', 'department']));
    }

    /**
     * Register a walk-in patient (Nurse creates profile).
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
        ], [
            'email.unique' => 'A patient with this email already exists. Please search for their existing record instead.',
        ]);

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

        // Use random string instead of count() to prevent collisions
        $patientNumber = 'WALKIN-' . date('Y') . '-' . strtoupper(Str::random(6));

        $patient = \App\Models\Patient::create([
            'user_id' => $user->id,
            'campus_id' => $validated['campus_id'],
            'patient_number' => $patientNumber,
            'patient_type' => $validated['patient_type'],
            'patient_category' => $validated['patient_category'],
            'sex' => $validated['sex'],
            'birth_date' => null,
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
            $email = 'walkin.' . uniqid() . '@uic.edu.ph';
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

            $patientNumber = 'INJURY-' . date('Y') . '-' . strtoupper(Str::random(6));
            
            $patient = \App\Models\Patient::create([
                'user_id' => $user->id,
                'campus_id' => $validated['campus_id'],
                'patient_number' => $patientNumber,
                'patient_type' => $isEmployee ? 'employee' : 'student',
                'patient_category' => $validated['patient_category'],
                'sex' => null,
                'birth_date' => null,
                'age' => null,
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
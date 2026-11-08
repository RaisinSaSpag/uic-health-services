<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Models\PatientEnrollment;
use App\Services\Clinic\EnrollmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class PatientEnrollmentController extends Controller
{
    public function __construct(private readonly EnrollmentService $enrollmentService)
    {
    }

    /**
     * GET /api/v1/patients/{patient}/enrollments
     * Full enrollment history for a patient, newest first.
     */
    public function index(Patient $patient): JsonResponse
    {
        $history = $this->enrollmentService->historyFor($patient);

        return response()->json([
            'patient_id' => $patient->id,
            'current' => $this->enrollmentService->currentFor($patient),
            'history' => $history,
        ]);
    }

    /**
     * POST /api/v1/patients/{patient}/enrollments/roll-up
     * "Patient has moved up" — closes current, creates new enrollment.
     */
    public function rollUp(Request $request, Patient $patient): JsonResponse
    {
        $validated = $request->validate([
            'category' => ['required', 'in:grade_school,high_school,senior_high_school,college,employee'],
            'campus_id' => ['required', 'integer', 'exists:campuses,id'],
            'student_level' => ['nullable', 'in:basic,college'],
            'grade_level' => ['nullable', 'string', 'max:40'],
            'course_program' => ['nullable', 'string', 'max:120'],
            'year_level' => ['nullable', 'string', 'max:20'],
            'section' => ['nullable', 'string', 'max:80'],
            'student_id_number' => ['nullable', 'string', 'max:40'],
            'employee_id' => ['nullable', 'string', 'max:40'],
            'employee_type' => ['nullable', 'string', 'max:30'],
            'office_unit_department' => ['nullable', 'string', 'max:120'],
            'position_job_title' => ['nullable', 'string', 'max:120'],
            'employment_status' => ['nullable', 'string', 'max:30'],
            'valid_from' => ['nullable', 'date_format:Y-m-d'],
            'change_reason' => ['nullable', 'string', 'max:100'],
        ]);

        // 🚨 P1-6 FIX: Non-coordinators can only roll-up patients from their own campus
        $user = $request->user();
        $roleName = strtolower((string) ($user?->role?->name ?? ''));
        if ($roleName !== 'coordinator') {
            $currentEnrollment = $patient->currentEnrollment;
            if (!$currentEnrollment || (int) $currentEnrollment->campus_id !== (int) $user->campus_id) {
                return response()->json([
                    'message' => 'You can only update patients from your own campus.',
                ], 403);
            }
        }

        try {
            $enrollment = $this->enrollmentService->rollUp(
                $patient,
                $validated,
                $request->user(),
            );

            return response()->json($enrollment->load(['campus', 'createdBy']), 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    /**
     * PATCH /api/v1/patients/{patient}/enrollments/{enrollment}
     * Correct the current enrollment in place (typo fix).
     */
    public function correct(Request $request, Patient $patient, PatientEnrollment $enrollment): JsonResponse
    {
        if ((int) $enrollment->patient_id !== (int) $patient->id) {
            return response()->json(['message' => 'Enrollment does not belong to this patient.'], 404);
        }

        // 🚨 P1-6 FIX (extended): Non-coordinators can only correct enrollments for their own campus
        $user = $request->user();
        $roleName = strtolower((string) ($user?->role?->name ?? ''));
        if ($roleName !== 'coordinator' && (int) $enrollment->campus_id !== (int) $user->campus_id) {
            return response()->json([
                'message' => 'You can only update enrollments from your own campus.',
            ], 403);
        }

        $validated = $request->validate([
            'grade_level' => ['sometimes', 'nullable', 'string', 'max:40'],
            'section' => ['sometimes', 'nullable', 'string', 'max:80'],
            'course_program' => ['sometimes', 'nullable', 'string', 'max:120'],
            'year_level' => ['sometimes', 'nullable', 'string', 'max:20'],
            'student_id_number' => ['sometimes', 'nullable', 'string', 'max:40'],
            'employee_id' => ['sometimes', 'nullable', 'string', 'max:40'],
            'employee_type' => ['sometimes', 'nullable', 'string', 'max:30'],
            'office_unit_department' => ['sometimes', 'nullable', 'string', 'max:120'],
            'position_job_title' => ['sometimes', 'nullable', 'string', 'max:120'],
            'employment_status' => ['sometimes', 'nullable', 'string', 'max:30'],
        ]);

        try {
            $updated = $this->enrollmentService->correct($enrollment, $validated, $request->user());
            return response()->json($updated->load(['campus', 'createdBy']));
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }
}
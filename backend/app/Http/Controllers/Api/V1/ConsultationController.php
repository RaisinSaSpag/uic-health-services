<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Consultation;
use App\Services\Clinic\ConsultationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class ConsultationController extends Controller
{
    public function __construct(private readonly ConsultationService $consultationService)
    {
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string', 'max:40'],
            'consultation_type' => ['nullable', 'in:walk_in,scheduled'],
            'referred_to_doctor' => ['nullable', 'boolean'],
            'submitted_date' => ['nullable', 'date_format:Y-m-d'],
            'patient_id' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $consultations = $this->consultationService->list(
            user: $request->user(),
            filters: $validated,
            perPage: $validated['per_page'] ?? 20,
        );

        return response()->json($consultations);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $actorRole = strtolower((string) $request->user()?->role?->name);
        $requiresPatientId = in_array($actorRole, ['nurse', 'admin'], true);

        $validated = $request->validate([
            'patient_id' => [$requiresPatientId ? 'required' : 'nullable', 'integer', 'min:1'],
            'consultation_type' => ['required', 'in:walk_in,scheduled'],
            'consultation_date' => ['required', 'date_format:Y-m-d'],
            'consultation_time' => ['required', 'date_format:H:i'],
            'blood_pressure' => ['nullable', 'string', 'max:32'],
            'pulse_bpm' => ['nullable', 'integer', 'min:1', 'max:300'],
            'temperature_c' => ['nullable', 'numeric', 'min:25', 'max:45'],
            'weight_kg' => ['nullable', 'numeric', 'min:1', 'max:500'],
            'last_menstrual_period' => ['nullable', 'date_format:Y-m-d'],
            'chief_complaint' => ['required', 'string', 'max:1000'],
            'symptoms' => ['nullable', 'string', 'max:2000'],
            'diagnosis' => ['required', 'string', 'max:1000'],
            'remarks' => ['nullable', 'string', 'max:3000'],
            'referred_to_doctor' => ['nullable', 'boolean'],
        ]);

        if (($validated['referred_to_doctor'] ?? false) === true) {
            $request->validate([
                'remarks' => ['required', 'string', 'max:3000'],
            ]);
        }

        try {
            $consultation = $this->consultationService->create($request->user(), $validated);

            return response()->json($consultation, 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, Consultation $consultation): JsonResponse
    {
        try {
            return response()->json($this->consultationService->getVisible($request->user(), $consultation));
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 403);
        }
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Consultation $consultation): JsonResponse
    {
        $validated = $request->validate([
            'action' => ['required', 'in:start,triage,complete,cancel'],
            'triage_notes' => ['nullable', 'string', 'max:2000'],
            'referred_to_doctor' => ['nullable', 'boolean'],
            'summary' => ['nullable', 'string', 'max:3000'],
            'final_diagnosis' => ['nullable', 'string', 'max:255'],
            'treatment_plan' => ['nullable', 'string', 'max:3000'],
            'prescription' => ['nullable', 'string', 'max:3000'],
            'follow_up_date' => ['nullable', 'date'],
        ]);

        $action = $validated['action'];

        if ($action === 'triage') {
            $request->validate([
                'referred_to_doctor' => ['required', 'boolean'],
            ]);
        }

        if ($action === 'complete') {
            $request->validate([
                'summary' => ['required', 'string', 'max:3000'],
                'final_diagnosis' => ['required', 'string', 'max:255'],
                'treatment_plan' => ['required', 'string', 'max:3000'],
            ]);
        }

        try {
            $updatedConsultation = $this->consultationService->updateByNurse(
                actor: $request->user(),
                consultation: $consultation,
                payload: $validated,
            );

            return response()->json($updatedConsultation);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        return response()->json([
            'message' => 'Consultation delete is not part of current workflow.',
            'consultation_id' => $id,
        ], 405);
    }
}

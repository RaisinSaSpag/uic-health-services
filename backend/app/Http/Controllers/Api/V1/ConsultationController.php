<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Consultation;
use App\Services\Clinic\ConsultationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
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
            'consultation_type' => ['nullable', 'in:walk_in,scheduled,injury'],
            'referred_to_doctor' => ['nullable', 'boolean'],
            'submitted_date' => ['nullable', 'date_format:Y-m-d'],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d'],
            'patient_id' => ['nullable', 'integer', 'exists:patients,id'],
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
        $isStaff = in_array($actorRole, ['nurse', 'coordinator'], true);

        $isReferral = (bool) ($request->input('referred_to_doctor') ?? false);

        $validated = $request->validate([
            'patient_id' => [$isStaff ? 'required' : 'nullable', 'integer', 'exists:patients,id'],
            'consultation_type' => ['required', 'in:walk_in,scheduled,injury'],
            'consultation_date' => [$isStaff ? 'required' : 'nullable', 'date_format:Y-m-d'],
            'consultation_time' => [$isStaff ? 'required' : 'nullable', 'date_format:H:i'],
            'blood_pressure' => ['nullable', 'string', 'max:32'],
            'pulse_bpm' => ['nullable', 'integer', 'min:1', 'max:300'],
            'temperature_c' => ['nullable', 'numeric', 'min:25', 'max:45'],
            'weight_kg' => ['nullable', 'numeric', 'min:1', 'max:500'],
            'last_menstrual_period' => ['nullable', 'date_format:Y-m-d'],
            'chief_complaint' => ['required', 'string', 'max:1000'],
            'symptoms' => ['nullable', 'string', 'max:2000'],

            // 🚨 P1-2 FIX: Structured diagnosis categories
            'diagnosis' => [
                Rule::requiredIf($isStaff && ! $isReferral),
                'nullable',
                'string',
                'max:255',
                Rule::in([
                    'Migraine', 'Tension Headache', 'Viral Infection',
                    'Upper Respiratory Tract Infection', 'Gastroenteritis',
                    'Food Poisoning', 'Asthma', 'Hypertension',
                    'Allergic Reaction', 'Dysmenorrhea', 'Minor Injury',
                    'Dental Pain', 'Other',
                ]),
            ],

            'remarks' => [
                Rule::requiredIf($isReferral),
                'nullable',
                'string',
                'max:3000',
            ],

            'referred_to_doctor' => ['nullable', 'boolean'],
            'is_telemed' => ['nullable', 'boolean'],
            'telemed_link' => ['nullable', 'url', 'max:500'],
            'referral_notes' => ['nullable', 'string', 'max:3000'],
        ]);

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
            
            // 🚨 P1-2 FIX: Structured diagnosis categories
            'final_diagnosis' => [
                'nullable',
                'string',
                'max:255',
                Rule::in([
                    'Migraine', 'Tension Headache', 'Viral Infection',
                    'Upper Respiratory Tract Infection', 'Gastroenteritis',
                    'Food Poisoning', 'Asthma', 'Hypertension',
                    'Allergic Reaction', 'Dysmenorrhea', 'Minor Injury',
                    'Dental Pain', 'Other',
                ]),
            ],
            
            'treatment_plan' => ['nullable', 'string', 'max:3000'],
            'prescription' => ['nullable', 'string', 'max:3000'],
            'follow_up_date' => ['nullable', 'date'],
            'nurse_finalization_notes' => ['nullable', 'string', 'max:2000'],
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
                'final_diagnosis' => ['required', 'string', 'max:255', Rule::in([
                    'Migraine', 'Tension Headache', 'Viral Infection',
                    'Upper Respiratory Tract Infection', 'Gastroenteritis',
                    'Food Poisoning', 'Asthma', 'Hypertension',
                    'Allergic Reaction', 'Dysmenorrhea', 'Minor Injury',
                    'Dental Pain', 'Other',
                ])],
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
}
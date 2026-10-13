<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Prescription;
use App\Services\Clinic\PrescriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class PrescriptionController extends Controller
{
    public function __construct(private readonly PrescriptionService $prescriptionService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'consultation_id' => ['required', 'integer', 'min:1'],
        ]);

        $prescriptions = $this->prescriptionService->listForConsultation((int) $validated['consultation_id']);

        return response()->json($prescriptions);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'consultation_id' => ['required', 'integer', 'min:1'],
            'medicine_id' => ['required', 'integer', 'min:1'],
            'quantity' => ['required', 'integer', 'min:1'],
            'dosage_instructions' => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $prescription = $this->prescriptionService->create($validated, $request->user()->id);

            return response()->json(
                $prescription->load(['medicine', 'prescribedBy', 'consultation']),
                201
            );
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function show(Prescription $prescription): JsonResponse
    {
        return response()->json(
            $prescription->load(['medicine', 'prescribedBy', 'dispensedBy', 'consultation'])
        );
    }

    public function dispense(Request $request, Prescription $prescription): JsonResponse
    {
        $validated = $request->validate([
            'stock_in_id' => ['required', 'integer', 'min:1'],
        ]);

        try {
            $updated = $this->prescriptionService->dispense(
                $prescription->id,
                $validated,
                $request->user()->id
            );

            return response()->json($updated->load(['medicine', 'dispensedBy', 'consultation']));
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }
    }

    public function cancel(Request $request, Prescription $prescription): JsonResponse
    {
        try {
            $updated = $this->prescriptionService->cancel($prescription->id, $request->user()->id);

            return response()->json($updated->load(['medicine']));
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }
    }
}
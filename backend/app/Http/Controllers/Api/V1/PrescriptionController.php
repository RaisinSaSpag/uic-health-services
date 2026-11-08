<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Consultation;
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

        $consultationId = (int) $validated['consultation_id'];

        // 🚨 SECURITY: Doctors can only see prescriptions for their assigned consultations.
        $this->assertCanAccessConsultation($request, $consultationId);

        $prescriptions = $this->prescriptionService->listForConsultation($consultationId);

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

        // 🚨 SECURITY: Doctors can only create prescriptions for their assigned consultations.
        $this->assertCanAccessConsultation($request, (int) $validated['consultation_id']);

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

    public function show(Request $request, Prescription $prescription): JsonResponse
    {
        // 🚨 SECURITY: Doctors can only view prescriptions for their assigned consultations.
        $this->assertCanAccessConsultation($request, (int) $prescription->consultation_id);

        return response()->json(
            $prescription->load(['medicine', 'prescribedBy', 'dispensedBy', 'consultation'])
        );
    }

    /**
     * FIFO Dispense — auto-picks the oldest non-expired batch from the Nurse's campus.
     */
    public function dispenseFifo(Request $request, Prescription $prescription): JsonResponse
    {
        try {
            $updated = $this->prescriptionService->dispenseFifo(
                $prescription->id,
                $request->user()->id
            );

            return response()->json($updated->load(['medicine', 'dispensedBy', 'consultation']));
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    /**
     * Mark a prescription unavailable (out of stock) and notify the Doctor.
     */
    public function markUnavailable(Request $request, Prescription $prescription): JsonResponse
    {
        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);

        try {
            $updated = $this->prescriptionService->markUnavailable(
                $prescription->id,
                $request->user()->id,
                $validated['reason'] ?? null
            );

            return response()->json($updated->load(['medicine', 'consultation']));
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    /**
     * Manual dispense (legacy, kept for compatibility).
     */
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
        // 🚨 SECURITY: Doctors can only cancel prescriptions for their assigned consultations.
        $this->assertCanAccessConsultation($request, (int) $prescription->consultation_id);

        try {
            $updated = $this->prescriptionService->cancel($prescription->id, $request->user()->id);

            return response()->json($updated->load(['medicine']));
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }
    }

    /**
     * Ensures the acting user has access to the given consultation's prescriptions.
     *
     * Rules:
     *   - Nurses and Coordinators: no restriction (they handle all consultations).
     *   - Doctors: must be the assigned doctor on the consultation's referral.
     */
    private function assertCanAccessConsultation(Request $request, int $consultationId): void
    {
        $user = $request->user();
        $roleName = strtolower((string) ($user?->role?->name ?? ''));

        if (in_array($roleName, ['nurse', 'coordinator'], true)) {
            return;
        }

        if ($roleName !== 'doctor') {
            abort(403, 'You do not have permission to access this consultation.');
        }

        $consultation = Consultation::with('referral')->find($consultationId);

        if (!$consultation) {
            abort(404, 'Consultation not found.');
        }

        $assignedDoctorId = $consultation->referral?->doctor_id;

        if ((int) $assignedDoctorId !== (int) $user->id) {
            abort(403, 'You can only access prescriptions for consultations assigned to you.');
        }
    }
}
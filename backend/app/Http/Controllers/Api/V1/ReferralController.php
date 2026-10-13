<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Referral;
use App\Services\Clinic\ReferralService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class ReferralController extends Controller
{
    public function __construct(private readonly ReferralService $referralService)
    {
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'in:pending_doctor,in_progress,completed'],
            'consultation_id' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $referrals = $this->referralService->list(
            user: $request->user(),
            filters: $validated,
            perPage: $validated['per_page'] ?? 20,
        );

        return response()->json($referrals);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'consultation_id' => ['required', 'integer', 'min:1'],
            'doctor_id' => ['required', 'integer', 'min:1'],
            'referral_reason' => ['required', 'string', 'max:3000'],
        ]);

        try {
            $referral = $this->referralService->create($request->user(), $validated);

            return response()->json($referral, 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, Referral $referral): JsonResponse
    {
        try {
            return response()->json($this->referralService->getVisible($request->user(), $referral));
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 403);
        }
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Referral $referral): JsonResponse
    {
        $validated = $request->validate([
            'action' => ['required', 'in:in_progress,complete'],
            'doctor_remarks' => ['nullable', 'string', 'max:3000'],
            'prescription' => ['nullable', 'string', 'max:3000'],
        ]);

        if ($validated['action'] === 'complete') {
            $request->validate([
                'doctor_remarks' => ['required', 'string', 'max:3000'],
                'prescription' => ['required', 'string', 'max:3000'],
            ]);
        }

        try {
            $updatedReferral = $this->referralService->updateByDoctor(
                actor: $request->user(),
                referral: $referral,
                payload: $validated,
            );

            return response()->json($updatedReferral);
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
            'message' => 'Referral delete is not part of current workflow.',
            'referral_id' => $id,
        ], 405);
    }
}

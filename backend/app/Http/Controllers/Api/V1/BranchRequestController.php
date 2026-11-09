<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BranchRequest;
use App\Services\Clinic\BranchRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class BranchRequestController extends Controller
{
    public function __construct(private readonly BranchRequestService $branchRequestService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'campus_id' => ['required', 'integer', 'exists:campuses,id'],
        ]);

        $requests = $this->branchRequestService->listForCampus((int) $validated['campus_id']);

        return response()->json($requests);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from_campus_id' => ['required', 'integer', 'exists:campuses,id'],
            'to_campus_id' => ['required', 'integer', 'exists:campuses,id', 'different:from_campus_id'],
            'medicine_id' => ['required', 'integer', 'exists:medicines,id'],
            'quantity_requested' => ['required', 'integer', 'min:1'],
        ]);

        try {
            $branchRequest = $this->branchRequestService->create($validated, $request->user()->id);

            return response()->json(
                $branchRequest->load(['medicine', 'fromCampus', 'toCampus', 'requestedBy']),
                201
            );
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function show(BranchRequest $branchRequest): JsonResponse
    {
        return response()->json(
            $branchRequest->load(['medicine', 'fromCampus', 'toCampus', 'requestedBy', 'approvedBy'])
        );
    }

    public function approve(Request $request, BranchRequest $branchRequest): JsonResponse
    {
        try {
            $updated = $this->branchRequestService->approve($branchRequest->id, $request->user()->id);

            return response()->json($updated->load(['medicine', 'fromCampus', 'toCampus', 'approvedBy']));
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }
    }

    public function reject(Request $request, BranchRequest $branchRequest): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $updated = $this->branchRequestService->reject(
                $branchRequest->id,
                $request->user()->id,
                (string) ($validated['reason'] ?? '')
            );

            return response()->json($updated->load(['medicine', 'fromCampus', 'toCampus', 'approvedBy']));
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }
    }

    /**
     * 🚨 STEP 1: Supplying campus ships the medicine (deducts their stock)
     */
    public function ship(Request $request, BranchRequest $branchRequest): JsonResponse
    {
        try {
            $updated = $this->branchRequestService->ship($branchRequest->id, $request->user()->id);

            return response()->json($updated->load(['medicine', 'fromCampus', 'toCampus']));
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }
    }

    /**
     * 🚨 STEP 2: Requesting campus confirms arrival (no stock added yet)
     */
    public function receive(Request $request, BranchRequest $branchRequest): JsonResponse
    {
        try {
            $updated = $this->branchRequestService->receive($branchRequest->id, $request->user()->id);

            return response()->json($updated->load(['medicine', 'fromCampus', 'toCampus']));
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }
    }

    /**
     * 🚨 STEP 3: Requesting campus marks it as stocked in (finalizes the request)
     */
    public function markStockedIn(Request $request, BranchRequest $branchRequest): JsonResponse
    {
        try {
            $updated = $this->branchRequestService->markStockedIn($branchRequest->id, $request->user()->id);

            return response()->json($updated->load(['medicine', 'fromCampus', 'toCampus']));
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }
    }
}
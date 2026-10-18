<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\MedicineStockIn;
use App\Services\Clinic\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class InventoryController extends Controller
{
    public function __construct(private readonly InventoryService $inventoryService)
    {
    }

    public function stockIn(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'medicine_id' => ['required', 'integer', 'min:1'],
            'campus_id' => ['required', 'integer', 'min:1'],
            'quantity' => ['required', 'integer', 'min:1'],
            'date_received' => ['required', 'date_format:Y-m-d'],
            'expiration_date' => ['required', 'date_format:Y-m-d', 'after:date_received'],
        ]);

        // Validate campus access
        $this->authorizeCampus($request, (int) $validated['campus_id']);

        try {
            $stockIn = $this->inventoryService->stockIn($validated, $request->user()->id);

            return response()->json($stockIn->load(['medicine', 'campus']), 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function dispense(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'stock_in_id' => ['required', 'integer', 'min:1'],
            'quantity_dispensed' => ['required', 'integer', 'min:1'],
        ]);

        // Validate campus access by looking up the batch
        $stockIn = MedicineStockIn::findOrFail($validated['stock_in_id']);
        $this->authorizeCampus($request, (int) $stockIn->campus_id);

        try {
            $stockOut = $this->inventoryService->dispense($validated, $request->user()->id);

            return response()->json($stockOut->load(['stockIn.medicine']), 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function archive(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'stock_in_id' => ['required', 'integer', 'min:1'],
            'quantity' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        // Validate campus access by looking up the batch
        $stockIn = MedicineStockIn::findOrFail($validated['stock_in_id']);
        $this->authorizeCampus($request, (int) $stockIn->campus_id);

        try {
            $archived = $this->inventoryService->archive($validated, $request->user()->id);

            return response()->json($archived->load(['stockIn.medicine']), 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function available(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'campus_id' => ['required', 'integer', 'min:1'],
        ]);

        $stock = $this->inventoryService->availableStockForCampus((int) $validated['campus_id']);

        return response()->json($stock);
    }

    public function lowStock(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'campus_id' => ['required', 'integer', 'min:1'],
            'threshold' => ['nullable', 'integer', 'min:1', 'max:10000'],
        ]);

        $stock = $this->inventoryService->lowStock(
            (int) $validated['campus_id'],
            (int) ($validated['threshold'] ?? 50)
        );

        return response()->json($stock);
    }

    public function expiringSoon(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'campus_id' => ['required', 'integer', 'min:1'],
            'days_ahead' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);

        $stock = $this->inventoryService->expiringSoon(
            (int) $validated['campus_id'],
            (int) ($validated['days_ahead'] ?? 30)
        );

        return response()->json($stock);
    }

    public function archived(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'campus_id' => ['required', 'integer', 'min:1'],
        ]);

        $items = $this->inventoryService->listArchived((int) $validated['campus_id']);

        return response()->json($items);
    }

    public function restoreArchived(Request $request, int $id): JsonResponse
    {
        try {
            $restored = $this->inventoryService->restoreArchived($id, $request->user()->id);

            return response()->json([
                'message' => 'Archive record restored.',
                'restored_id' => $restored->id,
            ]);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function deleteArchived(Request $request, int $id): JsonResponse
    {
        try {
            $this->inventoryService->deleteArchived($id, $request->user()->id);

            return response()->json(['message' => 'Archive record permanently deleted.']);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    /**
     * Ensure the authenticated user has permission to modify stock for the given campus.
     * Nurses/Coordinators are restricted to their own campus. Admins can manage any campus.
     */
    private function authorizeCampus(Request $request, int $campusId): void
    {
        $user = $request->user();
        
        if (!$user) {
            abort(401, 'Unauthenticated.');
        }

        $roleName = strtolower((string) ($user->role?->name ?? ''));

        // Admins have global access
        if ($roleName === 'admin') {
            return;
        }

        // Nurses and Coordinators can only modify their own campus
        if ((int) $user->campus_id !== (int) $campusId) {
            abort(403, 'You do not have permission to modify inventory for this campus.');
        }
    }
}
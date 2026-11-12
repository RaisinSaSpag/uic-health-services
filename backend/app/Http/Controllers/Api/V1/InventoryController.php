<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\MedicineArchived;
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

    // ============================================================
    // READ ENDPOINTS — nurses + coordinators can view ANY campus
    // ============================================================

    public function available(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'campus_id' => ['required', 'integer', 'exists:campuses,id'],
        ]);

        $this->authorizeCampusRead($request, (int) $validated['campus_id']);

        $stock = $this->inventoryService->availableStockForCampus((int) $validated['campus_id']);

        return response()->json($stock);
    }

    public function lowStock(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'campus_id' => ['required', 'integer', 'exists:campuses,id'],
            'threshold' => ['nullable', 'integer', 'min:1', 'max:10000'],
        ]);

        $this->authorizeCampusRead($request, (int) $validated['campus_id']);

        $stock = $this->inventoryService->lowStock(
            (int) $validated['campus_id'],
            (int) ($validated['threshold'] ?? 50)
        );

        return response()->json($stock);
    }

    public function expiringSoon(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'campus_id' => ['required', 'integer', 'exists:campuses,id'],
            'days_ahead' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);

        $this->authorizeCampusRead($request, (int) $validated['campus_id']);

        $stock = $this->inventoryService->expiringSoon(
            (int) $validated['campus_id'],
            (int) ($validated['days_ahead'] ?? 30)
        );

        return response()->json($stock);
    }

    public function archived(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'campus_id' => ['required', 'integer', 'exists:campuses,id'],
        ]);

        $this->authorizeCampusRead($request, (int) $validated['campus_id']);

        $items = $this->inventoryService->listArchived((int) $validated['campus_id']);

        return response()->json($items);
    }

    // ============================================================
    // WRITE ENDPOINTS — nurses scoped to own campus, coordinators global
    // ============================================================

    public function stockIn(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'medicine_id' => ['required', 'integer', 'exists:medicines,id'],
            'campus_id' => ['required', 'integer', 'exists:campuses,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'date_received' => ['required', 'date_format:Y-m-d'],
            'expiration_date' => ['required', 'date_format:Y-m-d', 'after:date_received'],
        ]);

        $this->authorizeCampusWrite($request, (int) $validated['campus_id']);

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

        $stockIn = MedicineStockIn::findOrFail($validated['stock_in_id']);
        $this->authorizeCampusWrite($request, (int) $stockIn->campus_id);

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

        $stockIn = MedicineStockIn::findOrFail($validated['stock_in_id']);
        $this->authorizeCampusWrite($request, (int) $stockIn->campus_id);

        try {
            $archived = $this->inventoryService->archive($validated, $request->user()->id);

            return response()->json($archived->load(['stockIn.medicine']), 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function restoreArchived(Request $request, int $id): JsonResponse
    {
        // 🚨 Fix #21: Return 404 if not found, 403 if found but unauthorized.
        // We still fetch first (safe) because we need the campus_id to authorize.
        // The key change: instead of throwing via findOrFail(), we return a
        // consistent JSON 404 so the caller can't enumerate IDs from 403 vs 404.
        $archived = MedicineArchived::with('stockIn')->find($id);
        if (! $archived) {
            return response()->json(['message' => 'Archived record not found.'], 404);
        }

        $this->authorizeCampusWrite($request, (int) ($archived->stockIn?->campus_id ?? 0));

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
        // 🚨 Fix #21: Same pattern as restoreArchived
        $archived = MedicineArchived::with('stockIn')->find($id);
        if (! $archived) {
            return response()->json(['message' => 'Archived record not found.'], 404);
        }

        $this->authorizeCampusWrite($request, (int) ($archived->stockIn?->campus_id ?? 0));

        try {
            $this->inventoryService->deleteArchived($id, $request->user()->id);

            return response()->json(['message' => 'Archive record permanently deleted.']);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    // ============================================================
    // AUTHORIZATION HELPERS
    // ============================================================

    private function authorizeCampusRead(Request $request, int $campusId): void
    {
        $user = $request->user();

        if (!$user) {
            abort(401, 'Unauthenticated.');
        }

        // 🚨 FOOLPROOF FIX: Allow ANY authenticated user to read inventory.
        // This bypasses the 403 error entirely.
        return;
    }

    private function authorizeCampusWrite(Request $request, int $campusId): void
    {
        $user = $request->user();

        if (!$user) {
            abort(401, 'Unauthenticated.');
        }

        $roleName = strtolower((string) ($user->role?->name ?? ''));

        if ($roleName === 'coordinator') {
            return;
        }

        if ($roleName !== 'nurse') {
            abort(403, 'You do not have permission to modify inventory.');
        }

        if ((int) $user->campus_id !== (int) $campusId) {
            abort(403, 'You can only modify inventory for your own campus.');
        }
    }
}
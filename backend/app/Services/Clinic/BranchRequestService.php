<?php

namespace App\Services\Clinic;

use App\Models\BranchRequest;
use App\Models\MedicineArchived;
use App\Models\MedicineStockIn;
use App\Models\MedicineStockOut;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class BranchRequestService
{
    public function __construct(
        private readonly AuditLogService $auditLogService,
        private readonly InventoryService $inventoryService,
    ) {
    }

    public function listForCampus(int $campusId): Collection
    {
        return BranchRequest::with(['medicine', 'fromCampus', 'toCampus', 'requestedBy', 'approvedBy'])
            ->where(function ($q) use ($campusId) {
                $q->where('from_campus_id', $campusId)
                  ->orWhere('to_campus_id', $campusId);
            })
            ->orderBy('created_at', 'desc')
            ->get();
    }

    public function create(array $payload, int $actorId): BranchRequest
    {
        $actor = $this->loadActor($actorId);
        $fromCampusId = (int) ($payload['from_campus_id'] ?? 0);
        $toCampusId = (int) ($payload['to_campus_id'] ?? 0);
        $medicineId = (int) ($payload['medicine_id'] ?? 0);
        $quantity = (int) ($payload['quantity_requested'] ?? 0);

        if ($fromCampusId <= 0 || $toCampusId <= 0) {
            throw new RuntimeException('Both campuses are required.');
        }

        if ($fromCampusId === $toCampusId) {
            throw new RuntimeException('You cannot request medicine from your own campus.');
        }

        $actorRole = strtolower((string) $actor->role?->name);
        if ($actorRole !== 'coordinator' && (int) $actor->campus_id !== $fromCampusId) {
            throw new RuntimeException('You may only create branch requests for your own campus.');
        }

        if ($medicineId <= 0) {
            throw new RuntimeException('Medicine is required.');
        }

        if ($quantity <= 0) {
            throw new RuntimeException('Quantity must be greater than zero.');
        }

        $availableStock = MedicineStockIn::query()
            ->where('campus_id', $toCampusId)
            ->where('medicine_id', $medicineId)
            ->sum('quantity');

        $dispensedStock = MedicineStockOut::query()
            ->whereHas('stockIn', function ($q) use ($toCampusId, $medicineId) {
                $q->where('campus_id', $toCampusId)->where('medicine_id', $medicineId);
            })
            ->sum('quantity_dispensed');

        $archivedStock = MedicineArchived::query()
            ->whereHas('stockIn', function ($q) use ($toCampusId, $medicineId) {
                $q->where('campus_id', $toCampusId)->where('medicine_id', $medicineId);
            })
            ->sum('quantity');

        $available = max(0, $availableStock - $dispensedStock - $archivedStock);

        if ($quantity > $available) {
            throw new RuntimeException(
                "Insufficient stock at supplying campus. Available: {$available}, Requested: {$quantity}"
            );
        }

        $request = BranchRequest::create([
            'from_campus_id' => $fromCampusId,
            'to_campus_id' => $toCampusId,
            'medicine_id' => $medicineId,
            'quantity_requested' => $quantity,
            'status' => 'pending',
            'requested_by' => $actorId,
        ]);

        $this->auditLogService->record($actorId, 'branch_request.created', 'branch_request', $request->id, [
            'from_campus_id' => $fromCampusId,
            'to_campus_id' => $toCampusId,
            'medicine_id' => $medicineId,
            'quantity' => $quantity,
        ]);

        return $request;
    }

    public function approve(int $requestId, int $actorId): BranchRequest
    {
        return DB::transaction(function () use ($requestId, $actorId) {
            $actor = $this->loadActor($actorId);
            
            $request = BranchRequest::lockForUpdate()->find($requestId);
            if (!$request || $request->status !== 'pending') {
                throw new RuntimeException('Branch request is not pending or not found.');
            }

            $this->assertCanApproveOrReject($actor, $request, $actorId);

            $request->update([
                'status' => 'approved',
                'approved_by' => $actorId,
            ]);

            $this->auditLogService->record($actorId, 'branch_request.approved', 'branch_request', $request->id);

            return $request->fresh();
        });
    }

    public function reject(int $requestId, int $actorId, string $reason = ''): BranchRequest
    {
        return DB::transaction(function () use ($requestId, $actorId, $reason) {
            $actor = $this->loadActor($actorId);
            
            $request = BranchRequest::lockForUpdate()->find($requestId);
            if (!$request || $request->status !== 'pending') {
                throw new RuntimeException('Branch request is not pending or not found.');
            }

            $this->assertCanApproveOrReject($actor, $request, $actorId);

            $request->update([
                'status' => 'rejected',
                'approved_by' => $actorId,
            ]);

            $this->auditLogService->record($actorId, 'branch_request.rejected', 'branch_request', $request->id, [
                'reason' => $reason,
            ]);

            return $request->fresh();
        });
    }

    /**
     * 🚨 STEP 1: Supplying campus physically ships the medicine (deducts their stock).
     * 🚨 FIX: Now allows shipping from 'pending' (since Approve step was removed from frontend).
     */
    public function ship(int $requestId, int $actorId): BranchRequest
    {
        return DB::transaction(function () use ($requestId, $actorId) {
            $actor = $this->loadActor($actorId);
            $request = BranchRequest::lockForUpdate()->find($requestId);

            if (!$request) throw new RuntimeException('Branch request not found.');
            if (!in_array($request->status, ['pending', 'approved'], true)) {
                throw new RuntimeException('Only pending or approved requests can be shipped.');
            }

            $actorRole = strtolower((string) $actor->role?->name);
            if ($actorRole !== 'coordinator' && (int) $actor->campus_id !== (int) $request->to_campus_id) {
                throw new RuntimeException('Only the supplying campus can ship this request.');
            }

            $availableStock = $this->inventoryService->availableStockForCampus($request->to_campus_id)
                ->where('medicine_id', $request->medicine_id)
                ->sum('available_quantity');

            if ($availableStock < $request->quantity_requested) {
                throw new RuntimeException("Insufficient stock to ship. Available: {$availableStock}, Requested: {$request->quantity_requested}");
            }

            $remainingToDeduct = $request->quantity_requested;
            $supplyBatches = $this->inventoryService->availableStockForCampus($request->to_campus_id)
                ->where('medicine_id', $request->medicine_id)
                ->sortBy('expiration_date');

            foreach ($supplyBatches as $batch) {
                if ($remainingToDeduct <= 0) break;
                if (empty($batch->expiration_date)) continue;

                $deductAmount = min($remainingToDeduct, $batch->available_quantity);
                if ($deductAmount > 0) {
                    $this->inventoryService->dispense([
                        'stock_in_id' => $batch->id,
                        'quantity_dispensed' => $deductAmount,
                    ], $actorId);
                    $remainingToDeduct -= $deductAmount;
                }
            }

            if ($remainingToDeduct > 0) {
                throw new RuntimeException('Cannot ship transfer: some stock batches have no expiration date.');
            }

            $request->update([
                'status' => 'shipped',
                'approved_by' => $request->approved_by ?? $actorId, // 🚨 Mark as "approved by" the shipper if not already approved
            ]);
            $this->auditLogService->record($actorId, 'branch_request.shipped', 'branch_request', $request->id);

            return $request->fresh();
        });
    }

    /**
     * 🚨 STEP 2: Requesting campus physically receives it (no stock added yet)
     */
    public function receive(int $requestId, int $actorId): BranchRequest
    {
        return DB::transaction(function () use ($requestId, $actorId) {
            $actor = $this->loadActor($actorId);
            $request = BranchRequest::lockForUpdate()->find($requestId);

            if (!$request) throw new RuntimeException('Branch request not found.');
            if ($request->status !== 'shipped') throw new RuntimeException('Only shipped requests can be marked as received.');

            $actorRole = strtolower((string) $actor->role?->name);
            if ($actorRole !== 'coordinator' && (int) $actor->campus_id !== (int) $request->from_campus_id) {
                throw new RuntimeException('Only the requesting campus can confirm receipt.');
            }

            $request->update(['status' => 'received']);
            $this->auditLogService->record($actorId, 'branch_request.received', 'branch_request', $request->id);

            return $request->fresh();
        });
    }

    /**
     * 🚨 STEP 3: Requesting campus marks the request as completed.
     * We do NOT create a stock batch here. The nurse must manually go to the Inventory page
     * to stock-in the physical batch with its expiration date.
     */
    public function markStockedIn(int $requestId, int $actorId): BranchRequest
    {
        return DB::transaction(function () use ($requestId, $actorId) {
            $actor = $this->loadActor($actorId);
            $request = BranchRequest::lockForUpdate()->find($requestId);

            if (!$request) throw new RuntimeException('Branch request not found.');
            if ($request->status !== 'received') throw new RuntimeException('Only received requests can be marked as stocked in.');

            $actorRole = strtolower((string) $actor->role?->name);
            if ($actorRole !== 'coordinator' && (int) $actor->campus_id !== (int) $request->from_campus_id) {
                throw new RuntimeException('Only the requesting campus can stock in this medicine.');
            }

            $request->update(['status' => 'completed']);
            $this->auditLogService->record($actorId, 'branch_request.stocked_in', 'branch_request', $request->id);

            return $request->fresh();
        });
    }

    private function loadActor(int $actorId): User
    {
        $actor = User::with('role')->find($actorId);
        if (!$actor) {
            throw new RuntimeException('Acting user not found.');
        }
        return $actor;
    }

    private function assertCanApproveOrReject(User $actor, BranchRequest $request, int $actorId): void
    {
        $roleName = strtolower((string) $actor->role?->name);

        if ($roleName === 'coordinator') {
            return;
        }

        if ((int) $actor->campus_id !== (int) $request->to_campus_id) {
            throw new RuntimeException('Only the supplying campus can approve or reject this request.');
        }

        if ((int) $request->requested_by === $actorId) {
            throw new RuntimeException('You cannot approve your own branch request.');
        }
    }

    private function findPending(int $requestId): BranchRequest
    {
        $request = BranchRequest::find($requestId);

        if (!$request) {
            throw new RuntimeException('Branch request not found.');
        }

        if ($request->status !== 'pending') {
            throw new RuntimeException('Only pending requests can be modified.');
        }

        return $request;
    }
}
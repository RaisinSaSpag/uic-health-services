<?php

namespace App\Services\Clinic;

use App\Models\BranchRequest;
use App\Models\MedicineArchived;
use App\Models\MedicineStockIn;
use App\Models\MedicineStockOut;
use Illuminate\Database\Eloquent\Collection;
use RuntimeException;

class BranchRequestService
{
    public function __construct(private readonly AuditLogService $auditLogService)
    {
    }

    public function listForCampus(int $campusId): Collection
    {
        return BranchRequest::with(['medicine', 'fromCampus', 'toCampus', 'requestedBy', 'approvedBy'])
            ->where('from_campus_id', $campusId)
            ->orWhere('to_campus_id', $campusId)
            ->orderBy('created_at', 'desc')
            ->get();
    }

    public function create(array $payload, int $actorId): BranchRequest
    {
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

        if ($medicineId <= 0) {
            throw new RuntimeException('Medicine is required.');
        }

        if ($quantity <= 0) {
            throw new RuntimeException('Quantity must be greater than zero.');
        }

        // Validate that the target campus has enough stock to fulfill this request
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
                "Insufficient stock at target campus. Available: {$available}, Requested: {$quantity}"
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
        $request = $this->findPending($requestId);

        $request->update([
            'status' => 'approved',
            'approved_by' => $actorId,
        ]);

        $this->auditLogService->record($actorId, 'branch_request.approved', 'branch_request', $request->id);

        return $request->fresh();
    }

    public function reject(int $requestId, int $actorId, string $reason = ''): BranchRequest
    {
        $request = $this->findPending($requestId);

        $request->update([
            'status' => 'rejected',
            'approved_by' => $actorId,
        ]);

        $this->auditLogService->record($actorId, 'branch_request.rejected', 'branch_request', $request->id, [
            'reason' => $reason,
        ]);

        return $request->fresh();
    }

    public function complete(int $requestId, int $actorId): BranchRequest
    {
        $request = BranchRequest::find($requestId);

        if (!$request) {
            throw new RuntimeException('Branch request not found.');
        }

        if ($request->status !== 'approved') {
            throw new RuntimeException('Only approved requests can be completed.');
        }

        $request->update(['status' => 'completed']);

        $this->auditLogService->record($actorId, 'branch_request.completed', 'branch_request', $request->id);

        return $request->fresh();
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
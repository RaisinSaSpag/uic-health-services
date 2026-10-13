<?php

namespace App\Services\Clinic;

use App\Models\MedicineArchived;
use App\Models\MedicineStockIn;
use App\Models\MedicineStockOut;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class InventoryService
{
    public function __construct(private readonly AuditLogService $auditLogService)
    {
    }

    public function stockIn(array $payload, int $actorId): MedicineStockIn
    {
        $medicineId = (int) ($payload['medicine_id'] ?? 0);
        $campusId = (int) ($payload['campus_id'] ?? 0);
        $quantity = (int) ($payload['quantity'] ?? 0);
        $dateReceived = (string) ($payload['date_received'] ?? '');
        $expirationDate = (string) ($payload['expiration_date'] ?? '');

        if ($medicineId <= 0) {
            throw new RuntimeException('Medicine is required.');
        }

        if ($campusId <= 0) {
            throw new RuntimeException('Campus is required.');
        }

        if ($quantity <= 0) {
            throw new RuntimeException('Quantity must be greater than zero.');
        }

        if ($dateReceived === '') {
            throw new RuntimeException('Date received is required.');
        }

        if ($expirationDate === '') {
            throw new RuntimeException('Expiration date is required.');
        }

        if (Carbon::parse($expirationDate)->lte(Carbon::parse($dateReceived))) {
            throw new RuntimeException('Expiration date must be after the date received.');
        }

        $stockIn = MedicineStockIn::create([
            'medicine_id' => $medicineId,
            'campus_id' => $campusId,
            'quantity' => $quantity,
            'date_received' => $dateReceived,
            'expiration_date' => $expirationDate,
            'received_by' => $actorId,
        ]);

        $this->auditLogService->record($actorId, 'inventory.stocked_in', 'medicine_stock_in', $stockIn->id, [
            'medicine_id' => $medicineId,
            'campus_id' => $campusId,
            'quantity' => $quantity,
        ]);

        return $stockIn;
    }

    public function dispense(array $payload, int $actorId): MedicineStockOut
    {
        $stockInId = (int) ($payload['stock_in_id'] ?? 0);
        $quantity = (int) ($payload['quantity_dispensed'] ?? 0);

        if ($stockInId <= 0) {
            throw new RuntimeException('Stock-in record is required.');
        }

        if ($quantity <= 0) {
            throw new RuntimeException('Quantity must be greater than zero.');
        }

        return DB::transaction(function () use ($stockInId, $quantity, $actorId) {
            $stockIn = MedicineStockIn::lockForUpdate()->find($stockInId);

            if (!$stockIn) {
                throw new RuntimeException('Stock-in record not found.');
            }

            $available = $this->availableQuantityForStockIn($stockIn);

            if ($quantity > $available) {
                throw new RuntimeException("Insufficient stock. Available: {$available}, requested: {$quantity}.");
            }

            $stockOut = MedicineStockOut::create([
                'stock_in_id' => $stockIn->id,
                'quantity_dispensed' => $quantity,
                'dispensed_by' => $actorId,
                'dispensed_at' => now(),
            ]);

            $this->auditLogService->record($actorId, 'inventory.dispensed', 'medicine_stock_out', $stockOut->id, [
                'stock_in_id' => $stockInId,
                'quantity' => $quantity,
            ]);

            return $stockOut;
        });
    }

    public function archive(array $payload, int $actorId): MedicineArchived
    {
        $stockInId = (int) ($payload['stock_in_id'] ?? 0);
        $quantity = (int) ($payload['quantity'] ?? 0);
        $reason = trim((string) ($payload['reason'] ?? ''));

        if ($stockInId <= 0) {
            throw new RuntimeException('Stock-in record is required.');
        }

        if ($quantity <= 0) {
            throw new RuntimeException('Quantity must be greater than zero.');
        }

        if ($reason === '') {
            throw new RuntimeException('Reason is required.');
        }

        return DB::transaction(function () use ($stockInId, $quantity, $reason, $actorId) {
            $stockIn = MedicineStockIn::lockForUpdate()->find($stockInId);

            if (!$stockIn) {
                throw new RuntimeException('Stock-in record not found.');
            }

            $available = $this->availableQuantityForStockIn($stockIn);

            if ($quantity > $available) {
                throw new RuntimeException("Insufficient stock to archive. Available: {$available}, requested: {$quantity}.");
            }

            $archived = MedicineArchived::create([
                'stock_in_id' => $stockIn->id,
                'quantity' => $quantity,
                'reason' => $reason,
                'archived_by' => $actorId,
                'archived_at' => now(),
            ]);

            $this->auditLogService->record($actorId, 'inventory.archived', 'medicine_archived', $archived->id, [
                'stock_in_id' => $stockInId,
                'quantity' => $quantity,
                'reason' => $reason,
            ]);

            return $archived;
        });
    }

    public function availableQuantityForStockIn(MedicineStockIn $stockIn): int
    {
        $dispensed = (int) MedicineStockOut::where('stock_in_id', $stockIn->id)->sum('quantity_dispensed');
        $archived = (int) MedicineArchived::where('stock_in_id', $stockIn->id)->sum('quantity');

        return max(0, (int) $stockIn->quantity - $dispensed - $archived);
    }

    public function availableStockForCampus(int $campusId): Collection
    {
        return MedicineStockIn::with(['medicine', 'campus'])
            ->where('campus_id', $campusId)
            ->get()
            ->map(function (MedicineStockIn $stockIn) {
                $stockIn->setAttribute('available_quantity', $this->availableQuantityForStockIn($stockIn));

                return $stockIn;
            })
            ->filter(fn (MedicineStockIn $stockIn) => $stockIn->available_quantity > 0)
            ->values();
    }

    public function lowStock(int $campusId, int $threshold = 50): Collection
    {
        return $this->availableStockForCampus($campusId)
            ->filter(fn (MedicineStockIn $stockIn) => $stockIn->available_quantity <= $threshold)
            ->values();
    }

    public function expiringSoon(int $campusId, int $daysAhead = 30): Collection
    {
        $cutoff = Carbon::now()->addDays($daysAhead);

        return $this->availableStockForCampus($campusId)
            ->filter(function (MedicineStockIn $stockIn) use ($cutoff) {
                return $stockIn->expiration_date && Carbon::parse($stockIn->expiration_date)->lte($cutoff);
            })
            ->values();
    }
}
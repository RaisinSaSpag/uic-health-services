<?php

namespace App\Services\Clinic;

use App\Models\Medicine;
use Illuminate\Database\Eloquent\Collection;
use RuntimeException;

class MedicineService
{
    public function __construct(private readonly AuditLogService $auditLogService)
    {
    }

    public function list(string $search = ''): Collection
    {
        $query = Medicine::query();

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%' . $search . '%')
                    ->orWhere('category', 'like', '%' . $search . '%');
            });
        }

        return $query->orderBy('name')->get();
    }

    public function find(int $id): Medicine
    {
        $medicine = Medicine::find($id);

        if (!$medicine) {
            throw new RuntimeException('Medicine not found.');
        }

        return $medicine;
    }

    public function create(array $payload, int $actorId): Medicine
    {
        $name = trim((string) ($payload['name'] ?? ''));
        $category = trim((string) ($payload['category'] ?? ''));

        if ($name === '') {
            throw new RuntimeException('Medicine name is required.');
        }

        if ($category === '') {
            throw new RuntimeException('Medicine category is required.');
        }

        if (Medicine::where('name', $name)->exists()) {
            throw new RuntimeException('A medicine with this name already exists.');
        }

        $medicine = Medicine::create([
            'name' => $name,
            'category' => $category,
        ]);

        $this->auditLogService->record($actorId, 'medicine.created', 'medicine', $medicine->id, [
            'name' => $name,
            'category' => $category,
        ]);

        return $medicine;
    }

    public function update(int $id, array $payload, int $actorId): Medicine
    {
        $medicine = $this->find($id);
        $updates = [];

        if (array_key_exists('name', $payload)) {
            $name = trim((string) $payload['name']);
            if ($name === '') {
                throw new RuntimeException('Medicine name cannot be empty.');
            }
            if ($name !== $medicine->name && Medicine::where('name', $name)->where('id', '!=', $id)->exists()) {
                throw new RuntimeException('A medicine with this name already exists.');
            }
            $updates['name'] = $name;
        }

        if (array_key_exists('category', $payload)) {
            $category = trim((string) $payload['category']);
            if ($category === '') {
                throw new RuntimeException('Medicine category cannot be empty.');
            }
            $updates['category'] = $category;
        }

        if (empty($updates)) {
            throw new RuntimeException('No changes provided.');
        }

        $medicine->update($updates);

        $this->auditLogService->record($actorId, 'medicine.updated', 'medicine', $medicine->id, $updates);

        return $medicine->fresh();
    }

    public function delete(int $id, int $actorId): void
    {
        $medicine = $this->find($id);

        if ($medicine->stockIns()->exists()) {
            throw new RuntimeException('Cannot delete a medicine that has stock records. Archive the stock instead.');
        }

        $this->auditLogService->record($actorId, 'medicine.deleted', 'medicine', $medicine->id, [
            'name' => $medicine->name,
        ]);

        $medicine->delete();
    }
}
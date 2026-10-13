<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Medicine;
use App\Services\Clinic\MedicineService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class MedicineController extends Controller
{
    public function __construct(private readonly MedicineService $medicineService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
        ]);

        $medicines = $this->medicineService->list($validated['search'] ?? '');

        return response()->json($medicines);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:255'],
        ]);

        try {
            $medicine = $this->medicineService->create($validated, $request->user()->id);

            return response()->json($medicine, 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function show(Medicine $medicine): JsonResponse
    {
        return response()->json($medicine);
    }

    public function update(Request $request, Medicine $medicine): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'category' => ['sometimes', 'required', 'string', 'max:255'],
        ]);

        try {
            $updated = $this->medicineService->update($medicine->id, $validated, $request->user()->id);

            return response()->json($updated);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function destroy(Request $request, Medicine $medicine): JsonResponse
    {
        try {
            $this->medicineService->delete($medicine->id, $request->user()->id);

            return response()->json(['message' => 'Medicine deleted.']);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }
    }
}
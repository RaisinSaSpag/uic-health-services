<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Campus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CampusController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'exclude_id' => ['nullable', 'integer', 'min:1'],
            'search' => ['nullable', 'string', 'max:120'],
        ]);

        $query = Campus::query()->select(['id', 'code', 'name', 'address']);

        if (isset($validated['exclude_id'])) {
            $query->where('id', '!=', (int) $validated['exclude_id']);
        }

        if (isset($validated['search']) && $validated['search'] !== '') {
            $search = (string) $validated['search'];
            $query->where(function ($innerQuery) use ($search): void {
                $innerQuery
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        $campuses = $query->orderBy('name')->get();

        return response()->json($campuses);
    }
}
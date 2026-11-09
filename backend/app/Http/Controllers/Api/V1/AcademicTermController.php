<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AcademicTerm;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AcademicTermController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(AcademicTerm::orderByDesc('start_date')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after:start_date'],
        ]);

        $term = AcademicTerm::create($validated);
        return response()->json($term, 201);
    }

    public function activate(Request $request, AcademicTerm $term): JsonResponse
    {
        // 🚨 Fix #11: Wrap in transaction so both updates are atomic.
        // If the second update fails, we don't leave the system with zero active terms.
        DB::transaction(function () use ($term) {
            AcademicTerm::where('id', '!=', $term->id)->update(['is_active' => false]);
            $term->update(['is_active' => true]);
        });

        return response()->json(['message' => 'Term activated successfully.', 'term' => $term->fresh()]);
    }
}
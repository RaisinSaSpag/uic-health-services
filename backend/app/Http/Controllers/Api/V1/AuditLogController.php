<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'action' => ['nullable', 'string', 'max:120'],
            'entity_type' => ['nullable', 'string', 'max:120'],
            'entity_id' => ['nullable', 'integer', 'min:1'],
            'user_id' => ['nullable', 'integer', 'min:1'],
            'date_from' => ['nullable', 'date'],
            // 🚨 Fix #10: Removed 'after_or_equal:date_from' — it fails when date_from is missing
            'date_to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        // 🚨 Fix #10: Manually validate ordering only when both dates are provided
        if (isset($validated['date_from'], $validated['date_to']) 
            && $validated['date_to'] < $validated['date_from']) {
            return response()->json(['message' => 'date_to must be after or equal to date_from.'], 422);
        }

        $query = AuditLog::query()->with('user');

        if (isset($validated['action']) && $validated['action'] !== '') {
            $query->where('action', $validated['action']);
        }

        if (isset($validated['entity_type']) && $validated['entity_type'] !== '') {
            $query->where('entity_type', $validated['entity_type']);
        }

        if (isset($validated['entity_id'])) {
            $query->where('entity_id', $validated['entity_id']);
        }

        if (isset($validated['user_id'])) {
            $query->where('user_id', $validated['user_id']);
        }

        if (isset($validated['date_from'])) {
            $query->whereDate('created_at', '>=', $validated['date_from']);
        }

        if (isset($validated['date_to'])) {
            $query->whereDate('created_at', '<=', $validated['date_to']);
        }

        $auditLogs = $query
            ->orderByDesc('created_at')
            ->paginate($validated['per_page'] ?? 20);

        return response()->json($auditLogs);
    }

    /**
     * 🚨 History log scoped by campus.
     *
     * Per policy "read globally, write locally", nurses and doctors can view
     * any campus's history. Students are blocked at the route level.
     */
    public function historyForCampus(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'campus_id' => ['required', 'integer', 'exists:campuses,id'],
            'action' => ['nullable', 'string', 'max:120'],
            'date_from' => ['nullable', 'date'],
            // 🚨 Fix #10: Removed 'after_or_equal:date_from' — it fails when date_from is missing
            'date_to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        // 🚨 Fix #10: Manually validate ordering only when both dates are provided
        if (isset($validated['date_from'], $validated['date_to']) 
            && $validated['date_to'] < $validated['date_from']) {
            return response()->json(['message' => 'date_to must be after or equal to date_from.'], 422);
        }

        // Get all user IDs at this campus
        $userIds = User::query()
            ->where('campus_id', (int) $validated['campus_id'])
            ->pluck('id')
            ->all();

        $query = AuditLog::query()
            ->with('user')
            ->whereIn('user_id', $userIds);

        if (isset($validated['action']) && $validated['action'] !== '') {
            $query->where('action', $validated['action']);
        }

        if (isset($validated['date_from'])) {
            $query->whereDate('created_at', '>=', $validated['date_from']);
        }

        if (isset($validated['date_to'])) {
            $query->whereDate('created_at', '<=', $validated['date_to']);
        }

        $logs = $query
            ->orderByDesc('created_at')
            ->paginate($validated['per_page'] ?? 20);

        return response()->json($logs);
    }
}
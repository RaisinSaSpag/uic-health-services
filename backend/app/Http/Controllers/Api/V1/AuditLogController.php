<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
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
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

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
}

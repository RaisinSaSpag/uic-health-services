<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\NotificationRead;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Curated list of audit actions that produce user-visible notifications.
     * Keeps the bell focused on meaningful events (not every audit entry).
     */
    private const NOTIFIABLE_ACTIONS = [
        'branch_request.created',
        'branch_request.approved',
        'branch_request.rejected',
        'branch_request.completed',
        'inventory.stock_in',
        'inventory.dispensed',
        'inventory.archived',
        'medicine.created',
        'medicine.updated',
        'medicine.deleted',
        'user.created',
        'user.deleted',
        'referral.created',
        'referral.updated',
        'referral.completed',
        'consultation.completed',
    ];

    /**
     * List recent notifications for the current user's campus.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'campus_id' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $me = $request->user();
        $campusId = (int) ($validated['campus_id'] ?? $me->campus_id ?? 0);

        if ($campusId <= 0) {
            return response()->json([]);
        }

        // Users at this campus — notifications are scoped to their actions
        $campusUserIds = User::query()
            ->where('campus_id', $campusId)
            ->pluck('id')
            ->all();

        if (empty($campusUserIds)) {
            return response()->json([]);
        }

        $logs = AuditLog::query()
            ->with('user')
            ->whereIn('user_id', $campusUserIds)
            ->whereIn('action', self::NOTIFIABLE_ACTIONS)
            ->orderByDesc('created_at')
            ->limit((int) ($validated['per_page'] ?? 20))
            ->get();

        // Fetch read markers for this user
        $logIds = $logs->pluck('id')->all();
        $readIds = NotificationRead::query()
            ->where('user_id', $me->id)
            ->whereIn('log_id', $logIds)
            ->pluck('log_id')
            ->all();
        $readSet = array_flip($readIds);

        $items = $logs->map(function (AuditLog $log) use ($me, $readSet) {
            return [
                'id' => $log->id,
                'branch_id' => (int) ($me->campus_id ?? 0), // legacy field, kept for shape compatibility
                'reference_id' => $log->entity_id,
                'type' => $log->action,
                'message' => $this->humanMessage($log),
                'is_read' => isset($readSet[$log->id]) ? 1 : 0,
                'created_at' => $log->created_at?->toIso8601String(),
                'request_id' => null,
                'request_status' => null,
            ];
        });

        return response()->json($items);
    }

    /**
     * Unread count for the bell badge.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $me = $request->user();

        if (! $me->campus_id) {
            return response()->json(['unread' => 0]);
        }

        $campusUserIds = User::query()
            ->where('campus_id', $me->campus_id)
            ->pluck('id')
            ->all();

        if (empty($campusUserIds)) {
            return response()->json(['unread' => 0]);
        }

        $totalLogs = AuditLog::query()
            ->whereIn('user_id', $campusUserIds)
            ->whereIn('action', self::NOTIFIABLE_ACTIONS)
            ->count();

        $readCount = NotificationRead::query()
            ->where('user_id', $me->id)
            ->count();

        return response()->json(['unread' => max(0, $totalLogs - $readCount)]);
    }

    /**
     * Mark all currently-visible notifications as read for the current user.
     */
    public function markRead(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'campus_id' => ['nullable', 'integer', 'min:1'],
        ]);

        $me = $request->user();
        $campusId = (int) ($validated['campus_id'] ?? $me->campus_id ?? 0);

        if ($campusId <= 0) {
            return response()->json(['marked_read' => 0]);
        }

        $campusUserIds = User::query()
            ->where('campus_id', $campusId)
            ->pluck('id')
            ->all();

        if (empty($campusUserIds)) {
            return response()->json(['marked_read' => 0]);
        }

        $logIds = AuditLog::query()
            ->whereIn('user_id', $campusUserIds)
            ->whereIn('action', self::NOTIFIABLE_ACTIONS)
            ->pluck('id')
            ->all();

        $existing = NotificationRead::query()
            ->where('user_id', $me->id)
            ->whereIn('log_id', $logIds)
            ->pluck('log_id')
            ->all();

        $toInsert = array_diff($logIds, $existing);
        $now = now();

        $rows = [];
        foreach ($toInsert as $logId) {
            $rows[] = [
                'user_id' => $me->id,
                'log_id' => $logId,
                'read_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if (! empty($rows)) {
            NotificationRead::insert($rows);
        }

        return response()->json(['marked_read' => count($rows)]);
    }

    /**
     * Mark a single notification read.
     */
    public function markOneRead(Request $request, AuditLog $auditLog): JsonResponse
    {
        $me = $request->user();

        NotificationRead::firstOrCreate(
            ['user_id' => $me->id, 'log_id' => $auditLog->id],
            ['read_at' => now()],
        );

        return response()->json(['success' => true]);
    }

    /**
     * Turn an audit log entry into a human-readable message.
     */
    private function humanMessage(AuditLog $log): string
    {
        $actor = $log->user
            ? trim(($log->user->first_name ?? '') . ' ' . ($log->user->last_name ?? ''))
            : 'Someone';

        return match ($log->action) {
            'branch_request.created' => "{$actor} created a branch request.",
            'branch_request.approved' => "{$actor} approved a branch request.",
            'branch_request.rejected' => "{$actor} rejected a branch request.",
            'branch_request.completed' => "{$actor} completed a branch request.",
            'inventory.stock_in' => "{$actor} added stock to inventory.",
            'inventory.dispensed' => "{$actor} dispensed a medicine.",
            'inventory.archived' => "{$actor} archived inventory stock.",
            'medicine.created' => "{$actor} added a new medicine.",
            'medicine.updated' => "{$actor} updated a medicine.",
            'medicine.deleted' => "{$actor} deleted a medicine.",
            'user.created' => "{$actor} created a new user.",
            'user.deleted' => "{$actor} deleted a user.",
            'referral.created' => "{$actor} created a referral.",
            'referral.updated' => "{$actor} updated a referral.",
            'referral.completed' => "{$actor} completed a referral.",
            'consultation.completed' => "{$actor} completed a consultation.",
            default => "{$actor} performed: {$log->action}",
        };
    }
}
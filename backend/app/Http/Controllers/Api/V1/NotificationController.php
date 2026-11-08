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
     */
    private const NOTIFIABLE_ACTIONS = [
        'branch_request.created',
        'branch_request.approved',
        'branch_request.rejected',
        'branch_request.completed',
        'inventory.stocked_in',
        'inventory.dispensed',
        'inventory.archived',
        'inventory.restored',
        'inventory.archived_deleted',
        'medicine.created',
        'medicine.updated',
        'medicine.deleted',
        'user.created',
        'user.deleted',
        'referral.created',
        'referral.in_progress',
        'referral.completed',
        'consultation.submitted',
        'consultation.started',
        'consultation.triaged',
        'consultation.cancelled',
        'consultation.completed',
        'consultation.nurse_finalization',
        'prescription.created',
        'prescription.dispensed',
        'prescription.cancelled',
        'prescription.marked_unavailable', // <-- ADDED
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

        $campusId = $this->resolveCampusId($request, $validated);

        if ($campusId <= 0) {
            return response()->json([]);
        }

        $me = $request->user();
        $campusUserIds = $this->campusUserIds($campusId);

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

        $logIds = $logs->pluck('id')->all();
        $readIds = NotificationRead::query()
            ->where('user_id', $me->id)
            ->whereIn('log_id', $logIds)
            ->pluck('log_id')
            ->all();
        $readSet = array_flip($readIds);

        $items = $logs->map(function (AuditLog $log) use ($me, $readSet, $campusId) {
            return [
                'id' => $log->id,
                'branch_id' => $campusId,
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
        $validated = $request->validate([
            'campus_id' => ['nullable', 'integer', 'min:1'],
        ]);

        $campusId = $this->resolveCampusId($request, $validated);

        if ($campusId <= 0) {
            return response()->json(['unread' => 0]);
        }

        $me = $request->user();
        $campusUserIds = $this->campusUserIds($campusId);

        if (empty($campusUserIds)) {
            return response()->json(['unread' => 0]);
        }

        $logIds = AuditLog::query()
            ->whereIn('user_id', $campusUserIds)
            ->whereIn('action', self::NOTIFIABLE_ACTIONS)
            ->pluck('id')
            ->all();

        if (empty($logIds)) {
            return response()->json(['unread' => 0]);
        }

        $readCount = NotificationRead::query()
            ->where('user_id', $me->id)
            ->whereIn('log_id', $logIds)
            ->count();

        $unread = max(0, count($logIds) - $readCount);

        return response()->json(['unread' => $unread]);
    }

    /**
     * Mark all currently-visible notifications as read.
     */
    public function markRead(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'campus_id' => ['nullable', 'integer', 'min:1'],
        ]);

        $campusId = $this->resolveCampusId($request, $validated);

        if ($campusId <= 0) {
            return response()->json(['marked_read' => 0]);
        }

        $me = $request->user();
        $campusUserIds = $this->campusUserIds($campusId);

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

        if (!empty($rows)) {
            NotificationRead::insert($rows);
        }

        return response()->json(['marked_read' => count($rows)]);
    }

    /**
     * Mark a single notification read (only if it belongs to the user's campus).
     */
    public function markOneRead(Request $request, AuditLog $auditLog): JsonResponse
    {
        $me = $request->user();
        $roleName = strtolower((string) ($me->role?->name ?? ''));

        // 🚨 SECURITY: nurse/doctor can only mark reads for their own campus
        if ($roleName !== 'coordinator' && $auditLog->user) {
            if ((int) $auditLog->user->campus_id !== (int) $me->campus_id) {
                abort(403, 'You cannot mark notifications from another campus as read.');
            }
        }

        NotificationRead::firstOrCreate(
            ['user_id' => $me->id, 'log_id' => $auditLog->id],
            ['read_at' => now()],
        );

        return response()->json(['success' => true]);
    }

    /**
     * 🚨 SECURITY: resolve the campus ID that should be used for a query.
     */
    private function resolveCampusId(Request $request, array $validated): int
    {
        $me = $request->user();
        $roleName = strtolower((string) ($me->role?->name ?? ''));

        if ($roleName === 'coordinator') {
            return (int) ($validated['campus_id'] ?? $me->campus_id ?? 0);
        }

        return (int) ($me->campus_id ?? 0);
    }

    /**
     * Get all user IDs at a given campus.
     */
    private function campusUserIds(int $campusId): array
    {
        return User::query()
            ->where('campus_id', $campusId)
            ->pluck('id')
            ->all();
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
            'inventory.stocked_in' => "{$actor} added stock to inventory.",
            'inventory.dispensed' => "{$actor} dispensed a medicine.",
            'inventory.archived' => "{$actor} archived inventory stock.",
            'inventory.restored' => "{$actor} restored archived stock.",
            'inventory.archived_deleted' => "{$actor} permanently deleted archived stock.",
            'medicine.created' => "{$actor} added a new medicine.",
            'medicine.updated' => "{$actor} updated a medicine.",
            'medicine.deleted' => "{$actor} deleted a medicine.",
            'user.created' => "{$actor} created a new user.",
            'user.deleted' => "{$actor} deleted a user.",
            'referral.created' => "{$actor} created a referral.",
            'referral.in_progress' => "{$actor} started a referral.",
            'referral.completed' => "{$actor} completed a referral.",
            'consultation.submitted' => "{$actor} submitted a consultation.",
            'consultation.started' => "{$actor} started a consultation.",
            'consultation.triaged' => "{$actor} triaged a consultation.",
            'consultation.cancelled' => "{$actor} cancelled a consultation.",
            'consultation.completed' => "{$actor} completed a consultation.",
            'consultation.nurse_finalization' => "{$actor} sent a consultation for finalization.",
            'prescription.created' => "{$actor} created a prescription.",
            'prescription.dispensed' => "{$actor} dispensed a prescription.",
            'prescription.cancelled' => "{$actor} cancelled a prescription.",
            'prescription.marked_unavailable' => "{$actor} marked a prescription as unavailable.", // <-- ADDED
            default => "{$actor} performed: {$log->action}",
        };
    }
}
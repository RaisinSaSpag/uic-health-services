<?php

namespace App\Services\Clinic;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;

class AuditLogService
{
    public function log(
        ?User $actor,
        string $action,
        string $entityType,
        ?int $entityId = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?Request $request = null,
    ): AuditLog {
        $request ??= request();

        return AuditLog::create([
            'user_id' => $actor?->id,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'old_values_json' => $oldValues,
            'new_values_json' => $newValues,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
        ]);
    }

    /**
     * Convenience wrapper that accepts a user ID instead of a User model.
     */
    public function record(
        int $actorId,
        string $action,
        string $entityType,
        ?int $entityId = null,
        array $newValues = [],
    ): AuditLog {
        $actor = User::find($actorId);

        return $this->log($actor, $action, $entityType, $entityId, null, $newValues ?: null);
    }
}
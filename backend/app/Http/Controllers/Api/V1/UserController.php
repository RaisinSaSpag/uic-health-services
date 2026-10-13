<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Services\Clinic\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function __construct(private readonly AuditLogService $auditLogService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'role' => ['nullable', 'string', Rule::in(['student', 'employee', 'nurse', 'doctor', 'admin'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = User::query()->with(['role', 'campus', 'department']);

        if (isset($validated['search']) && $validated['search'] !== '') {
            $search = (string) $validated['search'];

            $query->where(function ($innerQuery) use ($search): void {
                $innerQuery
                    ->where('email', 'like', "%{$search}%")
                    ->orWhere('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%");
            });
        }

        if (isset($validated['role']) && $validated['role'] !== '') {
            $role = Str::lower((string) $validated['role']);

            $query->whereHas('role', function ($roleQuery) use ($role): void {
                $roleQuery->whereRaw('LOWER(name) = ?', [$role]);
            });
        }

        $users = $query
            ->orderByDesc('last_login_at')
            ->orderByDesc('id')
            ->paginate($validated['per_page'] ?? 20);

        return response()->json($users);
    }

    public function doctors(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = User::query()
            ->with(['role', 'campus', 'department'])
            ->whereHas('role', fn ($roleQuery) => $roleQuery->whereRaw('LOWER(name) = ?', ['doctor']))
            ->where('is_active', true);

        if (isset($validated['search']) && $validated['search'] !== '') {
            $search = (string) $validated['search'];

            $query->where(function ($innerQuery) use ($search): void {
                $innerQuery
                    ->where('email', 'like', "%{$search}%")
                    ->orWhere('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%");
            });
        }

        $doctors = $query
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->paginate($validated['per_page'] ?? 50);

        return response()->json($doctors);
    }

    public function updateRole(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'role_name' => ['required', 'string', Rule::in(['student', 'employee', 'nurse', 'doctor', 'admin'])],
        ]);

        $targetRoleName = Str::lower((string) $validated['role_name']);
        $targetRole = Role::whereRaw('LOWER(name) = ?', [$targetRoleName])->first();
        $actor = $request->user();

        if (! $targetRole) {
            return response()->json(['message' => 'Target role is not configured.'], 409);
        }

        if ($actor && (int) $actor->id === (int) $user->id && $targetRoleName !== 'admin') {
            return response()->json([
                'message' => 'You cannot change your own role away from admin.',
            ], 409);
        }

        $oldRoleName = $user->role?->name;

        if ((int) $user->role_id !== (int) $targetRole->id) {
            $user->forceFill(['role_id' => $targetRole->id])->save();

            $this->auditLogService->log(
                actor: $actor,
                action: 'user.role_assigned',
                entityType: 'user',
                entityId: $user->id,
                oldValues: ['role' => $oldRoleName],
                newValues: ['role' => $targetRole->name],
            );
        }

        return response()->json($user->load(['role', 'campus', 'department']));
    }
}

<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Services\Clinic\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
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
            'role_name' => ['required', 'string', Rule::in(['student', 'employee', 'nurse', 'doctor', 'admin', 'coordinator'])],
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

        public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => ['sometimes', 'required', 'string', 'max:80'],
            'last_name'  => ['sometimes', 'required', 'string', 'max:80'],
            'email'      => ['sometimes', 'required', 'email', 'max:150', Rule::unique('users', 'email')->ignore($user->id)],
            'campus_id'  => ['sometimes', 'required', 'integer', 'exists:campuses,id'],
            'role_name'  => ['sometimes', 'required', 'string', Rule::in(['student', 'employee', 'nurse', 'doctor', 'admin', 'coordinator'])],
            'is_active'  => ['sometimes', 'boolean'],
        ]);

        $actor = $request->user();
        $updates = [];
        $oldValues = [];

        if (array_key_exists('first_name', $validated)) {
            $updates['first_name'] = trim((string) $validated['first_name']);
            $oldValues['first_name'] = $user->first_name;
        }

        if (array_key_exists('last_name', $validated)) {
            $updates['last_name'] = trim((string) $validated['last_name']);
            $oldValues['last_name'] = $user->last_name;
        }

        if (array_key_exists('email', $validated)) {
            $newEmail = Str::lower(trim((string) $validated['email']));

            if (! Str::endsWith($newEmail, '@uic.edu.ph')) {
                return response()->json([
                    'message' => 'Only UIC email addresses (@uic.edu.ph) are allowed.',
                ], 403);
            }

            if ($newEmail !== $user->email) {
                $updates['email'] = $newEmail;
                $oldValues['email'] = $user->email;
            }
        }

        if (array_key_exists('campus_id', $validated)) {
            $updates['campus_id'] = (int) $validated['campus_id'];
            $oldValues['campus_id'] = $user->campus_id;
        }

        if (array_key_exists('role_name', $validated)) {
            $roleName = Str::lower((string) $validated['role_name']);
            $targetRole = Role::whereRaw('LOWER(name) = ?', [$roleName])->first();

            if (! $targetRole) {
                return response()->json(['message' => 'Target role is not configured.'], 409);
            }

            if ($actor && (int) $actor->id === (int) $user->id && $roleName !== 'admin') {
                return response()->json([
                    'message' => 'You cannot change your own role away from admin.',
                ], 409);
            }

            if ((int) $user->role_id !== (int) $targetRole->id) {
                $updates['role_id'] = $targetRole->id;
                $oldValues['role'] = $user->role?->name;
            }
        }

        if (array_key_exists('is_active', $validated)) {
            $newActive = (bool) $validated['is_active'];

            if ($actor && (int) $actor->id === (int) $user->id && ! $newActive) {
                return response()->json([
                    'message' => 'You cannot deactivate your own account.',
                ], 409);
            }

            if ($user->is_active !== $newActive) {
                $updates['is_active'] = $newActive;
                $oldValues['is_active'] = $user->is_active;
            }
        }

        if (empty($updates)) {
            return response()->json(['message' => 'No changes to apply.'], 422);
        }

        $user->fill($updates)->save();

        $this->auditLogService->log(
            actor: $actor,
            action: 'user.updated',
            entityType: 'user',
            entityId: $user->id,
            oldValues: $oldValues,
            newValues: $updates,
        );

        return response()->json($user->fresh(['role', 'campus', 'department']));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:80'],
            'last_name'  => ['required', 'string', 'max:80'],
            'email'      => ['required', 'email', 'max:150', 'unique:users,email'],
            'password'   => ['required', 'string', 'min:6', 'max:72'],
            'role_name'  => ['required', 'string', Rule::in(['student', 'employee', 'nurse', 'doctor', 'admin', 'coordinator'])],
            'campus_id'  => ['required', 'integer', 'exists:campuses,id'],
            'is_active'  => ['nullable', 'boolean'],
        ]);

        $normalizedEmail = Str::lower((string) $validated['email']);

        if (! Str::endsWith($normalizedEmail, '@uic.edu.ph')) {
            return response()->json([
                'message' => 'Only UIC email addresses (@uic.edu.ph) are allowed.',
            ], 403);
        }

        $roleName = Str::lower((string) $validated['role_name']);
        $role = Role::whereRaw('LOWER(name) = ?', [$roleName])->first();

        if (! $role) {
            return response()->json(['message' => 'Target role is not configured.'], 409);
        }

        $user = User::create([
            'first_name' => $validated['first_name'],
            'last_name'  => $validated['last_name'],
            'email'      => Str::lower($validated['email']),
            'password'   => Hash::make($validated['password']),
            'role_id'    => $role->id,
            'campus_id'  => $validated['campus_id'],
            'is_active'  => $validated['is_active'] ?? true,
        ]);

        $this->auditLogService->log(
            actor: $request->user(),
            action: 'user.created',
            entityType: 'user',
            entityId: $user->id,
            oldValues: null,
            newValues: [
                'email'     => $user->email,
                'role'      => $role->name,
                'campus_id' => $user->campus_id,
            ],
        );

        return response()->json($user->load(['role', 'campus', 'department']), 201);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $actor = $request->user();

        if ($actor && (int) $actor->id === (int) $user->id) {
            return response()->json(['message' => 'You cannot delete your own account.'], 409);
        }

        $targetRoleName = Str::lower((string) ($user->role?->name ?? ''));

        if ($targetRoleName === 'admin') {
            $otherAdmins = User::query()
                ->where('id', '!=', $user->id)
                ->where('is_active', true)
                ->whereHas('role', fn ($q) => $q->whereRaw('LOWER(name) = ?', ['admin']))
                ->count();

            if ($otherAdmins === 0) {
                return response()->json([
                    'message' => 'Cannot delete the last remaining admin account.',
                ], 409);
            }
        }

        $snapshot = [
            'email'     => $user->email,
            'role'      => $user->role?->name,
            'campus_id' => $user->campus_id,
        ];
        $deletedId = $user->id;

        try {
            $user->delete();
        } catch (\Illuminate\Database\QueryException $e) {
            // Check if it's a foreign key constraint violation (SQLSTATE 23000)
            if ($e->getCode() === '23000' || str_contains($e->getMessage(), 'FOREIGN KEY constraint failed')) {
                return response()->json([
                    'message' => 'Cannot delete this user because they have existing records (prescriptions, inventory, etc.) in the system. Consider deactivating their account instead.',
                ], 409);
            }
            throw $e; // Re-throw if it's a different database error
        }

        $this->auditLogService->log(
            actor: $actor,
            action: 'user.deleted',
            entityType: 'user',
            entityId: $deletedId,
            oldValues: $snapshot,
            newValues: null,
        );

        return response()->json(['success' => true, 'deleted_id' => $deletedId]);
    }
}


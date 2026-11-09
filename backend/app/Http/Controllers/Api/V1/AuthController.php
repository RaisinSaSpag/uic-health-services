<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\JwtService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function __construct(
        private readonly JwtService $jwtService,
    ) {}

    /**
     * Staff login (Nurse, Doctor, Coordinator)
     */
    public function staffLogin(Request $request): JsonResponse
    {
        return $this->performLogin($request, ['nurse', 'doctor', 'coordinator']);
    }

    /**
     * Student/Employee login
     */
    public function studentLogin(Request $request): JsonResponse
    {
        return $this->performLogin($request, ['student', 'employee']);
    }

    /**
     * Shared login logic — one method for both portals (audit #39).
     */
    private function performLogin(Request $request, array $allowedRoles): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
        ]);

        $user = User::query()
            ->with(['role', 'campus', 'department'])
            ->whereRaw('LOWER(email) = ?', [Str::lower($credentials['email'])])
            ->first();

        // Block system placeholder accounts from logging in.
        // Minors registered by the clinic share 'unassigned@uic.edu.ph'
        // and must never be able to authenticate with it.
        if (! $user || Str::lower($user->email) === 'unassigned@uic.edu.ph') {
            return response()->json(['message' => 'The provided credentials are invalid.'], 401);
        }

        if (
            ! $user
            || ! $user->is_active
            || ! in_array(Str::lower((string) $user->role?->name), $allowedRoles, true)
            || ! $user->password
            || ! Hash::check($credentials['password'], $user->password)
        ) {
            return response()->json(['message' => 'The provided credentials are invalid.'], 401);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json([
            'token_type' => 'Bearer',
            'access_token' => $this->jwtService->issueToken($user),
            'expires_in' => $this->jwtService->ttlSeconds(),
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'role' => $user->role?->name,
                'campus_id' => $user->campus_id,
                'campus' => $user->campus?->name,
                'department' => $user->department?->name,
                'must_change_password' => (bool) $user->must_change_password,
            ],
        ]);
    }

    public function me(): JsonResponse
    {
        $user = request()->user();

        return response()->json([
            'id' => $user?->id,
            'email' => $user?->email,
            'first_name' => $user?->first_name,
            'last_name' => $user?->last_name,
            'role' => $user?->role?->name,
            'campus_id' => $user?->campus_id,
            'campus' => $user?->campus?->name,
            'department' => $user?->department?->name,
            'must_change_password' => (bool) $user?->must_change_password,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        // 🚨 SECURITY: Revoke all previously issued tokens
        $request->user()->update(['tokens_valid_after' => now()]);

        return response()->json(['message' => 'Successfully logged out.']);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();
        $mustChange = (bool) $user->must_change_password;

        $rules = [
            'new_password' => ['required', 'string', 'min:8', 'confirmed'],
        ];

        if (! $mustChange) {
            $rules['current_password'] = ['required', 'string'];
        }

        $validated = $request->validate($rules);

        if (! $mustChange) {
            if (! Hash::check($validated['current_password'], $user->password)) {
                return response()->json([
                    'message' => 'Current password is incorrect.',
                ], 422);
            }
        }

        $user->password = Hash::make($validated['new_password']);
        $user->must_change_password = false;
        // 🚨 SECURITY: Revoke tokens issued before the password change
        $user->tokens_valid_after = now();
        $user->save();

        // 🚨 P5-1 FIX: Issue a fresh token so the user isn't logged out
        // of their own session right after changing their password.
        $user->load(['role', 'campus', 'department']);
        $newToken = $this->jwtService->issueToken($user);

        return response()->json([
            'message' => 'Password updated successfully.',
            'access_token' => $newToken,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'role' => $user->role?->name,
                'campus_id' => $user->campus_id,
                'campus' => $user->campus?->name,
                'department' => $user->department?->name,
                'must_change_password' => false,
            ],
        ]);
    }
}
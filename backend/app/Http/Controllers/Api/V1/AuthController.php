<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
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

    public function staffLogin(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
        ]);

        $user = \App\Models\User::query()
            ->with(['role', 'campus', 'department'])
            ->whereRaw('LOWER(email) = ?', [Str::lower($credentials['email'])])
            ->first();

        $allowedRoles = ['nurse', 'doctor', 'coordinator'];

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

    public function studentLogin(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
        ]);

        $user = \App\Models\User::query()
            ->with(['role', 'campus', 'department'])
            ->whereRaw('LOWER(email) = ?', [Str::lower($credentials['email'])])
            ->first();

        $allowedRoles = ['student', 'employee'];

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
        return response()->json(['message' => 'Successfully logged out.']);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();
        $mustChange = (bool) $user->must_change_password;

        // 🚨 SECURITY: require current password for existing users,
        // but allow users on their first forced change (walk-in password from email)
        // to skip the check since they don't know it yet — it's their email.
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
        $user->save();

        return response()->json(['message' => 'Password updated successfully.']);
    }
}
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Auth\GoogleAuthService;
use App\Services\Auth\JwtService;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Throwable;

class AuthController extends Controller
{
    public function __construct(
        private readonly GoogleAuthService $googleAuthService,
        private readonly JwtService $jwtService,
    ) {}

    public function googleRedirect(Request $request): JsonResponse|RedirectResponse
    {
        $redirectUrl = $this->googleAuthService->getRedirectUrl();

        if ($request->expectsJson() || $request->boolean('json')) {
            return response()->json([
                'redirect_url' => $redirectUrl,
            ]);
        }

        return redirect()->away($redirectUrl);
    }

    public function googleCallback(Request $request): JsonResponse|RedirectResponse
    {
        if ($request->filled('error')) {
            return response()->json([
                'message' => 'Google login was denied or cancelled.',
                'google_error' => $request->query('error'),
            ], 400);
        }

        if (! $request->filled('code')) {
            return response()->json([
                'message' => 'Missing Google authorization code. Start from /api/v1/auth/google/redirect.',
            ], 400);
        }

        try {
            $user = $this->googleAuthService->authenticateFromCallback();
            $token = $this->jwtService->issueToken($user);

            if ($request->expectsJson() || $request->boolean('json')) {
                return response()->json([
                    'token_type' => 'Bearer',
                    'access_token' => $token,
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
                    ],
                ]);
            }

            $frontendUrl = rtrim((string) config('services.frontend_url'), '/');

            return redirect()->away("{$frontendUrl}/auth/callback?token=".urlencode($token));
        } catch (AuthenticationException $exception) {
            return response()->json(['message' => $exception->getMessage()], 403);
        } catch (ModelNotFoundException $exception) {
            return response()->json(['message' => $exception->getMessage()], 500);
        } catch (Throwable $exception) {
            report($exception);

            $response = [
                'message' => 'Google authentication failed. Check OAuth client credentials and redirect URI settings.',
            ];

            if (config('app.debug')) {
                $response['debug_error'] = $exception->getMessage();
            }

            return response()->json($response, 500);
        }
    }

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

        $allowedRoles = ['employee', 'nurse', 'doctor', 'admin', 'coordinator'];

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
        ]);
    }
}
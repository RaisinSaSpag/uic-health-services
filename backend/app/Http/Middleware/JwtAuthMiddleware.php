<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\Auth\JwtService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class JwtAuthMiddleware
{
    public function __construct(private readonly JwtService $jwtService)
    {
    }

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! $token) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $payload = $this->jwtService->decodeToken($token);

        if (! $payload || ! isset($payload['sub'])) {
            return response()->json(['message' => 'Invalid or expired token.'], 401);
        }

        $user = User::with(['role', 'campus', 'department'])
            ->where('id', $payload['sub'])
            ->where('is_active', true)
            ->first();

        if (! $user) {
            return response()->json(['message' => 'User not found or inactive.'], 401);
        }

        $request->setUserResolver(fn (): User => $user);

        return $next($request);
    }
}

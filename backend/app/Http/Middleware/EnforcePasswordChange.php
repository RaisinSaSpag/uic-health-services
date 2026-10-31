<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnforcePasswordChange
{
    /**
     * Block all API access for users who must change their password first.
     * Allow only the routes needed to complete the change.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->must_change_password) {
            $allowedRoutes = [
                'api/v1/auth/change-password',
                'api/v1/auth/me',
                'api/v1/auth/logout',
            ];

            if (!in_array($request->path(), $allowedRoutes, true)) {
                return response()->json([
                    'message' => 'You must change your password before continuing.',
                    'code' => 'must_change_password',
                ], 403);
            }
        }

        return $next($request);
    }
}

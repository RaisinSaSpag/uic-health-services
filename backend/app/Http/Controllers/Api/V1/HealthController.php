<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class HealthController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'service' => 'HSMS API',
            'phase' => 'phase-2-backend-foundation',
            'timestamp' => now()->toIso8601String(),
        ]);
    }
}

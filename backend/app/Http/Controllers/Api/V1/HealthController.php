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
            // 🚨 Fix #24: Correct the stale phase label
            'phase' => 'production-ready',
            'version' => '1.0.0',
            'timestamp' => now()->toIso8601String(),
        ]);
    }
}
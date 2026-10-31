<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Reports\ReportSummaryService;
use App\Models\Campus;
use App\Models\Consultation;
use App\Models\Patient;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function __construct(private readonly ReportSummaryService $reportSummaryService)
    {
    }

    public function aiSummary(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'month_label' => ['required', 'string', 'max:32'],
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'total_consultations' => ['required', 'integer', 'min:0'],
            'referred_count' => ['required', 'integer', 'min:0'],
            'top_diseases' => ['required', 'array'],
            'top_diseases.*.diagnosis' => ['required', 'string', 'max:180'],
            'top_diseases.*.count' => ['required', 'integer', 'min:0'],
            'top_diseases.*.context_label' => ['nullable', 'string', 'max:180'],
            'patient_category_counts' => ['required', 'array', 'min:1'],
            'patient_category_counts.*.label' => ['required', 'string', 'max:180'],
            'patient_category_counts.*.count' => ['required', 'integer', 'min:0'],
            'top_diseases_by_group' => ['nullable', 'array'],
            'top_diseases_by_group.basic' => ['nullable', 'array'],
            'top_diseases_by_group.college' => ['nullable', 'array'],
            'top_diseases_by_group.employee' => ['nullable', 'array'],
            'subgroup_breakdowns' => ['nullable', 'array'],
            'subgroup_breakdowns.basic' => ['nullable', 'array'],
            'subgroup_breakdowns.college' => ['nullable', 'array'],
            'subgroup_breakdowns.employee' => ['nullable', 'array'],
        ]);

        return response()->json($this->reportSummaryService->generateNarrative($validated));
    }

    /**
     * Coordinator Command Center: Deep analytics for every campus.
     */
    public function clinicCommandCenter(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'year' => ['nullable', 'integer', 'min:2020'],
        ]);

        $month = $validated['month'] ?? now()->month;
        $year = $validated['year'] ?? now()->year;

        $campuses = Campus::all();
        $reportData = [];

        // Issue 19 Fix: Pre-fetch all stock totals in one query to avoid N+1 loops
        $stockTotals = DB::table('medicine_stock_in')
            ->select('campus_id', DB::raw('SUM(quantity) as total_stock'))
            ->groupBy('campus_id')
            ->pluck('total_stock', 'campus_id');

        foreach ($campuses as $campus) {
            // 1. Consultations (Walk-ins, Scheduled, Telemed)
            $consultationsQuery = Consultation::whereHas('patient', function ($q) use ($campus) {
                $q->where('campus_id', $campus->id);
            })->whereMonth('created_at', $month)->whereYear('created_at', $year);

            $totalConsultations = (clone $consultationsQuery)->count();
            $totalTelemed = (clone $consultationsQuery)->where('is_telemed', true)->count();
            
            // Issue 19 Fix: Explicitly check for non-null, non-'none' statuses
            $totalReferrals = (clone $consultationsQuery)
                ->whereNotNull('referral_status')
                ->where('referral_status', '!=', 'none')
                ->count();
                
            $totalInjuries = (clone $consultationsQuery)->where('consultation_type', 'injury')->count();

            // 2. Patient Demographics
            $patientCategories = Patient::where('campus_id', $campus->id)
                ->selectRaw('patient_category, count(*) as count')
                ->groupBy('patient_category')
                ->pluck('count', 'patient_category')
                ->toArray();

            // 3. Inventory Snapshot (Optimized)
            $totalStockAvailable = (int) ($stockTotals[$campus->id] ?? 0);
            
            // For simplicity, we keep the low-stock query but make it a count
            $lowStockItems = DB::table('medicine_stock_in')
                ->where('campus_id', $campus->id)
                ->where('quantity', '<=', 50)
                ->count();
                
            $expiringItems = DB::table('medicine_stock_in')
                ->where('campus_id', $campus->id)
                ->whereNotNull('expiration_date')
                ->where('expiration_date', '<=', now()->addDays(30)->format('Y-m-d'))
                ->count();

            // 4. Top Diseases
            $topDiseases = (clone $consultationsQuery)
                ->whereNotNull('diagnosis')
                ->selectRaw('diagnosis, count(*) as count')
                ->groupBy('diagnosis')
                ->orderByDesc('count')
                ->take(5)
                ->get();

            $reportData[] = [
                'campus_id' => $campus->id,
                'campus_name' => $campus->name,
                'campus_code' => $campus->code,
                'metrics' => [
                    'total_consultations' => $totalConsultations,
                    'total_telemed' => $totalTelemed,
                    'total_referrals' => $totalReferrals,
                    'total_injuries' => $totalInjuries,
                ],
                'patient_demographics' => $patientCategories,
                'inventory' => [
                    'total_stock_available' => $totalStockAvailable,
                    'low_stock_alerts' => $lowStockItems,
                    'expiring_soon_alerts' => $expiringItems,
                ],
                'top_diseases' => $topDiseases,
            ];
        }

        return response()->json([
            'period' => ['month' => $month, 'year' => $year],
            'campuses' => $reportData,
        ]);
    }
}
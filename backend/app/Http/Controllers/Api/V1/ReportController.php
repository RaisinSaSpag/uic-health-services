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

        $stockTotals = DB::table('medicine_stock_in')
            ->select('campus_id', DB::raw('SUM(quantity) as total_stock'))
            ->groupBy('campus_id')
            ->pluck('total_stock', 'campus_id');

        foreach ($campuses as $campus) {
            $consultationsQuery = Consultation::whereHas('patient', function ($q) use ($campus) {
                $q->where('campus_id', $campus->id);
            })->whereMonth('created_at', $month)->whereYear('created_at', $year);

            $totalConsultations = (clone $consultationsQuery)->count();
            $totalTelemed = (clone $consultationsQuery)->where('is_telemed', true)->count();
            
            $totalReferrals = (clone $consultationsQuery)
                ->whereNotNull('referral_status')
                ->where('referral_status', '!=', 'none')
                ->count();
                
            $totalInjuries = (clone $consultationsQuery)->where('consultation_type', 'injury')->count();

            $patientCategories = Patient::where('campus_id', $campus->id)
                ->selectRaw('patient_category, count(*) as count')
                ->groupBy('patient_category')
                ->pluck('count', 'patient_category')
                ->toArray();

            $totalStockAvailable = (int) ($stockTotals[$campus->id] ?? 0);
            
            $lowStockItems = DB::table('medicine_stock_in')
                ->where('campus_id', $campus->id)
                ->where('quantity', '<=', 50)
                ->count();
                
            $expiringItems = DB::table('medicine_stock_in')
                ->where('campus_id', $campus->id)
                ->whereNotNull('expiration_date')
                ->where('expiration_date', '<=', now()->addDays(30)->format('Y-m-d'))
                ->count();

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

    /**
     * Detailed report for a specific campus.
     */
    public function campusDetail(Request $request, string $campusCode): JsonResponse
    {
        $validated = $request->validate([
            'month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'year' => ['nullable', 'integer', 'min:2020'],
        ]);

        $month = $validated['month'] ?? now()->month;
        $year = $validated['year'] ?? now()->year;

        $campus = Campus::where('code', $campusCode)->firstOrFail();

        // 1. Base query for this campus
        $consultationsQuery = Consultation::whereHas('patient', function ($q) use ($campus) {
            $q->where('campus_id', $campus->id);
        })->whereMonth('created_at', $month)->whereYear('created_at', $year);

        // 2. Top Diagnoses
        $topDiseases = (clone $consultationsQuery)
            ->whereNotNull('diagnosis')
            ->selectRaw('diagnosis, count(*) as count')
            ->groupBy('diagnosis')
            ->orderByDesc('count')
            ->take(5)
            ->get();

        // 3. Demographics
        $demographics = Patient::where('campus_id', $campus->id)
            ->selectRaw('patient_category, count(*) as count')
            ->groupBy('patient_category')
            ->pluck('count', 'patient_category')
            ->toArray();

        // 4. Recent Consultations (for the table)
        $recentConsultations = (clone $consultationsQuery)
            ->with(['patient.user', 'medicalRecord'])
            ->orderByDesc('created_at')
            ->take(10)
            ->get()
            ->map(function ($c) {
                return [
                    'id' => $c->id,
                    'patient_name' => $c->patient?->user ? $c->patient->user->first_name . ' ' . $c->patient->user->last_name : 'Unknown',
                    'date' => $c->created_at->format('M d, Y'),
                    'type' => $c->consultation_type,
                    'diagnosis' => $c->medicalRecord?->final_diagnosis ?? $c->diagnosis ?? 'N/A',
                    'status' => $c->status,
                ];
            });

        return response()->json([
            'campus_name' => $campus->name,
            'campus_code' => $campus->code,
            'demographics' => $demographics,
            'top_diseases' => $topDiseases,
            'recent_consultations' => $recentConsultations,
        ]);
    }
}
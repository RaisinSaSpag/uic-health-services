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

    public function clinicCommandCenter(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d'],
            'month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'year' => ['nullable', 'integer', 'min:2020'],
        ]);

        $dateFrom = $validated['date_from'] ?? null;
        $dateTo = $validated['date_to'] ?? null;
        $month = $validated['month'] ?? now()->month;
        $year = $validated['year'] ?? now()->year;

        $campuses = Campus::all();
        $reportData = [];

        $stockIn = DB::table('medicine_stock_in')
            ->select('campus_id', DB::raw('SUM(quantity) as total'))
            ->groupBy('campus_id')
            ->pluck('total', 'campus_id')
            ->toArray();
        
        $stockOut = DB::table('medicine_stock_out as mso')
            ->join('medicine_stock_in as msi', 'mso.stock_in_id', '=', 'msi.id')
            ->select('msi.campus_id', DB::raw('SUM(mso.quantity_dispensed) as total'))
            ->groupBy('msi.campus_id')
            ->pluck('total', 'msi.campus_id')
            ->toArray();
        
        $stockArchived = DB::table('medicine_archived as ma')
            ->join('medicine_stock_in as msi', 'ma.stock_in_id', '=', 'msi.id')
            ->select('msi.campus_id', DB::raw('SUM(ma.quantity) as total'))
            ->groupBy('msi.campus_id')
            ->pluck('total', 'msi.campus_id')
            ->toArray();
        
        $stockTotals = [];
        foreach ($stockIn as $campusId => $totalIn) {
            $stockTotals[$campusId] = max(0, (int) $totalIn - (int) ($stockOut[$campusId] ?? 0) - (int) ($stockArchived[$campusId] ?? 0));
        }

        foreach ($campuses as $campus) {
            $consultationsQuery = Consultation::whereHas('patient', function ($q) use ($campus) {
                $q->where('campus_id', $campus->id);
            });

            if ($dateFrom) $consultationsQuery->whereDate('created_at', '>=', $dateFrom);
            if ($dateTo) $consultationsQuery->whereDate('created_at', '<=', $dateTo);
            if (!$dateFrom && !$dateTo) {
                $consultationsQuery->whereMonth('created_at', $month)->whereYear('created_at', $year);
            }

            $totalConsultations = (clone $consultationsQuery)->count();
            $totalTelemed = (clone $consultationsQuery)->where('is_telemed', true)->count();
            $totalReferrals = (clone $consultationsQuery)->whereNotNull('referral_status')->where('referral_status', '!=', 'none')->count();
            $totalInjuries = (clone $consultationsQuery)->where('consultation_type', 'injury')->count();

            $patientCategories = Patient::where('campus_id', $campus->id)
                ->selectRaw('patient_category, count(*) as count')
                ->groupBy('patient_category')
                ->pluck('count', 'patient_category')
                ->toArray();

            $totalStockAvailable = (int) ($stockTotals[$campus->id] ?? 0);

            $lowStockItems = DB::table('medicine_stock_in as msi')
                ->where('msi.campus_id', $campus->id)
                ->selectRaw('
                    msi.medicine_id,
                    SUM(msi.quantity) 
                    - COALESCE((SELECT SUM(quantity_dispensed) FROM medicine_stock_out WHERE stock_in_id IN (SELECT id FROM medicine_stock_in WHERE campus_id = ? AND medicine_id = msi.medicine_id)), 0)
                    - COALESCE((SELECT SUM(quantity) FROM medicine_archived WHERE stock_in_id IN (SELECT id FROM medicine_stock_in WHERE campus_id = ? AND medicine_id = msi.medicine_id)), 0)
                    AS available
                ', [$campus->id, $campus->id])
                ->groupBy('msi.medicine_id')
                ->havingRaw('available <= 50')
                ->get()
                ->count();

            $expiringItems = DB::table('medicine_stock_in')
                ->where('campus_id', $campus->id)
                ->whereNotNull('expiration_date')
                ->whereDate('expiration_date', '>=', now()->toDateString())
                ->whereDate('expiration_date', '<=', now()->addDays(30)->toDateString())
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
            'period' => [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'month' => $dateFrom ? null : $month,
                'year' => $dateFrom ? null : $year,
            ],
            'campuses' => $reportData,
        ]);
    }

    public function campusDetail(Request $request, string $campusCode): JsonResponse
    {
        $validated = $request->validate([
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d'],
            'month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'year' => ['nullable', 'integer', 'min:2020'],
        ]);

        $dateFrom = $validated['date_from'] ?? null;
        $dateTo = $validated['date_to'] ?? null;
        $month = $validated['month'] ?? now()->month;
        $year = $validated['year'] ?? now()->year;

        $campus = Campus::where('code', $campusCode)->firstOrFail();

        $consultationsQuery = Consultation::whereHas('patient', function ($q) use ($campus) {
            $q->where('campus_id', $campus->id);
        });

        if ($dateFrom) $consultationsQuery->whereDate('created_at', '>=', $dateFrom);
        if ($dateTo) $consultationsQuery->whereDate('created_at', '<=', $dateTo);
        if (!$dateFrom && !$dateTo) {
            $consultationsQuery->whereMonth('created_at', $month)->whereYear('created_at', $year);
        }

        $topDiseases = (clone $consultationsQuery)
            ->whereNotNull('diagnosis')
            ->selectRaw('diagnosis, count(*) as count')
            ->groupBy('diagnosis')
            ->orderByDesc('count')
            ->take(5)
            ->get();

        $demographics = Patient::where('campus_id', $campus->id)
            ->selectRaw('patient_category, count(*) as count')
            ->groupBy('patient_category')
            ->pluck('count', 'patient_category')
            ->toArray();

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

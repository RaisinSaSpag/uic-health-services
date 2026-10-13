<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Reports\ReportSummaryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
}

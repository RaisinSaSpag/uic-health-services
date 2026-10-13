<?php

namespace App\Services\Reports;

use Illuminate\Support\Facades\Http;
use Throwable;

class ReportSummaryService
{
    /**
     * @param  array<string, mixed>  $payload
     * @return array{summary: string, source: string}
     */
    public function generateNarrative(array $payload): array
    {
        $fallbackSummary = $this->buildFallbackSummary($payload);

        $apiKey = trim((string) config('services.openai.api_key'));

        if ($apiKey === '') {
            return [
                'summary' => $fallbackSummary,
                'source' => 'fallback',
            ];
        }

        $model = (string) config('services.openai.model', 'gpt-4o-mini');
        $baseUrl = rtrim((string) config('services.openai.base_url', 'https://api.openai.com/v1'), '/');
        $timeout = max((int) config('services.openai.timeout', 20), 5);

        try {
            $response = Http::baseUrl($baseUrl)
                ->acceptJson()
                ->timeout($timeout)
                ->withToken($apiKey)
                ->post('/chat/completions', [
                    'model' => $model,
                    'temperature' => 0.3,
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'You are a nursing analytics assistant. Summarize monthly consultation findings clearly using 4 to 6 concise sentences. Mention top diseases, patient category distribution, referrals, and practical focus areas for nurse workflow. Avoid markdown and bullet lists.',
                        ],
                        [
                            'role' => 'user',
                            'content' => $this->buildPrompt($payload),
                        ],
                    ],
                ]);

            if ($response->failed()) {
                return [
                    'summary' => $fallbackSummary,
                    'source' => 'fallback',
                ];
            }

            $summary = trim((string) data_get($response->json(), 'choices.0.message.content', ''));

            if ($summary === '') {
                return [
                    'summary' => $fallbackSummary,
                    'source' => 'fallback',
                ];
            }

            return [
                'summary' => $summary,
                'source' => 'openai',
            ];
        } catch (Throwable) {
            return [
                'summary' => $fallbackSummary,
                'source' => 'fallback',
            ];
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function buildPrompt(array $payload): string
    {
        return "Generate a nursing report narrative using this JSON data.\n"
            . "Keep it practical and concise.\n\n"
            . json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function buildFallbackSummary(array $payload): string
    {
        $monthLabel = (string) ($payload['month_label'] ?? 'Selected month');
        $year = (int) ($payload['year'] ?? date('Y'));
        $totalConsultations = (int) ($payload['total_consultations'] ?? 0);
        $referredCount = (int) ($payload['referred_count'] ?? 0);

        $topDiseaseLabel = (string) data_get($payload, 'top_diseases.0.diagnosis', 'No dominant diagnosis');
        $topDiseaseCount = (int) data_get($payload, 'top_diseases.0.count', 0);

        $categorySummaries = [];

        foreach ((array) ($payload['patient_category_counts'] ?? []) as $category) {
            $label = (string) ($category['label'] ?? 'Category');
            $count = (int) ($category['count'] ?? 0);
            $categorySummaries[] = sprintf('%s: %d', $label, $count);
        }

        $categoryInsight = $categorySummaries === [] ? 'No category breakdown available' : implode(' | ', $categorySummaries);

        $basicTop = $this->formatTopBreakdown((array) data_get($payload, 'subgroup_breakdowns.basic.0', []), 'Basic');
        $collegeTop = $this->formatTopBreakdown((array) data_get($payload, 'subgroup_breakdowns.college.0', []), 'College');
        $employeeTop = $this->formatTopBreakdown((array) data_get($payload, 'subgroup_breakdowns.employee.0', []), 'Employees');

        return sprintf(
            'For %s %d, a total of %d consultations were recorded. The leading diagnosis was %s with %d case(s). Referrals accounted for %d consultation(s). Patient category distribution was %s. Top subgroup signals: %s | %s | %s.',
            $monthLabel,
            $year,
            $totalConsultations,
            $topDiseaseLabel,
            $topDiseaseCount,
            $referredCount,
            $categoryInsight,
            $basicTop,
            $collegeTop,
            $employeeTop,
        );
    }

    /**
     * @param  array<string, mixed>  $breakdown
     */
    private function formatTopBreakdown(array $breakdown, string $fallbackLabel): string
    {
        $label = trim((string) ($breakdown['label'] ?? ''));
        $count = (int) ($breakdown['count'] ?? 0);

        if ($label === '') {
            return sprintf('%s: no data', $fallbackLabel);
        }

        return sprintf('%s (%d)', $label, $count);
    }
}

<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\Medicine;
use App\Models\MedicineStockIn;
use App\Models\MedicineStockOut;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class ReportsApiTest extends TestCase
{
    use RefreshDatabase;

    private function seedStockOut(User $actor, Campus $campus, int $qty = 5, ?Carbon $when = null): void
    {
        $medicine = Medicine::create([
            'name' => 'Test Med ' . uniqid(),
            'category' => 'Analgesic',
        ]);

        $stockIn = MedicineStockIn::create([
            'medicine_id' => $medicine->id,
            'campus_id' => $campus->id,
            'quantity' => 100,
            'date_received' => Carbon::now()->subDays(10),
            'expiration_date' => Carbon::now()->addMonths(12),
            'received_by' => $actor->id,
        ]);

        MedicineStockOut::create([
            'stock_in_id' => $stockIn->id,
            'quantity_dispensed' => $qty,
            'dispensed_by' => $actor->id,
            'dispensed_at' => $when ?? Carbon::now()->subDays(2),
        ]);
    }

    public function test_nurse_can_fetch_stock_out_report(): void
    {
        $campus = Campus::first();
        $nurse = User::factory()->withRole('nurse')->create(['campus_id' => $campus->id]);
        $this->seedStockOut($nurse, $campus, 7);

        $response = $this->asUser($nurse)
            ->getJson('/api/v1/medicines/stock-out?campus_id=' . $campus->id);

        $response->assertOk();
        $this->assertGreaterThanOrEqual(1, count($response->json()));

        $first = $response->json()[0];
        $this->assertArrayHasKey('name', $first);
        $this->assertArrayHasKey('category', $first);
        $this->assertArrayHasKey('medicine_stock_out', $first);
        $this->assertSame(7, (int) $first['medicine_stock_out']);
    }

    public function test_report_filters_by_month_and_year(): void
    {
        $campus = Campus::first();
        $nurse = User::factory()->withRole('nurse')->create(['campus_id' => $campus->id]);

        // Stock out in a specific month
        $inMonth = Carbon::create(2025, 8, 15);
        $this->seedStockOut($nurse, $campus, 3, $inMonth);

        // Stock out in a different month
        $otherMonth = Carbon::create(2025, 9, 15);
        $this->seedStockOut($nurse, $campus, 999, $otherMonth);

        $response = $this->asUser($nurse)
            ->getJson('/api/v1/medicines/stock-out?campus_id=' . $campus->id . '&month=8&year=2025');

        $response->assertOk();
        $total = collect($response->json())->sum('medicine_stock_out');
        $this->assertSame(3, (int) $total);
    }

    public function test_report_is_campus_scoped(): void
    {
        $campusA = Campus::where('code', 'MAIN')->first();
        $campusB = Campus::where('code', 'BAJADA_GS')->first();

        $nurseA = User::factory()->withRole('nurse')->create(['campus_id' => $campusA->id]);
        $nurseB = User::factory()->withRole('nurse')->create(['campus_id' => $campusB->id]);

        $this->seedStockOut($nurseA, $campusA, 5);
        $this->seedStockOut($nurseB, $campusB, 88);

        $responseA = $this->asUser($nurseA)
            ->getJson('/api/v1/medicines/stock-out?campus_id=' . $campusA->id);

        $total = collect($responseA->json())->sum('medicine_stock_out');
        $this->assertSame(5, (int) $total);
    }

    public function test_empty_report_returns_empty_array(): void
    {
        $campus = Campus::where('code', 'BONIFACIO')->first();
        $nurse = User::factory()->withRole('nurse')->create(['campus_id' => $campus->id]);

        $response = $this->asUser($nurse)
            ->getJson('/api/v1/medicines/stock-out?campus_id=' . $campus->id);

        $response->assertOk();
        $this->assertIsArray($response->json());
        $this->assertCount(0, $response->json());
    }

    public function test_doctor_can_read_reports(): void
    {
        $campus = Campus::first();
        $doctor = User::factory()->withRole('doctor')->create(['campus_id' => $campus->id]);

        $this->asUser($doctor)
            ->getJson('/api/v1/medicines/stock-out?campus_id=' . $campus->id)
            ->assertOk();
    }
}
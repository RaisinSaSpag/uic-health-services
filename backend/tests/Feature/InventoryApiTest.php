<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\Medicine;
use App\Models\MedicineStockIn;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryApiTest extends TestCase
{
    use RefreshDatabase;

    // ------------------------------------------------------------
    // STOCK IN
    // ------------------------------------------------------------

    public function test_nurse_can_stock_in_medicine(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $medicine = Medicine::factory()->create();
        $campus = Campus::query()->first();

        $response = $this->asUser($nurse)->postJson('/api/v1/inventory/stock-in', [
            'medicine_id' => $medicine->id,
            'campus_id' => $campus->id,
            'quantity' => 100,
            'date_received' => now()->format('Y-m-d'),
            'expiration_date' => now()->addYear()->format('Y-m-d'),
        ]);

        $response->assertCreated()->assertJsonPath('quantity', 100);

        $this->assertDatabaseHas('medicine_stock_in', [
            'medicine_id' => $medicine->id,
            'campus_id' => $campus->id,
            'quantity' => 100,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'inventory.stocked_in',
            'entity_type' => 'medicine_stock_in',
        ]);
    }

    public function test_stock_in_fails_with_past_expiration(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $medicine = Medicine::factory()->create();
        $campus = Campus::query()->first();

        $response = $this->asUser($nurse)->postJson('/api/v1/inventory/stock-in', [
            'medicine_id' => $medicine->id,
            'campus_id' => $campus->id,
            'quantity' => 100,
            'date_received' => now()->format('Y-m-d'),
            'expiration_date' => now()->subDay()->format('Y-m-d'),
        ]);

        $response->assertStatus(422);
    }

    // ------------------------------------------------------------
    // DISPENSE
    // ------------------------------------------------------------

    public function test_nurse_can_dispense_medicine(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $campus = Campus::query()->first();
        $medicine = Medicine::factory()->create();

        $stockIn = MedicineStockIn::factory()->create([
            'medicine_id' => $medicine->id,
            'campus_id' => $campus->id,
            'quantity' => 100,
        ]);

        $response = $this->asUser($nurse)->postJson('/api/v1/inventory/dispense', [
            'stock_in_id' => $stockIn->id,
            'quantity_dispensed' => 10,
        ]);

        $response->assertCreated()->assertJsonPath('quantity_dispensed', 10);

        $this->assertDatabaseHas('medicine_stock_out', [
            'stock_in_id' => $stockIn->id,
            'quantity_dispensed' => 10,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'inventory.dispensed',
            'entity_type' => 'medicine_stock_out',
        ]);
    }

    public function test_dispense_fails_with_insufficient_stock(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $campus = Campus::query()->first();
        $medicine = Medicine::factory()->create();

        $stockIn = MedicineStockIn::factory()->create([
            'medicine_id' => $medicine->id,
            'campus_id' => $campus->id,
            'quantity' => 5,
        ]);

        $response = $this->asUser($nurse)->postJson('/api/v1/inventory/dispense', [
            'stock_in_id' => $stockIn->id,
            'quantity_dispensed' => 100,
        ]);

        $response->assertStatus(422);
    }

    // ------------------------------------------------------------
    // ARCHIVE
    // ------------------------------------------------------------

    public function test_nurse_can_archive_stock(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $campus = Campus::query()->first();
        $medicine = Medicine::factory()->create();

        $stockIn = MedicineStockIn::factory()->create([
            'medicine_id' => $medicine->id,
            'campus_id' => $campus->id,
            'quantity' => 50,
        ]);

        $response = $this->asUser($nurse)->postJson('/api/v1/inventory/archive', [
            'stock_in_id' => $stockIn->id,
            'quantity' => 10,
            'reason' => 'Damaged during transport',
        ]);

        $response->assertCreated()->assertJsonPath('quantity', 10);

        $this->assertDatabaseHas('medicine_archived', [
            'stock_in_id' => $stockIn->id,
            'quantity' => 10,
            'reason' => 'Damaged during transport',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'inventory.archived',
            'entity_type' => 'medicine_archived',
        ]);
    }

    // ------------------------------------------------------------
    // AVAILABLE STOCK
    // ------------------------------------------------------------

    public function test_nurse_can_view_available_stock(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $campus = Campus::query()->first();
        MedicineStockIn::factory()->count(2)->create([
            'campus_id' => $campus->id,
            'quantity' => 100,
        ]);

        $response = $this->asUser($nurse)->getJson('/api/v1/inventory/available?campus_id=' . $campus->id);

        $response->assertOk();
        $this->assertGreaterThanOrEqual(2, count($response->json()));
    }

    // ------------------------------------------------------------
    // LOW STOCK
    // ------------------------------------------------------------

    public function test_nurse_can_view_low_stock(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $campus = Campus::query()->first();

        $lowStock = MedicineStockIn::factory()->create([
            'campus_id' => $campus->id,
            'quantity' => 20,
        ]);

        $response = $this->asUser($nurse)->getJson('/api/v1/inventory/low-stock?campus_id=' . $campus->id);

        $response->assertOk();
        $this->assertGreaterThanOrEqual(1, count($response->json()));
    }

    // ------------------------------------------------------------
    // EXPIRING SOON
    // ------------------------------------------------------------

    public function test_nurse_can_view_expiring_soon(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $campus = Campus::query()->first();

        MedicineStockIn::factory()->create([
            'campus_id' => $campus->id,
            'quantity' => 50,
            'expiration_date' => now()->addDays(15)->format('Y-m-d'),
        ]);

        $response = $this->asUser($nurse)->getJson('/api/v1/inventory/expiring-soon?campus_id=' . $campus->id);

        $response->assertOk();
        $this->assertGreaterThanOrEqual(1, count($response->json()));
    }

    // ------------------------------------------------------------
    // PERMISSIONS
    // ------------------------------------------------------------

    public function test_student_cannot_dispense_medicine(): void
    {
        $student = $this->createUserWithRole('student');
        $campus = Campus::query()->first();
        $stockIn = MedicineStockIn::factory()->create(['campus_id' => $campus->id]);

        $response = $this->asUser($student)->postJson('/api/v1/inventory/dispense', [
            'stock_in_id' => $stockIn->id,
            'quantity_dispensed' => 5,
        ]);

        $response->assertForbidden();
    }

    public function test_doctor_cannot_stock_in_medicine(): void
    {
        $doctor = $this->createUserWithRole('doctor');
        $medicine = Medicine::factory()->create();
        $campus = Campus::query()->first();

        $response = $this->asUser($doctor)->postJson('/api/v1/inventory/stock-in', [
            'medicine_id' => $medicine->id,
            'campus_id' => $campus->id,
            'quantity' => 100,
            'date_received' => now()->format('Y-m-d'),
            'expiration_date' => now()->addYear()->format('Y-m-d'),
        ]);

        $response->assertForbidden();
    }
}
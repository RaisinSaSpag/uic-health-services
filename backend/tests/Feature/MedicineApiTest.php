<?php

namespace Tests\Feature;

use App\Models\Medicine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MedicineApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_nurse_can_list_medicines(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        Medicine::factory()->count(3)->create();
        $response = $this->asUser($nurse)->getJson('/api/v1/medicines');
        $response->assertOk()->assertJsonCount(3);
    }

    public function test_medicine_search_filters_by_name(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        Medicine::factory()->create(['name' => 'Paracetamol 500mg', 'category' => 'Pain Relief']);
        Medicine::factory()->create(['name' => 'Amoxicillin 250mg', 'category' => 'Antibiotic']);
        $response = $this->asUser($nurse)->getJson('/api/v1/medicines?search=Para');
        $response->assertOk()->assertJsonCount(1);
        $this->assertSame('Paracetamol 500mg', $response->json('0.name'));
    }

    public function test_nurse_can_view_a_single_medicine(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $medicine = Medicine::factory()->create(['name' => 'Ibuprofen 400mg']);
        $response = $this->asUser($nurse)->getJson("/api/v1/medicines/{$medicine->id}");
        $response->assertOk()->assertJsonPath('name', 'Ibuprofen 400mg');
    }

    public function test_nurse_can_create_a_medicine(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $response = $this->asUser($nurse)->postJson('/api/v1/medicines', [
            'name' => 'Biogesic 500mg',
            'category' => 'Pain Relief',
        ]);
        $response->assertCreated()->assertJsonPath('name', 'Biogesic 500mg');
        $this->assertDatabaseHas('medicines', ['name' => 'Biogesic 500mg', 'category' => 'Pain Relief']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'medicine.created', 'entity_type' => 'medicine']);
    }

    public function test_create_medicine_fails_with_duplicate_name(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        Medicine::factory()->create(['name' => 'Paracetamol 500mg']);
        $response = $this->asUser($nurse)->postJson('/api/v1/medicines', [
            'name' => 'Paracetamol 500mg',
            'category' => 'Pain Relief',
        ]);
        $response->assertStatus(422)->assertJsonPath('message', 'A medicine with this name already exists.');
    }

    public function test_create_medicine_fails_without_required_fields(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $response = $this->asUser($nurse)->postJson('/api/v1/medicines', []);
        $response->assertStatus(422);
    }

    public function test_nurse_can_update_a_medicine(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $medicine = Medicine::factory()->create(['name' => 'Old Name', 'category' => 'Pain Relief']);
        $response = $this->asUser($nurse)->patchJson("/api/v1/medicines/{$medicine->id}", ['name' => 'New Name']);
        $response->assertOk()->assertJsonPath('name', 'New Name');
        $this->assertDatabaseHas('medicines', ['id' => $medicine->id, 'name' => 'New Name']);
    }

    public function test_nurse_can_delete_a_medicine_without_stock(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $medicine = Medicine::factory()->create();
        $response = $this->asUser($nurse)->deleteJson("/api/v1/medicines/{$medicine->id}");
        $response->assertOk();
        $this->assertDatabaseMissing('medicines', ['id' => $medicine->id]);
    }

    public function test_student_cannot_create_a_medicine(): void
    {
        $student = $this->createUserWithRole('student');
        $response = $this->asUser($student)->postJson('/api/v1/medicines', [
            'name' => 'Test Medicine',
            'category' => 'Test',
        ]);
        $response->assertForbidden();
    }

    public function test_doctor_can_view_medicines_but_not_create(): void
    {
        $doctor = $this->createUserWithRole('doctor');
        Medicine::factory()->create();
        $this->asUser($doctor)->getJson('/api/v1/medicines')->assertOk();
        $this->asUser($doctor)->postJson('/api/v1/medicines', [
            'name' => 'Test',
            'category' => 'Test',
        ])->assertForbidden();
    }
}
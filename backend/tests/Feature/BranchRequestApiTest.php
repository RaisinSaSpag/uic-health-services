<?php

namespace Tests\Feature;

use App\Models\BranchRequest;
use App\Models\Campus;
use App\Models\Medicine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BranchRequestApiTest extends TestCase
{
    use RefreshDatabase;

    // ------------------------------------------------------------
    // CREATE
    // ------------------------------------------------------------

    public function test_nurse_can_create_branch_request(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $fromCampus = Campus::query()->first();
        $toCampus = Campus::query()->skip(1)->first();
        $medicine = Medicine::factory()->create();

        // Seed sufficient stock at the target campus so the request can be fulfilled
        \App\Models\MedicineStockIn::create([
            'medicine_id' => $medicine->id,
            'campus_id' => $toCampus->id,
            'quantity' => 500,
            'date_received' => now()->subDays(5),
            'expiration_date' => now()->addYear(),
            'received_by' => $nurse->id,
        ]);

        $response = $this->asUser($nurse)->postJson('/api/v1/branch-requests', [
            'from_campus_id' => $fromCampus->id,
            'to_campus_id' => $toCampus->id,
            'medicine_id' => $medicine->id,
            'quantity_requested' => 50,
        ]);

        $response->assertCreated()
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('quantity_requested', 50);

        $this->assertDatabaseHas('branch_requests', [
            'from_campus_id' => $fromCampus->id,
            'to_campus_id' => $toCampus->id,
            'medicine_id' => $medicine->id,
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'branch_request.created',
            'entity_type' => 'branch_request',
        ]);
    

        $response->assertCreated()
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('quantity_requested', 50);

        $this->assertDatabaseHas('branch_requests', [
            'from_campus_id' => $fromCampus->id,
            'to_campus_id' => $toCampus->id,
            'medicine_id' => $medicine->id,
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'branch_request.created',
            'entity_type' => 'branch_request',
        ]);
    }

    public function test_branch_request_fails_if_same_campus(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $campus = Campus::query()->first();
        $medicine = Medicine::factory()->create();

        $response = $this->asUser($nurse)->postJson('/api/v1/branch-requests', [
            'from_campus_id' => $campus->id,
            'to_campus_id' => $campus->id,
            'medicine_id' => $medicine->id,
            'quantity_requested' => 50,
        ]);

        $response->assertStatus(422);
    }

    // ------------------------------------------------------------
    // LIST
    // ------------------------------------------------------------

    public function test_nurse_can_list_branch_requests(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $campus = Campus::query()->first();

        BranchRequest::factory()->count(3)->create([
            'from_campus_id' => $campus->id,
        ]);

        $response = $this->asUser($nurse)->getJson('/api/v1/branch-requests?campus_id=' . $campus->id);

        $response->assertOk();
        $this->assertGreaterThanOrEqual(3, count($response->json()));
    }

    // ------------------------------------------------------------
    // APPROVE
    // ------------------------------------------------------------

    public function test_nurse_can_approve_branch_request(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $branchRequest = BranchRequest::factory()->create(['status' => 'pending']);

        $response = $this->asUser($nurse)->patchJson(
            "/api/v1/branch-requests/{$branchRequest->id}/approve"
        );

        $response->assertOk()->assertJsonPath('status', 'approved');

        $this->assertDatabaseHas('branch_requests', [
            'id' => $branchRequest->id,
            'status' => 'approved',
            'approved_by' => $nurse->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'branch_request.approved',
            'entity_type' => 'branch_request',
            'entity_id' => $branchRequest->id,
        ]);
    }

    public function test_approve_fails_if_not_pending(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $branchRequest = BranchRequest::factory()->create(['status' => 'approved']);

        $response = $this->asUser($nurse)->patchJson(
            "/api/v1/branch-requests/{$branchRequest->id}/approve"
        );

        $response->assertStatus(409);
    }

    // ------------------------------------------------------------
    // REJECT
    // ------------------------------------------------------------

    public function test_nurse_can_reject_branch_request(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $branchRequest = BranchRequest::factory()->create(['status' => 'pending']);

        $response = $this->asUser($nurse)->patchJson(
            "/api/v1/branch-requests/{$branchRequest->id}/reject",
            ['reason' => 'Not enough stock']
        );

        $response->assertOk()->assertJsonPath('status', 'rejected');

        $this->assertDatabaseHas('branch_requests', [
            'id' => $branchRequest->id,
            'status' => 'rejected',
        ]);
    }

    // ------------------------------------------------------------
    // COMPLETE
    // ------------------------------------------------------------

    public function test_nurse_can_complete_approved_request(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $branchRequest = BranchRequest::factory()->create(['status' => 'approved']);

        // Seed enough stock at the supplying campus to cover the request
        \App\Models\MedicineStockIn::create([
            'medicine_id' => $branchRequest->medicine_id,
            'campus_id' => $branchRequest->to_campus_id,
            'quantity' => 100,
            'date_received' => now()->subDays(5),
            'expiration_date' => now()->addYear(),
            'received_by' => $nurse->id,
        ]);

        $response = $this->asUser($nurse)->patchJson(
            "/api/v1/branch-requests/{$branchRequest->id}/complete"
        );

        $response->assertOk()->assertJsonPath('status', 'completed');

        $this->assertDatabaseHas('branch_requests', [
            'id' => $branchRequest->id,
            'status' => 'completed',
        ]);
    }

    public function test_complete_fails_if_not_approved(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $branchRequest = BranchRequest::factory()->create(['status' => 'pending']);

        $response = $this->asUser($nurse)->patchJson(
            "/api/v1/branch-requests/{$branchRequest->id}/complete"
        );

        $response->assertStatus(409);
    }

    // ------------------------------------------------------------
    // SHOW
    // ------------------------------------------------------------

    public function test_nurse_can_view_a_single_branch_request(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $branchRequest = BranchRequest::factory()->create();

        $response = $this->asUser($nurse)->getJson("/api/v1/branch-requests/{$branchRequest->id}");

        $response->assertOk()
            ->assertJsonPath('id', $branchRequest->id)
            ->assertJsonPath('status', $branchRequest->status);
    }

    // ------------------------------------------------------------
    // PERMISSIONS
    // ------------------------------------------------------------

    public function test_student_cannot_create_branch_request(): void
    {
        $student = $this->createUserWithRole('student');
        $fromCampus = Campus::query()->first();
        $toCampus = Campus::query()->skip(1)->first();
        $medicine = Medicine::factory()->create();

        $response = $this->asUser($student)->postJson('/api/v1/branch-requests', [
            'from_campus_id' => $fromCampus->id,
            'to_campus_id' => $toCampus->id,
            'medicine_id' => $medicine->id,
            'quantity_requested' => 10,
        ]);

        $response->assertForbidden();
    }

        public function test_branch_request_fails_when_target_campus_has_insufficient_stock(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $fromCampus = Campus::query()->first();
        $toCampus = Campus::query()->skip(1)->first();
        $medicine = Medicine::factory()->create();

        // Seed only 10 units at target campus
        \App\Models\MedicineStockIn::create([
            'medicine_id' => $medicine->id,
            'campus_id' => $toCampus->id,
            'quantity' => 10,
            'date_received' => now()->subDays(5),
            'expiration_date' => now()->addYear(),
            'received_by' => $nurse->id,
        ]);

        // Request 50 — should be rejected
        $response = $this->asUser($nurse)->postJson('/api/v1/branch-requests', [
            'from_campus_id' => $fromCampus->id,
            'to_campus_id' => $toCampus->id,
            'medicine_id' => $medicine->id,
            'quantity_requested' => 50,
        ]);

        $response->assertStatus(422)
            ->assertJsonFragment(['message' => 'Insufficient stock at target campus. Available: 10, Requested: 50']);

        $this->assertDatabaseMissing('branch_requests', [
            'to_campus_id' => $toCampus->id,
            'medicine_id' => $medicine->id,
            'quantity_requested' => 50,
        ]);
    }
}
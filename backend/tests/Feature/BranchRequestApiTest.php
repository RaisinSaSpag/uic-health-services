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
        $fromCampus = Campus::query()->first();
        $toCampus = Campus::query()->skip(1)->first();
        $medicine = Medicine::factory()->create();

        $nurse = $this->createUserWithRole('nurse');
        $nurse->update(['campus_id' => $fromCampus->id]);

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
    }

    public function test_branch_request_fails_if_same_campus(): void
    {
        $campus = Campus::query()->first();
        $medicine = Medicine::factory()->create();

        $nurse = $this->createUserWithRole('nurse');
        $nurse->update(['campus_id' => $campus->id]);

        $response = $this->asUser($nurse)->postJson('/api/v1/branch-requests', [
            'from_campus_id' => $campus->id,
            'to_campus_id' => $campus->id,
            'medicine_id' => $medicine->id,
            'quantity_requested' => 50,
        ]);

        $response->assertStatus(422);
    }

    public function test_nurse_cannot_create_request_for_another_campus(): void
    {
        $campusA = Campus::query()->first();
        $campusB = Campus::query()->skip(1)->first();
        $medicine = Medicine::factory()->create();

        $nurse = $this->createUserWithRole('nurse');
        $nurse->update(['campus_id' => $campusA->id]);

        $response = $this->asUser($nurse)->postJson('/api/v1/branch-requests', [
            'from_campus_id' => $campusB->id,
            'to_campus_id' => $campusA->id,
            'medicine_id' => $medicine->id,
            'quantity_requested' => 10,
        ]);

        $response->assertStatus(422)
            ->assertJsonFragment(['message' => 'You may only create branch requests for your own campus.']);
    }

    // ------------------------------------------------------------
    // LIST
    // ------------------------------------------------------------

    public function test_nurse_can_list_branch_requests(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $campus = Campus::query()->first();
        $nurse->update(['campus_id' => $campus->id]);

        BranchRequest::factory()->count(3)->create([
            'from_campus_id' => $campus->id,
        ]);

        $response = $this->asUser($nurse)->getJson('/api/v1/branch-requests?campus_id=' . $campus->id);

        $response->assertOk();
        $this->assertGreaterThanOrEqual(3, count($response->json()));
    }

    // ------------------------------------------------------------
    // APPROVE / REJECT
    // ------------------------------------------------------------

    public function test_nurse_can_approve_branch_request(): void
    {
        $supplyingCampus = Campus::query()->first();
        $requestingCampus = Campus::query()->skip(1)->first();

        $approverNurse = $this->createUserWithRole('nurse');
        $approverNurse->update(['campus_id' => $supplyingCampus->id]);

        $requesterNurse = $this->createUserWithRole('nurse');
        $requesterNurse->update(['campus_id' => $requestingCampus->id]);

        $branchRequest = BranchRequest::factory()->create([
            'status' => 'pending',
            'from_campus_id' => $requestingCampus->id,
            'to_campus_id' => $supplyingCampus->id,
            'requested_by' => $requesterNurse->id,
        ]);

        $response = $this->asUser($approverNurse)->patchJson(
            "/api/v1/branch-requests/{$branchRequest->id}/approve"
        );

        $response->assertOk()->assertJsonPath('status', 'approved');

        $this->assertDatabaseHas('branch_requests', [
            'id' => $branchRequest->id,
            'status' => 'approved',
            'approved_by' => $approverNurse->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'branch_request.approved',
            'entity_type' => 'branch_request',
            'entity_id' => $branchRequest->id,
        ]);
    }

    public function test_nurse_cannot_approve_own_request(): void
    {
        $campus = Campus::query()->first();
        $nurse = $this->createUserWithRole('nurse');
        $nurse->update(['campus_id' => $campus->id]);

        $branchRequest = BranchRequest::factory()->create([
            'status' => 'pending',
            'to_campus_id' => $campus->id,
            'requested_by' => $nurse->id,
        ]);

        $response = $this->asUser($nurse)->patchJson(
            "/api/v1/branch-requests/{$branchRequest->id}/approve"
        );

        $response->assertStatus(409)
            ->assertJsonFragment(['message' => 'You cannot approve your own branch request.']);
    }

    public function test_approve_fails_if_not_pending(): void
    {
        $supplyingCampus = Campus::query()->first();
        $nurse = $this->createUserWithRole('nurse');
        $nurse->update(['campus_id' => $supplyingCampus->id]);

        $branchRequest = BranchRequest::factory()->create([
            'status' => 'approved',
            'to_campus_id' => $supplyingCampus->id,
        ]);

        $response = $this->asUser($nurse)->patchJson(
            "/api/v1/branch-requests/{$branchRequest->id}/approve"
        );

        $response->assertStatus(409);
    }

    public function test_nurse_can_reject_branch_request(): void
    {
        $supplyingCampus = Campus::query()->first();
        $requestingCampus = Campus::query()->skip(1)->first();

        $nurse = $this->createUserWithRole('nurse');
        $nurse->update(['campus_id' => $supplyingCampus->id]);

        $requester = $this->createUserWithRole('nurse');
        $requester->update(['campus_id' => $requestingCampus->id]);

        $branchRequest = BranchRequest::factory()->create([
            'status' => 'pending',
            'from_campus_id' => $requestingCampus->id,
            'to_campus_id' => $supplyingCampus->id,
            'requested_by' => $requester->id,
        ]);

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
    // SHIP / RECEIVE / STOCK-IN
    // ------------------------------------------------------------

    public function test_nurse_can_ship_approved_request(): void
    {
        $supplyingCampus = Campus::query()->first();
        $requestingCampus = Campus::query()->skip(1)->first();

        $shippingNurse = $this->createUserWithRole('nurse');
        $shippingNurse->update(['campus_id' => $supplyingCampus->id]);

        $branchRequest = BranchRequest::factory()->create([
            'status' => 'approved',
            'from_campus_id' => $requestingCampus->id,
            'to_campus_id' => $supplyingCampus->id,
            'quantity_requested' => 10,
        ]);

        \App\Models\MedicineStockIn::create([
            'medicine_id' => $branchRequest->medicine_id,
            'campus_id' => $branchRequest->to_campus_id,
            'quantity' => 100,
            'date_received' => now()->subDays(5),
            'expiration_date' => now()->addYear(),
            'received_by' => $shippingNurse->id,
        ]);

        $response = $this->asUser($shippingNurse)->patchJson(
            "/api/v1/branch-requests/{$branchRequest->id}/ship"
        );

        $response->assertOk()->assertJsonPath('status', 'shipped');

        $this->assertDatabaseHas('branch_requests', [
            'id' => $branchRequest->id,
            'status' => 'shipped',
        ]);
    }

    public function test_nurse_cannot_ship_request_from_another_campus(): void
    {
        $supplyingCampus = Campus::query()->first();
        $requestingCampus = Campus::query()->skip(1)->first();

        $wrongNurse = $this->createUserWithRole('nurse');
        $wrongNurse->update(['campus_id' => $requestingCampus->id]);

        $branchRequest = BranchRequest::factory()->create([
            'status' => 'approved',
            'from_campus_id' => $requestingCampus->id,
            'to_campus_id' => $supplyingCampus->id,
        ]);

        $response = $this->asUser($wrongNurse)->patchJson(
            "/api/v1/branch-requests/{$branchRequest->id}/ship"
        );

        $response->assertStatus(409)
            ->assertJsonFragment(['message' => 'Only the supplying campus can ship this request.']);
    }

    public function test_ship_fails_if_not_approved(): void
    {
        $nurse = $this->createUserWithRole('nurse');
        $branchRequest = BranchRequest::factory()->create(['status' => 'pending']);

        $response = $this->asUser($nurse)->patchJson(
            "/api/v1/branch-requests/{$branchRequest->id}/ship"
        );

        $response->assertStatus(409);
    }

    public function test_nurse_can_receive_shipped_request(): void
    {
        $supplyingCampus = Campus::query()->first();
        $requestingCampus = Campus::query()->skip(1)->first();

        $receivingNurse = $this->createUserWithRole('nurse');
        $receivingNurse->update(['campus_id' => $requestingCampus->id]);

        $branchRequest = BranchRequest::factory()->create([
            'status' => 'shipped',
            'from_campus_id' => $requestingCampus->id,
            'to_campus_id' => $supplyingCampus->id,
        ]);

        $response = $this->asUser($receivingNurse)->patchJson(
            "/api/v1/branch-requests/{$branchRequest->id}/receive"
        );

        $response->assertOk()->assertJsonPath('status', 'received');

        $this->assertDatabaseHas('branch_requests', [
            'id' => $branchRequest->id,
            'status' => 'received',
        ]);
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
        $fromCampus = Campus::query()->first();
        $toCampus = Campus::query()->skip(1)->first();
        $medicine = Medicine::factory()->create();

        $student = $this->createUserWithRole('student');

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
        $fromCampus = Campus::query()->first();
        $toCampus = Campus::query()->skip(1)->first();
        $medicine = Medicine::factory()->create();

        $nurse = $this->createUserWithRole('nurse');
        $nurse->update(['campus_id' => $fromCampus->id]);

        \App\Models\MedicineStockIn::create([
            'medicine_id' => $medicine->id,
            'campus_id' => $toCampus->id,
            'quantity' => 10,
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

        $response->assertStatus(422)
            ->assertJsonFragment([
                'message' => 'Insufficient stock at supplying campus. Available: 10, Requested: 50',
            ]);

        $this->assertDatabaseMissing('branch_requests', [
            'to_campus_id' => $toCampus->id,
            'medicine_id' => $medicine->id,
            'quantity_requested' => 50,
        ]);
    }
}
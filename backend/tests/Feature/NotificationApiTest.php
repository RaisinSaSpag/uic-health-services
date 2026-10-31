<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Campus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationApiTest extends TestCase
{
    use RefreshDatabase;

    private function makeAuditLog(User $user, string $action = 'inventory.stocked_in'): AuditLog
    {
        return AuditLog::create([
            'user_id' => $user->id,
            'action' => $action,
            'entity_type' => 'medicine',
            'entity_id' => 1,
            'old_values_json' => null,
            'new_values_json' => ['qty' => 10],
            'ip_address' => '127.0.0.1',
            'user_agent' => 'test',
            'created_at' => now(),
        ]);
    }

    public function test_nurse_can_fetch_notifications(): void
    {
        $campus = Campus::first();
        $nurse = User::factory()->withRole('nurse')->create(['campus_id' => $campus->id]);
        $this->makeAuditLog($nurse);

        $response = $this->asUser($nurse)->getJson('/api/v1/notifications?campus_id=' . $campus->id);

        $response->assertOk();
        $this->assertGreaterThanOrEqual(1, count($response->json()));
        $this->assertArrayHasKey('type', $response->json()[0]);
        $this->assertArrayHasKey('message', $response->json()[0]);
        $this->assertArrayHasKey('is_read', $response->json()[0]);
    }

    public function test_unread_count_starts_at_one(): void
    {
        $campus = Campus::first();
        $nurse = User::factory()->withRole('nurse')->create(['campus_id' => $campus->id]);
        $this->makeAuditLog($nurse);

        $response = $this->asUser($nurse)->getJson('/api/v1/notifications/unread-count');

        $response->assertOk()->assertJsonPath('unread', 1);
    }

    public function test_marking_all_read_clears_unread_count(): void
    {
        $campus = Campus::first();
        $nurse = User::factory()->withRole('nurse')->create(['campus_id' => $campus->id]);
        $this->makeAuditLog($nurse);

        $this->asUser($nurse)
            ->postJson('/api/v1/notifications/mark-read', ['campus_id' => $campus->id])
            ->assertOk();

        $response = $this->asUser($nurse)->getJson('/api/v1/notifications/unread-count');
        $response->assertJsonPath('unread', 0);

        $this->assertDatabaseCount('notification_reads', 1);
    }

    public function test_notifications_are_campus_scoped(): void
    {
        $campusA = Campus::where('code', 'MAIN')->first();
        $campusB = Campus::where('code', 'BAJADA_GS')->first();

        $nurseA = User::factory()->withRole('nurse')->create(['campus_id' => $campusA->id]);
        $nurseB = User::factory()->withRole('nurse')->create(['campus_id' => $campusB->id]);

        $this->makeAuditLog($nurseA);
        $this->makeAuditLog($nurseB);

        $responseA = $this->asUser($nurseA)->getJson('/api/v1/notifications?campus_id=' . $campusA->id);

        // Campus A's list should not contain campus B's log
        $allIds = collect($responseA->json())->pluck('id')->all();
        $campusBLogs = AuditLog::where('user_id', $nurseB->id)->pluck('id')->all();

        foreach ($campusBLogs as $id) {
            $this->assertNotContains($id, $allIds);
        }
    }

    public function test_doctor_can_access_notifications(): void
    {
        $campus = Campus::first();
        $doctor = User::factory()->withRole('doctor')->create(['campus_id' => $campus->id]);

        $this->asUser($doctor)->getJson('/api/v1/notifications?campus_id=' . $campus->id)->assertOk();
    }

    public function test_student_cannot_access_notifications(): void
    {
        $student = User::factory()->withRole('student')->create();

        $this->asUser($student)->getJson('/api/v1/notifications')->assertForbidden();
        $this->asUser($student)->getJson('/api/v1/notifications/unread-count')->assertForbidden();
    }

    /**
     * 🚨 SECURITY: nurses can no longer peek at another campus's notifications.
     * The `campus_id` query param is now IGNORED for non-coordinators.
     */
    public function test_nurse_cannot_peek_at_another_campus_via_campus_id_param(): void
    {
        $campusA = Campus::where('code', 'MAIN')->first();
        $campusB = Campus::where('code', 'BAJADA_GS')->first();

        $nurseA = User::factory()->withRole('nurse')->create(['campus_id' => $campusA->id]);
        $nurseB = User::factory()->withRole('nurse')->create(['campus_id' => $campusB->id]);

        // Create 1 log at Campus A
        $this->makeAuditLog($nurseA);

        // Create 2 logs at Campus B
        $this->makeAuditLog($nurseB);
        $this->makeAuditLog($nurseB);

        // Nurse A marks their own campus notifications as read
        $this->asUser($nurseA)->postJson('/api/v1/notifications/mark-read', [
            'campus_id' => $campusA->id,
        ])->assertOk();

        // 🚨 Nurse A tries to peek at Campus B → IGNORED, returns own-campus unread (0)
        $response = $this->asUser($nurseA)->getJson('/api/v1/notifications/unread-count?campus_id=' . $campusB->id);
        $response->assertOk()->assertJsonPath('unread', 0);

        // Nurse B (own campus) sees the 2 unread logs
        $response = $this->asUser($nurseB)->getJson('/api/v1/notifications/unread-count?campus_id=' . $campusB->id);
        $response->assertOk()->assertJsonPath('unread', 2);

        // Nurse A checks own campus → 0 (already marked read)
        $response = $this->asUser($nurseA)->getJson('/api/v1/notifications/unread-count?campus_id=' . $campusA->id);
        $response->assertOk()->assertJsonPath('unread', 0);
    }
}
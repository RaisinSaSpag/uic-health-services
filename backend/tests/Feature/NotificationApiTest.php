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
        public function test_unread_count_is_scoped_to_the_requested_campus(): void
    {
        $campusA = Campus::where('code', 'MAIN')->first();
        $campusB = Campus::where('code', 'BAJADA_GS')->first();
        
        $nurseA = User::factory()->withRole('nurse')->create(['campus_id' => $campusA->id]);
        $nurseB = User::factory()->withRole('nurse')->create(['campus_id' => $campusB->id]);

        // Create 1 notifiable log at Campus A
        $this->makeAuditLog($nurseA);
        
        // Create 2 notifiable logs at Campus B
        $this->makeAuditLog($nurseB);
        $this->makeAuditLog($nurseB);

        // Nurse A reads their Campus A notifications
        $this->asUser($nurseA)->postJson('/api/v1/notifications/mark-read', [
            'campus_id' => $campusA->id
        ])->assertOk();

        // Check Nurse A's unread count for Campus B (should be 2, because they haven't read B's logs)
        $response = $this->asUser($nurseA)->getJson('/api/v1/notifications/unread-count?campus_id=' . $campusB->id);
        $response->assertOk()->assertJsonPath('unread', 2);
        
        // Check Nurse B's unread count for Campus B (should also be 2, they haven't read anything)
        $response = $this->asUser($nurseB)->getJson('/api/v1/notifications/unread-count?campus_id=' . $campusB->id);
        $response->assertOk()->assertJsonPath('unread', 2);
        
        // Nurse A checks their own campus (should be 0, they just marked it read)
        $response = $this->asUser($nurseA)->getJson('/api/v1/notifications/unread-count?campus_id=' . $campusA->id);
        $response->assertOk()->assertJsonPath('unread', 0);
    }
}
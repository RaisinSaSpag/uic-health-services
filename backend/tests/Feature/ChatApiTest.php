<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChatApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_nurse_can_list_contacts(): void
    {
        $campus = Campus::first();
        $nurse = User::factory()->withRole('nurse')->create(['campus_id' => $campus->id]);
        $doctor = User::factory()->withRole('doctor')->create(['campus_id' => $campus->id]);

        $response = $this->asUser($nurse)->getJson('/api/v1/messages/contacts');

        $response->assertOk();
        $emails = collect($response->json())->pluck('email')->all();
        $this->assertContains($doctor->email, $emails);
        $this->assertNotContains($nurse->email, $emails);
    }

    public function test_contacts_include_cross_campus_users(): void
    {
        $campusA = Campus::where('code', 'MAIN')->first();
        $campusB = Campus::where('code', 'BAJADA_GS')->first();

        $nurse = User::factory()->withRole('nurse')->create(['campus_id' => $campusA->id]);
        $other = User::factory()->withRole('nurse')->create(['campus_id' => $campusB->id]);

        $response = $this->asUser($nurse)->getJson('/api/v1/messages/contacts');

        $response->assertOk();
        $emails = collect($response->json())->pluck('email')->all();
        $this->assertContains($other->email, $emails);
    }

    public function test_nurse_can_send_message(): void
    {
        $campus = Campus::first();
        $nurse = User::factory()->withRole('nurse')->create(['campus_id' => $campus->id]);
        $doctor = User::factory()->withRole('doctor')->create(['campus_id' => $campus->id]);

        $response = $this->asUser($nurse)->postJson('/api/v1/messages', [
            'recipient_id' => $doctor->id,
            'body' => 'Hello doctor, test message.',
        ]);

        $response->assertCreated()
            ->assertJsonPath('sender_id', $nurse->id)
            ->assertJsonPath('recipient_id', $doctor->id)
            ->assertJsonPath('body', 'Hello doctor, test message.');

        $this->assertDatabaseHas('messages', [
            'sender_id' => $nurse->id,
            'recipient_id' => $doctor->id,
            'body' => 'Hello doctor, test message.',
        ]);
    }

    public function test_cannot_message_yourself(): void
    {
        $nurse = User::factory()->withRole('nurse')->create();

        $response = $this->asUser($nurse)->postJson('/api/v1/messages', [
            'recipient_id' => $nurse->id,
            'body' => 'Self message',
        ]);

        $response->assertStatus(422);
    }

    public function test_nurse_can_fetch_thread(): void
    {
        $nurse = User::factory()->withRole('nurse')->create();
        $doctor = User::factory()->withRole('doctor')->create();

        Message::create([
            'sender_id' => $nurse->id,
            'recipient_id' => $doctor->id,
            'body' => 'Message from nurse',
        ]);
        Message::create([
            'sender_id' => $doctor->id,
            'recipient_id' => $nurse->id,
            'body' => 'Reply from doctor',
        ]);

        $response = $this->asUser($nurse)->getJson("/api/v1/messages/thread/{$doctor->id}");

        $response->assertOk();
        $this->assertCount(2, $response->json());
        $this->assertTrue($response->json()[0]['from_me']);
        $this->assertFalse($response->json()[1]['from_me']);
    }

    public function test_unread_count_reflects_new_messages(): void
    {
        $nurse = User::factory()->withRole('nurse')->create();
        $doctor = User::factory()->withRole('doctor')->create();

        Message::create([
            'sender_id' => $nurse->id,
            'recipient_id' => $doctor->id,
            'body' => 'Unread message',
        ]);

        $response = $this->asUser($doctor)->getJson('/api/v1/messages/unread-count');

        $response->assertOk()->assertJsonPath('unread', 1);
    }

    public function test_mark_thread_read_clears_unread_count(): void
    {
        $nurse = User::factory()->withRole('nurse')->create();
        $doctor = User::factory()->withRole('doctor')->create();

        Message::create([
            'sender_id' => $nurse->id,
            'recipient_id' => $doctor->id,
            'body' => 'Marked read',
        ]);

        $this->asUser($doctor)
            ->postJson("/api/v1/messages/read/{$nurse->id}")
            ->assertOk();

        $this->assertDatabaseMissing('messages', [
            'sender_id' => $nurse->id,
            'recipient_id' => $doctor->id,
            'read_at' => null,
        ]);
    }

    public function test_student_cannot_access_chat(): void
    {
        $student = User::factory()->withRole('student')->create();

        $this->asUser($student)->getJson('/api/v1/messages/contacts')->assertForbidden();
        $this->asUser($student)->getJson('/api/v1/messages/unread-count')->assertForbidden();
    }
}
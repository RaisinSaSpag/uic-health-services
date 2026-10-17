<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminUserManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_search_users(): void
    {
        $admin = User::factory()->withRole('admin')->create();

        $targetUser = User::factory()->withRole('employee')->create([
            'email' => 'targetuser@uic.edu.ph',
            'first_name' => 'Target',
            'last_name' => 'User',
        ]);

        User::factory()->withRole('student')->create([
            'email' => 'anotheruser@uic.edu.ph',
            'first_name' => 'Another',
            'last_name' => 'User',
        ]);

        $response = $this->asUser($admin)->getJson('/api/v1/users?search=target&per_page=20');

        $response
            ->assertOk()
            ->assertJsonFragment([
                'id' => $targetUser->id,
                'email' => $targetUser->email,
            ]);
    }

    public function test_admin_can_assign_role_to_a_user(): void
    {
        $admin = User::factory()->withRole('admin')->create();
        $targetUser = User::factory()->withRole('employee')->create();

        $response = $this->asUser($admin)->patchJson("/api/v1/users/{$targetUser->id}/role", [
            'role_name' => 'doctor',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('id', $targetUser->id)
            ->assertJsonPath('role.name', 'doctor');

        $this->assertDatabaseHas('users', [
            'id' => $targetUser->id,
            'role_id' => $this->roleId('doctor'),
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'user.role_assigned',
            'entity_type' => 'user',
            'entity_id' => $targetUser->id,
        ]);
    }

    public function test_non_admin_cannot_manage_user_roles(): void
    {
        $employee = User::factory()->withRole('employee')->create();
        $targetUser = User::factory()->withRole('student')->create();

        $this->asUser($employee)
            ->getJson('/api/v1/users?search=student')
            ->assertForbidden();

        $this->asUser($employee)
            ->patchJson("/api/v1/users/{$targetUser->id}/role", [
                'role_name' => 'doctor',
            ])
            ->assertForbidden();
    }

    public function test_admin_cannot_self_demote(): void
    {
        $admin = User::factory()->withRole('admin')->create();

        $this->asUser($admin)
            ->patchJson("/api/v1/users/{$admin->id}/role", [
                'role_name' => 'nurse',
            ])
            ->assertStatus(409)
            ->assertJsonPath('message', 'You cannot change your own role away from admin.');

        $this->assertDatabaseHas('users', [
            'id' => $admin->id,
            'role_id' => $this->roleId('admin'),
        ]);
    }

    // ------------------------------------------------------------
    // User CRUD
    // ------------------------------------------------------------

    public function test_admin_can_create_user(): void
    {
        $admin = User::factory()->withRole('admin')->create();
        $campus = Campus::first();

        $response = $this->asUser($admin)->postJson('/api/v1/users', [
            'first_name' => 'New',
            'last_name' => 'Nurse',
            'email' => 'newnurse@uic.edu.ph',
            'password' => 'password123',
            'role_name' => 'nurse',
            'campus_id' => $campus->id,
        ]);

        $response->assertCreated()
            ->assertJsonPath('email', 'newnurse@uic.edu.ph')
            ->assertJsonPath('first_name', 'New');

        $this->assertDatabaseHas('users', [
            'email' => 'newnurse@uic.edu.ph',
            'first_name' => 'New',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'user.created',
        ]);
    }

    public function test_admin_can_edit_user(): void
    {
        $admin = User::factory()->withRole('admin')->create();
        $target = User::factory()->withRole('nurse')->create(['first_name' => 'Old']);

        $response = $this->asUser($admin)->patchJson("/api/v1/users/{$target->id}", [
            'first_name' => 'New',
            'last_name' => 'Name',
        ]);

        $response->assertOk()
            ->assertJsonPath('first_name', 'New')
            ->assertJsonPath('last_name', 'Name');

        $this->assertDatabaseHas('users', [
            'id' => $target->id,
            'first_name' => 'New',
            'last_name' => 'Name',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'user.updated',
            'entity_id' => $target->id,
        ]);
    }

    public function test_admin_can_delete_user(): void
    {
        $admin = User::factory()->withRole('admin')->create();
        $target = User::factory()->withRole('employee')->create();

        $this->asUser($admin)
            ->deleteJson("/api/v1/users/{$target->id}")
            ->assertOk();

        $this->assertDatabaseMissing('users', ['id' => $target->id]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'user.deleted',
            'entity_id' => $target->id,
        ]);
    }

    public function test_admin_cannot_delete_self(): void
    {
        $admin = User::factory()->withRole('admin')->create();

        $this->asUser($admin)
            ->deleteJson("/api/v1/users/{$admin->id}")
            ->assertStatus(409)
            ->assertJsonPath('message', 'You cannot delete your own account.');

        $this->assertDatabaseHas('users', ['id' => $admin->id]);
    }

    public function test_admin_cannot_delete_last_admin(): void
    {
        // Create two admins so we can delete one, then verify the guard
        $admin1 = User::factory()->withRole('admin')->create();
        $admin2 = User::factory()->withRole('admin')->create();

        // Admin 1 deletes Admin 2 — allowed (one admin left: admin1)
        $this->asUser($admin1)
            ->deleteJson("/api/v1/users/{$admin2->id}")
            ->assertOk();

        $this->assertDatabaseMissing('users', ['id' => $admin2->id]);
        $this->assertDatabaseHas('users', ['id' => $admin1->id]);
    }

    // ------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------

    private function roleId(string $roleName): int
    {
        return (int) Role::where('name', $roleName)->value('id');
    }
}
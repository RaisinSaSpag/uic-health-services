<?php

namespace Tests\Feature;

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

    private function roleId(string $roleName): int
    {
        return (int) Role::where('name', $roleName)->value('id');
    }
}

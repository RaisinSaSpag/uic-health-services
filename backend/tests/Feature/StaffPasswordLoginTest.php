<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class StaffPasswordLoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_roles_can_sign_in_with_password(): void
    {
        foreach (['employee', 'nurse', 'doctor', 'admin'] as $role) {
            $user = User::factory()->withRole($role)->create([
                'email' => $role.'@uic.edu.ph',
                'password' => Hash::make('test-password'),
            ]);

            $this->postJson('/api/v1/auth/staff/login', [
                'email' => $user->email,
                'password' => 'test-password',
            ])
                ->assertOk()
                ->assertJsonPath('user.email', $user->email)
                ->assertJsonPath('user.role', $role)
                ->assertJsonStructure(['access_token', 'expires_in', 'user']);
        }
    }

    public function test_student_cannot_sign_in_with_staff_password_endpoint(): void
    {
        $user = User::factory()->withRole('student')->create([
            'password' => Hash::make('test-password'),
        ]);

        $this->postJson('/api/v1/auth/staff/login', [
            'email' => $user->email,
            'password' => 'test-password',
        ])->assertUnauthorized();
    }

    public function test_invalid_or_inactive_staff_credentials_are_rejected(): void
    {
        $user = User::factory()->withRole('nurse')->create([
            'email' => 'nurse@uic.edu.ph',
            'password' => Hash::make('test-password'),
        ]);

        $this->postJson('/api/v1/auth/staff/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ])->assertUnauthorized();

        $user->update(['is_active' => false]);

        $this->postJson('/api/v1/auth/staff/login', [
            'email' => $user->email,
            'password' => 'test-password',
        ])->assertUnauthorized();
    }
}

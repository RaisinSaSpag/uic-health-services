<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StudentLoginTest extends TestCase
{
    use RefreshDatabase;

    protected function createUserWithRole(string $role): User
    {
        return User::factory()
            ->withRole($role)
            ->create(['is_active' => true, 'password' => bcrypt('test-password')]);
    }

    public function test_student_can_sign_in_via_student_endpoint(): void
    {
        $student = $this->createUserWithRole('student');

        $this->postJson('/api/v1/auth/student/login', [
            'email' => $student->email,
            'password' => 'test-password',
        ])->assertOk()
          ->assertJsonStructure(['access_token', 'user' => ['role']]);
    }

    public function test_employee_can_sign_in_via_student_endpoint(): void
    {
        $employee = $this->createUserWithRole('employee');

        $this->postJson('/api/v1/auth/student/login', [
            'email' => $employee->email,
            'password' => 'test-password',
        ])->assertOk();
    }

    public function test_nurse_cannot_sign_in_via_student_endpoint(): void
    {
        $nurse = $this->createUserWithRole('nurse');

        $this->postJson('/api/v1/auth/student/login', [
            'email' => $nurse->email,
            'password' => 'test-password',
        ])->assertUnauthorized();
    }

    public function test_inactive_student_is_rejected(): void
    {
        $student = $this->createUserWithRole('student');
        $student->update(['is_active' => false]);

        $this->postJson('/api/v1/auth/student/login', [
            'email' => $student->email,
            'password' => 'test-password',
        ])->assertUnauthorized();
    }

    public function test_wrong_password_is_rejected(): void
    {
        $student = $this->createUserWithRole('student');

        $this->postJson('/api/v1/auth/student/login', [
            'email' => $student->email,
            'password' => 'wrong-password',
        ])->assertUnauthorized();
    }
}

<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Socialite\Contracts\Provider;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Tests\TestCase;

class GoogleOAuthRoleInferenceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.google.allowed_domain' => 'uic.edu.ph']);
    }

    public function test_basic_education_student_email_is_assigned_student_role(): void
    {
        $email = 'jdoe_1234567890@uic.edu.ph';

        $this->mockGoogleCallback($email, 'google-basic-1', 'John Doe');

        $response = $this->getJson('/api/v1/auth/google/callback?code=test-code');

        $response
            ->assertOk()
            ->assertJsonPath('user.email', $email)
            ->assertJsonPath('user.role', 'student');

        $this->assertDatabaseHas('users', [
            'email' => $email,
            'role_id' => $this->roleId('student'),
            'campus_id' => $this->campusId('BAJADA'),
        ]);
    }

    public function test_college_student_email_is_assigned_student_role(): void
    {
        $email = 'jdoe_123456789012@uic.edu.ph';

        $this->mockGoogleCallback($email, 'google-college-1', 'John Doe');

        $response = $this->getJson('/api/v1/auth/google/callback?code=test-code');

        $response
            ->assertOk()
            ->assertJsonPath('user.email', $email)
            ->assertJsonPath('user.role', 'student');

        $this->assertDatabaseHas('users', [
            'email' => $email,
            'role_id' => $this->roleId('student'),
            'campus_id' => $this->campusId('FATHER_SELGA'),
        ]);
    }

    public function test_non_student_email_cannot_be_provisioned_through_google(): void
    {
        $email = 'jdoe@uic.edu.ph';

        $this->mockGoogleCallback($email, 'google-employee-1', 'John Doe');

        $response = $this->getJson('/api/v1/auth/google/callback?code=test-code');

        $response
            ->assertForbidden()
            ->assertJsonPath('message', 'Only student accounts can use Google sign-in.');

        $this->assertDatabaseMissing('users', ['email' => $email]);
    }

    public function test_existing_staff_user_cannot_use_google_sign_in(): void
    {
        $email = 'jdoe@uic.edu.ph';

        $existingUser = User::factory()->withRole('nurse')->create([
            'email' => $email,
            'google_sub' => 'old-google-sub',
            'first_name' => 'Old',
            'last_name' => 'Name',
        ]);

        $this->mockGoogleCallback($email, 'new-google-sub', 'John Doe');

        $response = $this->getJson('/api/v1/auth/google/callback?code=test-code');

        $response
            ->assertForbidden()
            ->assertJsonPath('message', 'Only student accounts can use Google sign-in.');

        $existingUser->refresh();

        $this->assertSame($this->roleId('nurse'), $existingUser->role_id);
        $this->assertSame('old-google-sub', $existingUser->google_sub);
        $this->assertSame('Old', $existingUser->first_name);
        $this->assertSame('Name', $existingUser->last_name);
    }

    public function test_browser_callback_redirects_to_frontend_callback_with_token(): void
    {
        config(['services.frontend_url' => 'http://localhost:5173']);
        $this->mockGoogleCallback('jdoe_1234567890@uic.edu.ph', 'google-basic-2', 'John Doe');

        $response = $this->get('/api/v1/auth/google/callback?code=test-code');

        $response->assertRedirect();

        $location = $response->headers->get('Location');
        $this->assertIsString($location);

        $redirect = parse_url($location);
        $this->assertIsArray($redirect);
        $this->assertSame(
            'http://localhost:5173/auth/callback',
            ($redirect['scheme'] ?? '').'://'.($redirect['host'] ?? '').':'.($redirect['port'] ?? '').($redirect['path'] ?? '')
        );

        parse_str($redirect['query'] ?? '', $query);
        $this->assertNotEmpty($query['token'] ?? null);
    }

    public function test_unrecognized_email_format_is_rejected_for_new_user(): void
    {
        $email = 'john.doe@uic.edu.ph';

        $this->mockGoogleCallback($email, 'google-invalid-1', 'John Doe');

        $response = $this->getJson('/api/v1/auth/google/callback?code=test-code');

        $response
            ->assertForbidden()
            ->assertJsonPath('message', 'Only student accounts can use Google sign-in.');

        $this->assertDatabaseMissing('users', ['email' => $email]);
    }

    private function roleId(string $roleName): int
    {
        return (int) Role::where('name', $roleName)->value('id');
    }

    private function campusId(string $campusCode): int
    {
        return (int) Campus::where('code', $campusCode)->value('id');
    }

    private function mockGoogleCallback(string $email, string $googleSub, string $displayName): void
    {
        $googleUser = new SocialiteUser;

        $googleUser->setRaw([
            'sub' => $googleSub,
            'given_name' => 'John',
            'family_name' => 'Doe',
        ]);

        $googleUser->map([
            'id' => $googleSub,
            'name' => $displayName,
            'email' => $email,
        ]);

        $provider = \Mockery::mock(Provider::class);
        $provider->shouldReceive('stateless')->once()->andReturnSelf();
        $provider->shouldReceive('user')->once()->andReturn($googleUser);

        Socialite::shouldReceive('driver')->once()->with('google')->andReturn($provider);
    }
}

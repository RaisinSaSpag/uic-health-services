<?php

namespace App\Services\Auth;

use App\Models\Campus;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Str;
use Laravel\Socialite\Contracts\User as SocialiteUser;
use Laravel\Socialite\Facades\Socialite;

class GoogleAuthService
{
    public function getRedirectUrl(): string
    {
        return Socialite::driver('google')
            ->stateless()
            ->scopes(['openid', 'profile', 'email'])
            ->redirect()
            ->getTargetUrl();
    }

    public function authenticateFromCallback(): User
    {
        /** @var SocialiteUser $googleUser */
        $googleUser = Socialite::driver('google')->stateless()->user();

        $email = Str::lower((string) $googleUser->getEmail());

        if ($email === '') {
            throw new AuthenticationException('Google account email is required.');
        }

        $this->ensureAllowedDomain($email);

        $user = User::where('email', $email)->first();

        if (! $user) {
            $inferredRole = $this->inferRoleFromEmail($email);

            $user = User::create([
                'role_id' => $inferredRole->id,
                'campus_id' => $this->defaultCampusForProvision($inferredRole->name, $email)->id,
                'department_id' => $this->defaultDepartmentId(),
                'google_sub' => (string) $googleUser->getId(),
                'email' => $email,
                'first_name' => $this->extractFirstName($googleUser),
                'last_name' => $this->extractLastName($googleUser),
                'is_active' => true,
                'last_login_at' => now(),
            ]);
        } else {
            if (Str::lower((string) $user->role?->name) !== 'student') {
                throw new AuthenticationException('Only student accounts can use Google sign-in.');
            }

            if (! $user->is_active) {
                throw new AuthenticationException('User account is inactive.');
            }

            $user->update([
                'google_sub' => (string) $googleUser->getId(),
                'first_name' => $this->extractFirstName($googleUser),
                'last_name' => $this->extractLastName($googleUser),
                'last_login_at' => now(),
            ]);
        }

        return $user->load(['role', 'campus', 'department']);
    }

    private function ensureAllowedDomain(string $email): void
    {
        $allowedDomain = Str::lower((string) config('services.google.allowed_domain', ''));

        if ($allowedDomain === '') {
            throw new AuthenticationException('Allowed school domain is not configured.');
        }

        $domain = Str::after($email, '@');

        if ($domain !== $allowedDomain) {
            throw new AuthenticationException('Email domain is not allowed.');
        }
    }

    private function inferRoleFromEmail(string $email): Role
    {
        $localPart = Str::before($email, '@');

        if (preg_match('/^[a-z][a-z]+_\d{10}$/', $localPart) === 1) {
            return $this->roleByName('student');
        }

        if (preg_match('/^[a-z][a-z]+_\d{12}$/', $localPart) === 1) {
            return $this->roleByName('student');
        }

        throw new AuthenticationException('Only student accounts can use Google sign-in.');
    }

    private function roleByName(string $roleName): Role
    {
        $role = Role::whereRaw('LOWER(name) = ?', [Str::lower($roleName)])->first();

        if (! $role) {
            throw new ModelNotFoundException(sprintf('Role [%s] is not configured in roles table.', $roleName));
        }

        return $role;
    }

    private function defaultRole(): Role
    {
        $defaultRoleName = (string) env('HSMS_DEFAULT_LOGIN_ROLE', 'student');

        return $this->roleByName($defaultRoleName);
    }

    private function defaultCampusForProvision(string $roleName, string $email): Campus
    {
        if (Str::lower($roleName) !== 'student') {
            return $this->defaultCampus();
        }

        $studentCampusCode = $this->inferStudentDefaultCampusCodeFromEmail($email);

        if ($studentCampusCode === null) {
            return $this->defaultCampus();
        }

        $campus = Campus::where('code', $studentCampusCode)->first();

        return $campus ?? $this->defaultCampus();
    }

    private function inferStudentDefaultCampusCodeFromEmail(string $email): ?string
    {
        $localPart = Str::before(Str::lower($email), '@');

        if (preg_match('/^[a-z][a-z]+_\d{10}$/', $localPart) === 1) {
            return 'BAJADA_GS';
        }

        if (preg_match('/^[a-z][a-z]+_\d{12}$/', $localPart) === 1) {
            return 'FATHER_SELGA';
        }

        return null;
    }

    private function defaultCampus(): Campus
    {
        $defaultCampusCode = (string) env('HSMS_DEFAULT_CAMPUS_CODE', '');

        if ($defaultCampusCode !== '') {
            $campus = Campus::where('code', $defaultCampusCode)->first();

            if ($campus) {
                return $campus;
            }
        }

        $campus = Campus::query()->orderBy('id')->first();

        if (! $campus) {
            throw new ModelNotFoundException('No campus record found. Seed a campus first.');
        }

        return $campus;
    }

    private function defaultDepartmentId(): ?int
    {
        $defaultDepartmentCode = (string) env('HSMS_DEFAULT_DEPARTMENT_CODE', '');

        if ($defaultDepartmentCode === '') {
            return null;
        }

        return Department::where('code', $defaultDepartmentCode)->value('id');
    }

    private function extractFirstName(SocialiteUser $googleUser): string
    {
        $raw = $googleUser->user;

        if (is_array($raw) && isset($raw['given_name']) && $raw['given_name'] !== '') {
            return (string) $raw['given_name'];
        }

        $fullName = trim((string) $googleUser->getName());

        if ($fullName === '') {
            return 'User';
        }

        return (string) Str::of($fullName)->before(' ');
    }

    private function extractLastName(SocialiteUser $googleUser): string
    {
        $raw = $googleUser->user;

        if (is_array($raw) && isset($raw['family_name']) && $raw['family_name'] !== '') {
            return (string) $raw['family_name'];
        }

        $fullName = trim((string) $googleUser->getName());

        if ($fullName === '') {
            return 'User';
        }

        if (! str_contains($fullName, ' ')) {
            return 'User';
        }

        return (string) Str::of($fullName)->after(' ');
    }
}

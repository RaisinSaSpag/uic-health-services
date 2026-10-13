# HSMS Phase 3 Authentication

This document captures the Phase 3 authentication implementation for HSMS.

## Scope Implemented

- Google OAuth login flow (backend callback handling)
- School email domain restriction
- Student role assignment on first Google login
- Password sign-in for employee and clinic staff accounts
- JWT issuance for API authentication
- JWT middleware for protected endpoints

## Installed Packages

- `laravel/socialite`
- `firebase/php-jwt`

## Environment Variables

Add and configure these values in `backend/.env`:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (default: `http://localhost:8000/api/v1/auth/google/callback`)
- `HSMS_GOOGLE_ALLOWED_DOMAIN` (example: `school.edu`)
- `HSMS_DEFAULT_LOGIN_ROLE` (default: `student`)
- `HSMS_DEFAULT_CAMPUS_CODE` (default: `MAIN`)
- `HSMS_DEFAULT_DEPARTMENT_CODE` (optional)
- `JWT_SECRET` (optional, `APP_KEY` is used if empty)
- `JWT_TTL_MINUTES` (default: `60`)

## Auth API Endpoints

Prefix: `/api/v1/auth`

1. `GET /google/redirect`
- Returns the Google OAuth redirect URL.

2. `GET /google/callback`
- Handles Google callback.
- Validates allowed domain.
- Creates or updates local user.
- Returns JWT token payload.

3. `GET /me`
- Requires JWT (`Authorization: Bearer <token>`).
- Returns current authenticated user profile.

4. `POST /staff/login`
- Accepts `email` and `password` for employee, nurse, doctor, and admin users.
- Passwords are stored as hashes; inactive accounts and student accounts are rejected.
- Requests are rate-limited.

## Token Response Shape

`GET /api/v1/auth/google/callback` returns:

```json
{
  "token_type": "Bearer",
  "access_token": "<jwt>",
  "expires_in": 3600,
  "user": {
    "id": 1,
    "email": "user@school.edu",
    "first_name": "Juan",
    "last_name": "Dela Cruz",
    "role": "student",
    "campus": "Main Campus",
    "department": "College"
  }
}
```

## Role Assignment Logic

- If user already exists by email:
  - Google sign-in is allowed only when the existing role is `student`.
  - Updates `google_sub`, names, and `last_login_at`.
- If user does not exist:
  - Google sign-in provisions recognized student email formats only.
  - Assigns campus from `HSMS_DEFAULT_CAMPUS_CODE` (or first campus record).
  - Optionally assigns default department from `HSMS_DEFAULT_DEPARTMENT_CODE`.
- Employee, nurse, doctor, and admin accounts use `/staff/login` and must be provisioned with a password hash by a trusted administrator.

## Preconditions

Before OAuth login works, ensure base records exist:

- roles (`student`, `employee`, `nurse`, `doctor`, `admin`)
- at least one campus (example code: `MAIN`)

Run:

```bash
php artisan db:seed
```

## Notes

- JWT middleware is required before role middleware for protected routes.
- Health endpoint remains public: `GET /api/v1/health`.
- This phase is intentionally minimal and avoids complex token refresh mechanics.

# HSMS Phase 2 Backend Foundation

This document records the Phase 2 construction started in this repository.

## What Was Implemented

- Laravel API project scaffolded under `backend/`
- SQL Server-ready environment template in `.env.example`
- Core migrations created and ordered by dependency
- Core Eloquent models created with relationships
- API versioning scaffold in `/api/v1`
- Role middleware skeleton (`role`) registered in app bootstrap

## Migration Order (Enforced by Filename)

1. roles
2. campuses
3. departments
4. users
5. cache/jobs (Laravel defaults)
6. patients
7. consultations
8. referrals
9. medical_records
10. audit_logs

## Core Files

- `backend/bootstrap/app.php`
- `backend/routes/api.php`
- `backend/app/Http/Middleware/RoleMiddleware.php`
- `backend/app/Models/*.php`
- `backend/database/migrations/*.php`

## Local Setup Notes (Windows)

1. Ensure PHP extensions for your chosen DB are enabled.
2. For SQL Server:
   - Install ODBC Driver 18 for SQL Server.
   - Enable `php_sqlsrv` and `php_pdo_sqlsrv` extensions matching your PHP build.
3. Update `backend/.env` from `.env.example` with real SQL Server credentials.
4. Run migrations:
   - `php artisan migrate`

## Current Limitation Observed During Validation

The local PHP environment currently reports missing database driver support for the default sqlite connection.

This does not block code scaffolding, but database migrations require the correct DB driver extensions to be enabled first.

## Next Step

Proceed to Phase 3 Authentication:
- Google OAuth
- School domain restriction
- Role assignment on login
- JWT issuance strategy

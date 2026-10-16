# Health Services Management System (HSMS)

HSMS is a centralized on-premise web system for managing school clinic consultations across multiple campuses.

The goal is to replace manual paper-based clinic processes with a maintainable and secure digital workflow for students, employees, nurses, doctors, and administrators.

## Scope and Constraints

- Monolithic architecture (no microservices)
- Backend: Laravel API only
- Frontend: React + TypeScript
- Database: MS SQL Server
- Authentication: Google OAuth (school email domain only)
- Authorization: Role-based access control (RBAC)

## Primary Roles

- Student
- Employee
- Nurse
- Doctor
- Admin

## Core Functional Flow

1. User logs in via Google OAuth.
2. Student or employee submits a consultation request.
3. Nurse reviews and handles the consultation.
4. If referral is needed, doctor completes referral remarks and prescription.
5. Nurse finalizes medical record.
6. Reports and printable outputs are generated for clinic operations.

## Development Phases (Strict Order)

1. Planning
2. Backend Foundation
3. Authentication
4. Core Modules
5. Frontend Integration
6. Reporting and Printing
7. Testing and Hardening

## Phase 1 Deliverable

Detailed planning artifacts are documented in:

- [docs/phase-1-planning.md](docs/phase-1-planning.md)

This document contains:
- Normalized ERD and table blueprint
- Consultation and referral status transitions
- Role and permission matrix
- Reporting data mapping
- Phase exit criteria and implementation order for Phase 2

## Current Project Status

- Phase 1 planning document prepared
- Phase 2 backend foundation started in `backend/`
- Phase 3 authentication module started in `backend/`
- Phase 4 core modules started in `backend/`
- Phase 5 frontend integration started in `frontend/`
- Phase 6 reporting and printing completed (`frontend/` + `backend/`)

## Phase 2 Implementation Snapshot

Implemented in `backend/`:
- Laravel API project scaffold
- SQL Server-ready database configuration template
- Core HSMS migrations for roles, campuses, departments, users, patients, consultations, referrals, medical_records, and audit_logs
- Eloquent models with key relationships
- Versioned API route scaffold (`/api/v1/...`)
- RBAC middleware alias (`role`)

Key references:
- [backend/routes/api.php](backend/routes/api.php)
- [backend/app/Http/Middleware/RoleMiddleware.php](backend/app/Http/Middleware/RoleMiddleware.php)
- [backend/database/migrations](backend/database/migrations)
- [docs/phase-2-backend-foundation.md](docs/phase-2-backend-foundation.md)

## Phase 3 Implementation Snapshot

Implemented in `backend/`:
- Google OAuth endpoint flow via Socialite
- School-domain restriction for login
- JWT issuance after OAuth callback
- JWT middleware for protected API routes
- Auth endpoints: redirect URL, callback, and current user profile (`/api/v1/auth/me`)

Key references:
- [backend/app/Http/Controllers/Api/V1/AuthController.php](backend/app/Http/Controllers/Api/V1/AuthController.php)
- [backend/app/Http/Middleware/JwtAuthMiddleware.php](backend/app/Http/Middleware/JwtAuthMiddleware.php)
- [backend/app/Services/Auth/GoogleAuthService.php](backend/app/Services/Auth/GoogleAuthService.php)
- [backend/app/Services/Auth/JwtService.php](backend/app/Services/Auth/JwtService.php)
- [docs/phase-3-authentication.md](docs/phase-3-authentication.md)

## Phase 4 Implementation Snapshot

Implemented in `backend/`:
- Patient self-registration and own-profile endpoint
- Consultation submission and nurse workflow actions
- Referral creation and doctor completion workflow
- Medical record finalization in consultation completion
- Audit log listing endpoint for admins

Service layer additions:
- `App\\Services\\Clinic\\PatientService`
- `App\\Services\\Clinic\\ConsultationService`
- `App\\Services\\Clinic\\ReferralService`
- `App\\Services\\Clinic\\AuditLogService`

Key references:
- [backend/app/Http/Controllers/Api/V1/PatientController.php](backend/app/Http/Controllers/Api/V1/PatientController.php)
- [backend/app/Http/Controllers/Api/V1/ConsultationController.php](backend/app/Http/Controllers/Api/V1/ConsultationController.php)
- [backend/app/Http/Controllers/Api/V1/ReferralController.php](backend/app/Http/Controllers/Api/V1/ReferralController.php)
- [backend/app/Http/Controllers/Api/V1/AuditLogController.php](backend/app/Http/Controllers/Api/V1/AuditLogController.php)
- [backend/routes/api.php](backend/routes/api.php)
- [docs/phase-4-core-modules.md](docs/phase-4-core-modules.md)

## Phase 5 Implementation Snapshot

Implemented in `frontend/`:
- React + TypeScript app shell with protected routing
- Google OAuth callback handling with JWT session storage
- Role-aware route access for student/employee, nurse, doctor, and admin
- Patient portal for profile registration, consultation submission, and consultation history
- Nurse queue workflow actions and referral creation form
- Doctor referral queue workflow actions
- Admin audit log list with basic filters and pagination

Key references:
- [frontend/src/App.tsx](frontend/src/App.tsx)
- [frontend/src/context/AuthContext.tsx](frontend/src/context/AuthContext.tsx)
- [frontend/src/pages/PatientPortalPage.tsx](frontend/src/pages/PatientPortalPage.tsx)
- [frontend/src/pages/NurseQueuePage.tsx](frontend/src/pages/NurseQueuePage.tsx)
- [frontend/src/pages/DoctorReferralsPage.tsx](frontend/src/pages/DoctorReferralsPage.tsx)
- [frontend/src/pages/AdminAuditPage.tsx](frontend/src/pages/AdminAuditPage.tsx)
- [frontend/README.md](frontend/README.md)
- [docs/phase-5-frontend-integration.md](docs/phase-5-frontend-integration.md)

## Phase 6 Implementation Snapshot

Implemented in `frontend/` and `backend/`:
- Monthly reporting dashboard for nurse users
- Diagnosis aggregation and grouped disease visualizations
- Patient volume aggregation by category and subgroup breakdowns
- Print-ready prescription page (nurse workflow)
- Print-ready monthly report output
- AI summary generation endpoint integration for reports with graceful fallback

Key references:
- [frontend/src/pages/NurseReportsPage.tsx](frontend/src/pages/NurseReportsPage.tsx)
- [frontend/src/pages/NursePrintPrescriptionPage.tsx](frontend/src/pages/NursePrintPrescriptionPage.tsx)
- [frontend/src/App.tsx](frontend/src/App.tsx)
- [backend/routes/api.php](backend/routes/api.php)
- [backend/app/Http/Controllers/Api/V1/ReportController.php](backend/app/Http/Controllers/Api/V1/ReportController.php)
- [backend/app/Services/Reports/ReportSummaryService.php](backend/app/Services/Reports/ReportSummaryService.php)
- [docs/phase-6-reporting-printing.md](docs/phase-6-reporting-printing.md)
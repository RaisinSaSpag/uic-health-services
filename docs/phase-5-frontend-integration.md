# HSMS Phase 5 Frontend Integration

This document captures the Phase 5 frontend integration baseline implemented in `frontend/`.

## Implemented Screens

- Login screen with student-only Google OAuth and staff email/password sign-in
- OAuth callback screen that exchanges `code` via backend callback endpoint
- Patient portal screen for:
  - patient self-registration
  - consultation submission
  - consultation history view
- Nurse queue screen for:
  - consultation start
  - consultation triage
  - consultation complete
  - consultation cancel
  - referral creation
- Doctor referral screen for:
  - referral in_progress
  - referral complete
- Admin audit log screen with filter fields and pagination controls

## Route Access Matrix

- `/patient` -> `student`, `employee`
- `/nurse` -> `nurse`, `admin`
- `/doctor` -> `doctor`, `admin`
- `/admin` -> `admin`

## Frontend Technical Notes

- Axios client uses `VITE_API_BASE_URL` (default `/api/v1`).
- Vite dev server proxy uses `VITE_DEV_PROXY_TARGET` (default `http://localhost:8000`).
- JWT token and minimal user profile are stored in `localStorage`.
- Auth context attempts `/auth/me` on app boot when token is present.

## Local OAuth Setup Reminder

To make SPA callback work in local development, configure backend:

- `GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback`

The frontend callback route then calls backend endpoint:

- `GET /api/v1/auth/google/callback?code=...`

## Out of Scope in This Baseline

- Doctor directory lookup endpoint integration (nurse currently inputs doctor ID manually)

## Phase 6 Follow-up Status

Phase 6 items previously marked out of scope for this baseline are now implemented in:

- [docs/phase-6-reporting-printing.md](docs/phase-6-reporting-printing.md)

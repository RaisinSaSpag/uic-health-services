# HSMS Frontend (Phase 5)

React + TypeScript frontend for the Health Services Management System.

## Implemented Scope

- JWT-aware auth state with Google OAuth callback handling
- Student Google OAuth and employee/staff email-password sign-in
- Role-gated routing
- Patient portal screen (self-registration, consultation submission, consultation history)
- Nurse queue screen (start, triage, complete, cancel, create referral)
- Doctor referral screen (in progress and complete workflow)
- Admin audit log screen with filters

## Prerequisites

- Node.js 20+
- Backend API running (default: http://localhost:8000)

## Local Setup

1. Copy `.env.example` to `.env`.
2. Keep `VITE_API_BASE_URL=/api/v1` and `VITE_DEV_PROXY_TARGET=http://localhost:8000` for standard local proxy setup.
3. Configure backend OAuth callback for SPA flow:
   - `backend/.env` -> `GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback`
   - If Google redirects to the backend callback instead, set `FRONTEND_URL=http://localhost:5173` in `backend/.env`.
4. Install dependencies:

```bash
npm install
```

5. Start development server:

```bash
npm run dev
```

6. Build for production validation:

```bash
npm run build
```

## Role Routes

- `/patient` -> student, employee
- `/nurse` -> nurse, admin
- `/doctor` -> doctor, admin
- `/admin` -> admin

## Notes

- The nurse referral creation UI currently needs doctor user ID input because no doctor lookup endpoint exists yet.
- Backend authorization remains the source of truth even if the frontend hides actions.

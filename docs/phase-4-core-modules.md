# HSMS Phase 4 Core Modules

This document records the Phase 4 implementation for HSMS backend core workflows.

## Implemented Modules

- Patient self-registration for student and employee users
- Consultation submission and nurse workflow actions
- Referral creation and doctor completion workflow
- Medical record finalization by nurse
- Audit logging for sensitive workflow actions

## Key Endpoints

Public auth flow from Phase 3 remains unchanged.

Protected endpoints (JWT + role checks):

- `POST /api/v1/patients` (student, employee)
- `GET /api/v1/patients/me` (student, employee)
- `GET /api/v1/patients` (nurse, admin)
- `GET /api/v1/patients/{patient}` (nurse, admin)

- `POST /api/v1/consultations` (student, employee)
- `GET /api/v1/consultations` (student, employee, nurse, doctor, admin)
- `GET /api/v1/consultations/{consultation}` (student, employee, nurse, doctor, admin)
- `PATCH /api/v1/consultations/{consultation}` (nurse, admin)

- `POST /api/v1/referrals` (nurse, admin)
- `GET /api/v1/referrals` (nurse, doctor, admin)
- `GET /api/v1/referrals/{referral}` (nurse, doctor, admin)
- `PATCH /api/v1/referrals/{referral}` (nurse, doctor, admin)

- `GET /api/v1/audit-logs` (admin)

## Consultation Actions (PATCH /consultations/{id})

Payload includes `action`:

- `start`
- `triage` (requires `referred_to_doctor`)
- `complete` (requires `summary`, `final_diagnosis`, `treatment_plan`)
- `cancel`

## Referral Actions (PATCH /referrals/{id})

Payload includes `action`:

- `in_progress`
- `complete` (requires `doctor_remarks`, `prescription`)

## Status Flow Implemented

Consultation statuses:

- `pending_consultation`
- `nurse_assessment`
- `referred_to_doctor`
- `nurse_finalization`
- `completed`
- `cancelled`

Referral statuses:

- `pending_doctor`
- `in_progress`
- `completed`

## Service Layer

Business logic is placed in services to keep controllers thin:

- `App\Services\Clinic\PatientService`
- `App\Services\Clinic\ConsultationService`
- `App\Services\Clinic\ReferralService`
- `App\Services\Clinic\AuditLogService`

## Audit Events Captured

Examples of logged actions:

- `patient.registered`
- `consultation.submitted`
- `consultation.started`
- `consultation.triaged`
- `consultation.completed`
- `consultation.cancelled`
- `referral.created`
- `referral.in_progress`
- `referral.completed`
- `medical_record.finalized`

## Validation Notes

The Phase 4 workflow was smoke-tested end-to-end on SQL Server:

1. Student registers patient profile
2. Student submits consultation
3. Nurse starts and triages consultation (doctor referral path)
4. Nurse creates referral
5. Doctor marks referral in progress, then completed
6. Nurse finalizes consultation and medical record
7. Admin can read audit logs

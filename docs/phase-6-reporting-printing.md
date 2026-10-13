# HSMS Phase 6 Reporting and Printing

This document records the Phase 6 implementation for reporting and print workflows.

## Implemented Features

- Monthly reports page for nurse/admin users
- Monthly diagnosis aggregation and grouped disease charts
- Patient-count aggregation by category (basic education, college, employees)
- Subgroup breakdown views (grade level, course/program, office/unit)
- Printable prescription page
- Printable monthly report output
- AI narrative summary endpoint integration with fallback behavior

## Monthly Graphs

Implemented in nurse reports UI:

- Top diseases by group:
  - Basic Education
  - College
  - Employees
- Patients consulted this month bar chart

Frontend reference:

- [frontend/src/pages/NurseReportsPage.tsx](../frontend/src/pages/NurseReportsPage.tsx)

## Disease Aggregation

Aggregation logic includes:

- Normalized diagnosis counting
- Top diseases overall and per patient group
- Dominant subgroup context labels

Frontend reference:

- [frontend/src/pages/NurseReportsPage.tsx](../frontend/src/pages/NurseReportsPage.tsx)

## Printable Prescriptions

Implemented nurse print page with print-preview-safe behavior:

- Dedicated route and page for prescriptions
- Browser print flow (`window.print`) and print-specific layout handling

Frontend references:

- [frontend/src/pages/NursePrintPrescriptionPage.tsx](../frontend/src/pages/NursePrintPrescriptionPage.tsx)
- [frontend/src/App.tsx](../frontend/src/App.tsx)

## Printable Reports

Implemented report print flow:

- Print action from reports screen
- Print-friendly chart and report styles

Frontend references:

- [frontend/src/pages/NurseReportsPage.tsx](../frontend/src/pages/NurseReportsPage.tsx)
- [frontend/src/index.css](../frontend/src/index.css)

## Backend Reporting Endpoint (AI Summary)

Implemented endpoint:

- `POST /api/v1/reports/ai-summary` (roles: nurse, admin)

Behavior:

- Accepts structured report aggregates
- Generates summary via OpenAI when configured
- Returns deterministic fallback summary on missing key/error/quota issues

Backend references:

- [backend/routes/api.php](../backend/routes/api.php)
- [backend/app/Http/Controllers/Api/V1/ReportController.php](../backend/app/Http/Controllers/Api/V1/ReportController.php)
- [backend/app/Services/Reports/ReportSummaryService.php](../backend/app/Services/Reports/ReportSummaryService.php)
- [backend/config/services.php](../backend/config/services.php)

## Phase 6 Exit Criteria Status

- Monthly graphs: complete
- Disease aggregation: complete
- Printable prescriptions: complete
- Printable reports: complete

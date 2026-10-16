
## Development Workflow

### Starting the app

Terminal 1 (backend):
```powershell
cd backend
php artisan serve
```

Terminal 2 (frontend):
```powershell
cd frontend
npm run dev -- --strictPort
```

Open `http://localhost:5173`.

### Building the frontend for production

```powershell
cd frontend
npm run build
```

Output goes to `frontend/dist/`.

### Running a specific seeder

```powershell
cd backend
php artisan db:seed --class=MedicineSeeder
```

### Rebuilding the database from scratch

```powershell
cd backend
php artisan migrate:fresh --seed
```

**Warning:** this **wipes all data**. Useful for testing a clean install.

### Checking routes

```powershell
cd backend
php artisan route:list --path=api/v1
```

### Syntax check a PHP file

```powershell
cd backend
php -l app\Http\Controllers\Api\V1\UserController.php
```

### Common gotchas

- **Port 5173 must be free.** If it's in use, kill stale Node processes:
  ```powershell
  Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
  ```
- **JWT tokens expire after 30 minutes** by default. Log out and back in if you get `401 Unauthorized`.
- **After `migrate:fresh`, browser sessions are stale.** Clear Local Storage or use Incognito when testing.

---

## API Overview

All routes are versioned at `/api/v1` and require JWT auth except login/callback.

### Public routes

```
GET  /api/v1/health
GET  /api/v1/auth/google/redirect
GET  /api/v1/auth/google/callback
POST /api/v1/auth/staff/login
```

### Authenticated routes (sample)

```
GET    /api/v1/auth/me

GET    /api/v1/patients
GET    /api/v1/patients/{id}
GET    /api/v1/consultations
POST   /api/v1/consultations
PATCH  /api/v1/consultations/{id}

GET    /api/v1/referrals
POST   /api/v1/referrals
PATCH  /api/v1/referrals/{id}

GET    /api/v1/medicines
POST   /api/v1/medicines
GET    /api/v1/medicines/stock-out

GET    /api/v1/inventory/available
GET    /api/v1/inventory/low-stock
GET    /api/v1/inventory/expiring-soon
POST   /api/v1/inventory/stock-in
POST   /api/v1/inventory/dispense
POST   /api/v1/inventory/archive
GET    /api/v1/inventory/archived
POST   /api/v1/inventory/archived/{id}/restore
DELETE /api/v1/inventory/archived/{id}

GET    /api/v1/branch-requests
POST   /api/v1/branch-requests
PATCH  /api/v1/branch-requests/{id}/approve
PATCH  /api/v1/branch-requests/{id}/reject
PATCH  /api/v1/branch-requests/{id}/complete

GET    /api/v1/messages/contacts
GET    /api/v1/messages/thread/{user}
POST   /api/v1/messages
POST   /api/v1/messages/read/{user}

GET    /api/v1/notifications
GET    /api/v1/notifications/unread-count
POST   /api/v1/notifications/mark-read

GET    /api/v1/users
POST   /api/v1/users
PATCH  /api/v1/users/{user}
DELETE /api/v1/users/{user}
PATCH  /api/v1/users/{user}/role

GET    /api/v1/audit-logs
GET    /api/v1/history-log
```

Full list: `php artisan route:list --path=api/v1`

---

## Database Schema Notes

### Key tables

| Table | Purpose |
|-------|---------|
| `users` | All accounts (students, employees, nurses, doctors, coordinators, admins) |
| `roles` | Role definitions |
| `campuses` | Six UIC campuses |
| `departments` | Academic/administrative departments |
| `patients` | Patient profiles linked to users |
| `consultations` | Consultation records |
| `referrals` | Doctor referrals from consultations |
| `medical_records` | Finalized consultation summaries |
| `medicines` | Master medicine list |
| `medicine_stock_in` | Batches of stock received per campus |
| `medicine_stock_out` | Dispense records |
| `medicine_archived` | Archived (removed) stock |
| `branch_requests` | Cross-campus medicine requests |
| `prescriptions` | Prescriptions written by doctors |
| `messages` | Chat messages |
| `notification_reads` | Per-user read tracking for notifications |
| `audit_logs` | System-wide audit trail |

### Naming conventions

- **Primary keys:** `id` (Laravel default)
- **Foreign keys:** `{singular}_id` — e.g. `campus_id`, `medicine_id`, `user_id`
- **Timestamps:** `created_at`, `updated_at`
- **Status enums:** stored as strings (e.g. `pending_doctor`, `in_progress`, `completed`)

### User schema note

`users.google_sub` (Google OAuth subject ID) is **nullable**. Staff-created users do not have one. Google OAuth users always do.

---

## Deployment Notes

### Production checklist

- [ ] Set `APP_ENV=production`, `APP_DEBUG=false`
- [ ] Generate fresh `APP_KEY` and `JWT_SECRET`
- [ ] Configure production MS SQL connection in `.env`
- [ ] Set `GOOGLE_REDIRECT_URI` to the production URL
- [ ] Update `FRONTEND_URL` and `CORS_ALLOWED_ORIGINS` to the production frontend URL
- [ ] Build the frontend: `npm run build`
- [ ] Serve `frontend/dist/` via a web server (Nginx, Apache)
- [ ] Run `php artisan config:cache` and `php artisan route:cache`
- [ ] Ensure `storage/` and `bootstrap/cache/` are writable
- [ ] Enable HTTPS

### Recommended architecture

- Backend and frontend served from the same domain, or
- Backend at `api.example.edu.ph`, frontend at `example.edu.ph` with proper CORS

---

## Known Limitations and Remaining Work

### Completed
- Full inventory management (stock-in, dispense, archive, restore, cross-campus)
- Branch requests with approve/reject/complete workflow
- Real dispensed-medicines report with month/year filtering
- Chat (cross-campus, group by campus, unread badges)
- Notifications (backend + bell dropdown + hub page)
- Admin user CRUD including field editing
- Print prescription + print inventory report (two tabs)
- MS SQL compatibility (driver-agnostic SQL)
- MedicineSeeder for fresh installs

### Remaining polish
- **Duplicate migrations** — three identical `make_google_sub_nullable` migrations exist.
- **Sidebar duplication** — 12 pages each render their own sidebar inline.
- **Frontend bundle size** — ~615 KB minified.
- **`.bak` files** — many timestamped `.bak` files exist in `frontend/src/pages/`.

### Optional future enhancements
- Automated tests (currently none)
- WebSocket-based chat for real-time delivery (currently 8-second polling)
- Attachment support in chat
- Inventory report export to PDF/Excel

---

## History

This system is the result of merging two UIC student projects:

1. **HSMS** — the original Health Services Management System (System A)
2. **HIMS** — the Health Inventory Management System (System B)

The merge used System A's split SPA + REST API architecture as the base, and ported System B's inventory features as new modules.

- Original System A README: [docs/original-hsms-readme.md](docs/original-hsms-readme.md)
- Phase-by-phase development docs: [docs/](docs/)

---

## License

Internal UIC project. Not for public distribution.
# HSMS Security Hardening Checklist

Use this checklist before staging/production deployment.

## 1) Secret Rotation (Highest Priority)

Rotate these values immediately if they were ever exposed outside your secure host:

- `DB_PASSWORD`
- `GOOGLE_CLIENT_SECRET`
- `OPENAI_API_KEY`
- `JWT_SECRET`
- `APP_KEY`

After rotating:

1. Update deployment secret store / host environment.
2. Restart backend service.
3. Invalidate existing sessions/tokens (recommended for JWT secret changes).
4. Re-test login, reports, and DB connectivity.

## 2) Environment Lockdown

Set these in production:

- `APP_ENV=production`
- `APP_DEBUG=false`
- `CORS_ALLOWED_ORIGINS=https://your-frontend.example.com`
- `LOG_LEVEL=warning` (or stricter)
- `DB_ENCRYPT=yes`
- `DB_TRUST_SERVER_CERTIFICATE=false`
- `SESSION_ENCRYPT=true`
- `SESSION_SECURE_COOKIE=true`
- `SESSION_HTTP_ONLY=true`
- `SESSION_SAME_SITE=lax` (or `strict` if your flow allows)

## 3) Transport and Network

- Serve backend over HTTPS only.
- Ensure reverse proxy terminates TLS correctly.
- Restrict database network access to backend host only.
- Restrict outbound API keys to required services/domains.

## 4) Access and Audit Controls

- Keep role assignment endpoint admin-only (already enforced).
- Review admin accounts and disable unused users.
- Periodically export and review audit logs for role changes and sensitive actions.

## 5) Operational Verification

After deployment changes, verify:

1. Auth endpoints return expected rate-limit headers.
2. Role-restricted APIs return `403` for unauthorized roles.
3. Sensitive endpoints still function with new secrets.
4. Security headers exist in API responses:
   - `X-Frame-Options`
   - `X-Content-Type-Options`
   - `Referrer-Policy`
   - `Permissions-Policy`
   - `Cross-Origin-Opener-Policy`

## 6) Optional Next Step (When Ready)

Migrate from browser-stored bearer tokens to HttpOnly cookie auth for stronger XSS resistance.
This requires coordinated backend + frontend auth flow changes and should be tested end-to-end.

## 7) Execution-Ready Secret Rotation Sequence

Use this exact order to rotate with minimal downtime.

### A. Pre-Cutover Preparation

1. Schedule a short maintenance window.
2. Ensure you have access to:
   - SQL Server account administration
   - Google OAuth client settings
   - OpenAI key management
   - Deployment secret store/environment variables
3. Export a backup of current environment variables to a secure location.

### B. Generate New App/JWT Secrets (Do Not Apply Yet)

From `backend/`:

PowerShell:

php artisan key:generate --show
php -r "echo bin2hex(random_bytes(64)), PHP_EOL;"

Use outputs as:
- first command -> new `APP_KEY`
- second command -> new `JWT_SECRET`

Keep these in a secure secret manager, not in chat logs or plain text files.

### C. Rotate Provider and Database Secrets

1. SQL Server:
   - Create a new strong `DB_PASSWORD` for the app SQL login.
2. Google OAuth:
   - Rotate `GOOGLE_CLIENT_SECRET` in Google Cloud Console.
3. OpenAI:
   - Create a new `OPENAI_API_KEY` and disable old key after cutover validation.

### D. Apply Secrets in Deployment Environment

Update these values in your deployment secret store/environment:

- `APP_KEY=<new app key>`
- `JWT_SECRET=<new jwt secret>`
- `DB_PASSWORD=<new db password>`
- `GOOGLE_CLIENT_SECRET=<new google secret>`
- `OPENAI_API_KEY=<new openai key>`

Confirm these non-secret hardening values remain set:

- `APP_ENV=production`
- `APP_DEBUG=false`
- `LOG_LEVEL=warning`
- `DB_ENCRYPT=yes`
- `DB_TRUST_SERVER_CERTIFICATE=false`
- `SESSION_ENCRYPT=true`
- `SESSION_SECURE_COOKIE=true`
- `SESSION_HTTP_ONLY=true`
- `SESSION_SAME_SITE=lax`

### E. Restart and Clear Runtime Caches

From `backend/` on target host:

PowerShell:

php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan optimize:clear

Then restart PHP-FPM/IIS/Apache/Nginx worker for the backend.

### F. Invalidate Existing Tokens

Because `JWT_SECRET` changed, all previous JWTs should be considered invalid.

Recommended actions:
1. Force re-login for all users.
2. Announce session reset to users during the maintenance window.

### G. Post-Cutover Verification (5-10 Minutes)

Quick automation (from `backend/`):

PowerShell:

./scripts/post-rotation-smoke-check.ps1

If execution policy blocks scripts, run:

powershell -ExecutionPolicy Bypass -File .\scripts\post-rotation-smoke-check.ps1

If you want authenticated check for `GET /api/v1/auth/me`, provide token:

$env:HSMS_BEARER_TOKEN = '<token>'
./scripts/post-rotation-smoke-check.ps1

Role authorization matrix check (requires per-role tokens):

$env:HSMS_TOKEN_STUDENT = '<student-token>'
$env:HSMS_TOKEN_EMPLOYEE = '<employee-token>'
$env:HSMS_TOKEN_NURSE = '<nurse-token>'
$env:HSMS_TOKEN_DOCTOR = '<doctor-token>'
$env:HSMS_TOKEN_ADMIN = '<admin-token>'
./scripts/role-access-matrix-check.ps1

1. API health:
   - `GET /api/v1/health` returns `200`.
2. OAuth login:
   - Login succeeds and returns a fresh token.
3. DB connectivity:
   - patient/consultation/referral reads and writes succeed.
4. AI summary endpoint:
   - returns valid response (or expected quota/auth error, not server misconfiguration).
5. Security headers:
   - `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` present.
6. Rate limits:
   - auth and ai-summary endpoints still return expected limit headers and `429` on burst.

### H. Revoke Old Secrets

Only after successful verification:

1. Disable old OpenAI key.
2. Disable old Google client secret.
3. Remove any archived copies of old `.env` values from shared locations.

### I. Record Audit Sign-Off

After successful cutover and revocation, complete:

- `docs/security-rotation-signoff-template.md`

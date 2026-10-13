# HSMS Secret Rotation Sign-Off Template

Use this template after every secret rotation event.

## 1) Rotation Event Details

- Date:
- Start Time:
- End Time:
- Environment: staging / production
- Change Owner:
- Approver:
- Ticket or Change Request ID:

## 2) Secrets Rotated

Mark each item:

- [ ] APP_KEY rotated
- [ ] JWT_SECRET rotated
- [ ] DB_PASSWORD rotated
- [ ] GOOGLE_CLIENT_SECRET rotated
- [ ] OPENAI_API_KEY rotated

Notes:

## 3) Deployment and Runtime Actions

- [ ] Secret store/environment variables updated
- [ ] Backend runtime restarted
- [ ] Laravel caches cleared (`config`, `route`, `cache`, `optimize`)
- [ ] Old sessions/tokens invalidated

Notes:

## 4) Verification Results

- [ ] `GET /api/v1/health` returned 200
- [ ] Security headers present in API responses
- [ ] OAuth login flow successful
- [ ] Protected endpoint access validated
- [ ] DB read/write workflow validated
- [ ] AI summary endpoint validated
- [ ] Rate-limit behavior (`429`) validated

Verification command/script used:

- [ ] `scripts/post-rotation-smoke-check.ps1`
- [ ] Additional manual checks completed

Notes:

## 5) Revocation and Cleanup

- [ ] Old OpenAI key disabled
- [ ] Old Google OAuth client secret disabled
- [ ] Old DB credentials removed/disabled
- [ ] Temporary bearer token env vars cleared from terminals
- [ ] Old secret exports removed from shared locations

Notes:

## 6) Risk Acceptance or Follow-Up

- Remaining risks:
- Required follow-up actions:
- Follow-up owner:
- Follow-up due date:

## 7) Final Sign-Off

- Rotation Completed: Yes / No
- Change Owner Signature:
- Approver Signature:
- Sign-Off Date:

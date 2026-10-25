# Mintline integrated E2E verification report

- Overall status: PASSED
- Started at UTC: 2026-10-25T17:12:20.010Z
- Frontend: production Vite build served at http://127.0.0.1:4173
- Backend: FastAPI main checkout at http://127.0.0.1:8000
- Database: ephemeral PostgreSQL; direct verification via psql
- Data: synthetic test-only users; no production database connection
- Browser: Playwright Chromium
- API mocking: none; observed browser responses come from the live FastAPI process

## Browser/API assertions

| Status | Assertion | Evidence |
| --- | --- | --- |
| PASSED | PostgreSQL schema contains authentication fields and revocable sessions | password hash column and auth_sessions table exist |
| PASSED | Public homepage renders |  |
| PASSED | Opening the dashboard calls live health and account endpoints | Account registered; hashed session persisted; authenticated balance read = 120 |
| PASSED | Adding 25 credits updates the UI and the actual database row | POST /api/credits/1/add = 200; UI and direct SQL both report 145 |
| PASSED | Reloading re-reads the persisted account balance | Browser reload reads 145 through the backend; privileged key is not persisted |
| PASSED | Deducting 40 credits updates the UI and the actual database row | POST /api/credits/1/deduct = 200; UI and direct SQL both report 105 |
| PASSED | Resetting sends PATCH and persists zero | PATCH /api/credits/1/reset = 200; UI and direct SQL both report 0 |
| PASSED | Backend rejects a zero-amount add without changing the database | POST amount=0 = 422; balance remains 0 |
| PASSED | Backend rejects over-deduction even on direct API calls | POST deduct from zero = 400 Insufficient credits; balance remains 0 |
| PASSED | Credit endpoints reject unauthenticated reads and writes | Read and write attempts without a bearer session return 401; balance is unchanged |
| PASSED | A signed-in user still needs the administrator key to mutate credits | A valid session alone and a wrong administrator key cannot modify credit balances |
| PASSED | An authenticated account cannot access another user's balance | A different existing user's account is concealed with HTTP 404 |
| PASSED | Invalid passwords and duplicate registrations are rejected | Incorrect credentials return 401; duplicate email cannot create a second account |
| PASSED | Missing user shows the real backend 404 in the frontend | GET /api/credits/999999 = 404; visible account-not-found message |
| PASSED | Admin screen displays the real 401 from an incorrect API key | GET /api/schema/migrations with bad key = 401 |
| PASSED | Correct admin key loads migration history from PostgreSQL | GET /api/schema/migrations with correct key = 200 |
| PASSED | Browser migration submission creates an index and audit record | POST /api/schema/apply = 200; SQL confirms the index and exactly one migration record |
| PASSED | Migration API rejects destructive and multi-statement SQL | DROP TABLE and multi-statement submissions are rejected; credits table remains |
| PASSED | Repeated migration name is idempotently skipped | Second request was skipped; exactly one migration row remains |
| PASSED | Production-built dashboard and navigation work at mobile width | 390×844 viewport rendered; account was loaded through GET /api/credits/1 |
| PASSED | Logout revokes the active database session | Logout revokes the server-side session; reuse of the old token returns 401 |
| PASSED | Daily scheduler logic updates the isolated database | Scheduler adds 5 credits to existing users and seeds a missing credits row |
| PASSED | No uncaught browser JavaScript errors occurred | 0 page errors |
| PASSED | All implemented frontend API operations were observed against the real backend | 21 browser-observed HTTP responses; no API route mocks |

## Direct PostgreSQL checks

| Status | Check | Expected | Actual |
| --- | --- | --- |
| PASSED | Add operation committed to PostgreSQL | 145 | 145 |
| PASSED | Read-after-write persistence after reload | 145 | 145 |
| PASSED | Deduct operation committed to PostgreSQL | 105 | 105 |
| PASSED | Reset operation committed to PostgreSQL | 0 | 0 |
| PASSED | Invalid amount did not alter balance | 0 | 0 |
| PASSED | Over-deduction did not alter balance | 0 | 0 |
| PASSED | Unauthenticated write did not alter the balance | 0 | 0 |
| PASSED | Missing or incorrect admin key did not alter the balance | 0 | 0 |
| PASSED | Migration row is recorded in PostgreSQL | 1 | 1 |
| PASSED | Submitted index exists in PostgreSQL | true | true |
| PASSED | Scheduler increments existing and creates missing credit rows | 1:5 and 2:5 | 1:5
2:5 |

## Direct backend validation requests

| Check | Status | Expected | Actual |
| --- | --- | --- |
| POST add with amount=0 | 422 | 422 | 422 |
| POST deduct above available balance | 400 | 400 | 400 |
| Unauthenticated credit read | 401 | 401 | 401 |
| Unauthenticated credit write | 401 | 401 | 401 |
| Credit mutation without admin key | 401 | 401 | 401 |
| Credit mutation with incorrect admin key | 401 | 401 | 401 |
| Cross-account credit read | 404 | 404 | 404 |
| Incorrect password | 401 | 401 | 401 |
| Duplicate account registration | 409 | 409 | 409 |
| Destructive migration SQL | 400 | 400 | 400 |
| Multi-statement migration SQL | 400 | 400 | 400 |
| Session logout | 200 | 200 | 200 |
| Revoked session reuse | 401 | 401 | 401 |

## Actual browser API traffic

| Method | Path | HTTP status |
| --- | --- | --- |
| POST | /api/auth/register | 201 |
| GET | /healthz | 200 |
| GET | /api/auth/me | 200 |
| GET | /api/credits/1 | 200 |
| GET | /healthz | 200 |
| GET | /api/auth/me | 200 |
| GET | /api/credits/1 | 200 |
| POST | /api/credits/1/add | 200 |
| GET | /healthz | 200 |
| GET | /api/auth/me | 200 |
| GET | /api/credits/1 | 200 |
| POST | /api/credits/1/deduct | 200 |
| PATCH | /api/credits/1/reset | 200 |
| GET | /api/credits/999999 | 404 |
| GET | /api/credits/1 | 200 |
| GET | /api/schema/migrations | 401 |
| GET | /api/schema/migrations | 200 |
| POST | /api/schema/apply | 200 |
| GET | /api/schema/migrations | 200 |
| POST | /api/schema/apply | 200 |
| GET | /api/schema/migrations | 200 |

## Browser errors

- No uncaught browser errors observed.

## Screenshots captured

- [Public homepage](visuals/01-homepage.png) — The homepage explains the API-backed capabilities and leads into the workspace.
- [Live account balance](visuals/02-dashboard-initial-balance.png) — The selected account balance and last-updated timestamp are loaded from FastAPI and PostgreSQL.
- [Add credits](visuals/03-add-credit-dialog.png) — The operation dialog accepts an amount before submitting the real add-credit API request.
- [Persisted credit addition](visuals/04-after-add-credit.png) — After POST /api/credits/1/add, the UI and a direct PostgreSQL query both report 145.
- [Deduct credits](visuals/05-deduct-credit-dialog.png) — The deduction dialog shows the available balance before the real backend mutation.
- [Persisted credit deduction](visuals/06-after-deduct-credit.png) — After POST /api/credits/1/deduct, the UI and database both report 105.
- [Reset confirmation](visuals/07-reset-confirmation.png) — Reset requires explicit confirmation before the frontend sends PATCH /api/credits/1/reset.
- [Reset persisted](visuals/08-after-reset.png) — The balance becomes zero through the backend endpoint and is verified directly in PostgreSQL.
- [Backend error handling](visuals/09-user-not-found.png) — A missing account displays the actual API 404 response as a user-facing error.
- [Admin authentication guard](visuals/10-admin-unauthorized.png) — The frontend sends an incorrect API key and displays the backend's real 401 response.
- [Migration history](visuals/11-admin-migration-history.png) — With a valid runtime-only key, the frontend reads migration records from PostgreSQL through the API.
- [Migration applied](visuals/12-admin-migration-applied.png) — A harmless test-only index is submitted in the browser and independently verified in PostgreSQL.
- [Mobile dashboard](visuals/13-mobile-dashboard.png) — The production-built dashboard renders at a narrow viewport and still loads its account through the API.
- [Mobile navigation](visuals/14-mobile-navigation.png) — The responsive navigation opens on mobile while the workspace remains API-backed.

## Interpretation

Passing verifies frontend-to-backend HTTP integration, backend behavior, write persistence, and selected database constraints in an isolated real PostgreSQL server. It is not a production database verification.

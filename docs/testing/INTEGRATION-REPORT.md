# Mintline integrated E2E verification report

- Overall status: PASSED
- Started at UTC: 2026-10-25T17:43:57.713Z
- Frontend: production Vite build served at http://127.0.0.1:4173
- Backend: FastAPI main checkout at http://127.0.0.1:8000
- Database: ephemeral PostgreSQL; direct verification via psql
- Data: synthetic test-only users; no production database connection
- Browser: Playwright Chromium
- API mocking: none; observed browser responses come from the live FastAPI process

## Browser/API assertions

| Status | Assertion | Evidence |
| --- | --- | --- |
| PASSED | PostgreSQL schema contains authentication fields and revocable sessions | password hash, revocable sessions, and sign-in throttling tables exist |
| PASSED | Public homepage renders |  |
| PASSED | Opening the dashboard calls live health and account endpoints | Account registered; hashed session persisted; authenticated balance read = 120 |
| PASSED | Adding 25 credits updates the UI and the actual database row | POST /api/credits/1/add = 200; UI and direct SQL both report 145 |
| PASSED | Reloading re-reads the persisted account balance | Browser reload reads 145 through the backend; privileged key is not persisted |
| PASSED | Deducting 40 credits updates the UI and the actual database row | POST /api/credits/1/deduct = 200; UI and direct SQL both report 105 |
| PASSED | Resetting sends PATCH and persists zero | PATCH /api/credits/1/reset = 200; UI and direct SQL both report 0 |
| PASSED | Concurrent credit additions are atomic | Two concurrent +25 requests persist a final balance of 50; cleanup reset returns the test account to zero |
| PASSED | Backend rejects a zero-amount add without changing the database | POST amount=0 = 422; balance remains 0 |
| PASSED | Negative, fractional, and out-of-range amounts are rejected | Negative, fractional, and greater-than-PostgreSQL-integer amounts return 422; the stored balance remains zero |
| PASSED | Adding credits cannot overflow the PostgreSQL integer balance | An addition at the maximum stored integer is rejected with 400 instead of overflowing PostgreSQL |
| PASSED | Backend rejects over-deduction even on direct API calls | POST deduct from zero = 400 Insufficient credits; balance remains 0 |
| PASSED | Credit endpoints reject unauthenticated reads and writes | Read and write attempts without a bearer session return 401; balance is unchanged |
| PASSED | A signed-in user still needs the administrator key to mutate credits | A valid session alone, incorrect key, and schema-only key cannot modify credit balances |
| PASSED | An authenticated account cannot access another user's balance | A different existing user's account is concealed with HTTP 404 |
| PASSED | The credit-operator key grants explicit cross-account operator access | The separate credit-operator key permits an explicit cross-account read |
| PASSED | Invalid passwords and duplicate registrations are rejected | Incorrect credentials return 401; duplicate email cannot create a second account |
| PASSED | Repeated failed sign-ins are throttled | Ten invalid attempts trigger a 15-minute cooldown; the identifier is stored only as a one-way fingerprint |
| PASSED | Repeated invalid registrations trigger a client-scoped cooldown | Ten invalid sign-up attempts return 422; the next is rate-limited with HTTP 429 for 15 minutes, with no account created |
| PASSED | Missing user shows the real backend 404 in the frontend | GET /api/credits/999999 = 404; visible account-not-found message |
| PASSED | Admin screen displays the real 401 from an incorrect API key | GET /api/schema/migrations with bad key = 401 |
| PASSED | Correct admin key loads migration history from PostgreSQL | GET /api/schema/migrations with correct key = 200 |
| PASSED | Browser migration submission creates an index and audit record | POST /api/schema/apply = 200; SQL confirms the index and exactly one migration record |
| PASSED | Migration API rejects destructive and multi-statement SQL | Destructive, multi-statement, table-copy, rename, and unapproved-column submissions are rejected |
| PASSED | Repeated migration name is idempotently skipped | Second request was skipped; exactly one migration row remains |
| PASSED | Failed schema DDL rolls back its migration record | A database DDL error returns 500, rolls back the claimed migration row, and leaves the original index intact |
| PASSED | Concurrent duplicate migrations produce one atomic result | Concurrent requests apply DDL once and record exactly one migration row |
| PASSED | Production-built dashboard and navigation work at mobile width | 390×844 viewport rendered; account was loaded through GET /api/credits/1 |
| PASSED | Logout revokes the active database session | Logout revokes the server-side session; reuse of the old token returns 401 |
| PASSED | Daily scheduler logic updates the isolated database | Scheduler adds 5 credits once per UTC day and skips repeated or parallel duplicate executions |
| PASSED | No uncaught browser JavaScript errors occurred | 0 page errors |
| PASSED | All implemented frontend API operations were observed against the real backend | 21 browser-observed HTTP responses; no API route mocks |

## Direct PostgreSQL checks

| Status | Check | Expected | Actual |
| --- | --- | --- |
| PASSED | Add operation committed to PostgreSQL | 145 | 145 |
| PASSED | Read-after-write persistence after reload | 145 | 145 |
| PASSED | Deduct operation committed to PostgreSQL | 105 | 105 |
| PASSED | Reset operation committed to PostgreSQL | 0 | 0 |
| PASSED | Concurrent additions both commit without lost updates | 50 | 50 |
| PASSED | Concurrent-write test resets only the isolated test account | 0 | 0 |
| PASSED | Invalid amount did not alter balance | 0 | 0 |
| PASSED | Invalid amounts did not alter the balance | 0 | 0 |
| PASSED | Overflow guard leaves the maximum valid balance unchanged | 2147483647 | 2147483647 |
| PASSED | Overflow test restores the isolated account to zero | 0 | 0 |
| PASSED | Over-deduction did not alter balance | 0 | 0 |
| PASSED | Unauthenticated write did not alter the balance | 0 | 0 |
| PASSED | Missing, incorrect, or schema-only key did not alter the balance | 0 | 0 |
| PASSED | Migration row is recorded in PostgreSQL | 1 | 1 |
| PASSED | Submitted index exists in PostgreSQL | true | true |
| PASSED | Scheduler increments existing and creates missing credit rows | 1:5 and 2:5 | 1:5
2:5 |
| PASSED | Repeated scheduler invocation is idempotent | one run and balances 1:5, 2:5 | 1 run; 1:5
2:5 |

## Direct backend validation requests

| Check | Status | Expected | Actual |
| --- | --- | --- |
| Concurrent additions | 200 | 200 | 200 |
| POST add with amount=0 | 422 | 422 | 422 |
| Invalid add amount -1 | 422 | 422 | 422 |
| Invalid add amount 1.5 | 422 | 422 | 422 |
| Invalid add amount 2147483648 | 422 | 422 | 422 |
| Credit balance overflow | 400 | 400 | 400 |
| POST deduct above available balance | 400 | 400 | 400 |
| Unauthenticated credit read | 401 | 401 | 401 |
| Unauthenticated credit write | 401 | 401 | 401 |
| Credit mutation without operator key | 401 | 401 | 401 |
| Credit mutation with incorrect key | 401 | 401 | 401 |
| Credit mutation with schema-only key | 401 | 401 | 401 |
| Cross-account credit read | 404 | 404 | 404 |
| Cross-account credit read with operator key | 200 | 200 | 200 |
| Incorrect password | 401 | 401 | 401 |
| Duplicate account registration | 409 | 409 | 409 |
| Sign-in rate limit | 429 | 429 | 429 |
| Registration rate limit | 429 | 429 | 429 |
| Schema migration list with credit-only key | 401 | 401 | 401 |
| Destructive migration SQL | 400 | 400 | 400 |
| Multi-statement migration SQL | 400 | 400 | 400 |
| CREATE TABLE AS SELECT | 400 | 400 | 400 |
| ALTER TABLE rename | 400 | 400 | 400 |
| Index on non-allowlisted column | 400 | 400 | 400 |
| Schema DDL failure | 500 | 500 | 500 |
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

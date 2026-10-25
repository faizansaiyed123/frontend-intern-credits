# Mintline — Credit Management Dashboard

A polished public homepage and responsive React + TypeScript dashboard for the [backend-intern-credits](https://github.com/faizansaiyed123/backend-intern-credits) FastAPI service. The homepage is served at `/`, and the operational dashboard is at `/dashboard`. The UI uses the backend's real balance and administration endpoints; it does not invent account history or persist fake balances.

## Product walkthrough

Explore the [Mintline visual walkthrough](visual.md) for the homepage, account overview, credit operations, migration history, and mobile experience.

For the step-by-step browser/API/database results, see the [Visual Full-Stack Testing Walkthrough](docs/testing/VISUAL-TEST-WALKTHROUGH.md), which includes genuine screenshots, test coverage, read-after-write checks, and current limitations.

**Deployment note (checked 25 October 2026):** the production Vercel bundle currently falls back to `http://localhost:8000` because `VITE_API_BASE_URL` is not configured in the Vercel project. The UI is served, but production browser-to-API integration remains blocked until the actual deployed API origin is configured and reverified. See the walkthrough for evidence.

## Features

- Live account balance and last-updated timestamp from the API.
- Account registration/sign-in with salted password hashing, time-limited revocable sessions, and account-scoped reads.
- Add, deduct, and reset operations protected by a runtime-only administrator key, with input validation, loading states, and visible errors.
- API reachability indicator and manual refresh.
- A focused landing page explaining only the current API capabilities, with direct navigation to the dashboard.
- Admin migration history and guarded, non-destructive schema migration submission, using an API key entered at runtime and kept only in component memory.
- Account sign-out revokes the server-side session; the UI does not persist the bearer token beyond the browser tab.
- Responsive dashboard layout with accessible labels, keyboard-friendly forms, and empty/error states.

## Run locally

Prerequisites: Node.js 22.12+ and the backend service with its PostgreSQL schema configured.

```bash
npm install
cp .env.example .env
npm run dev
```

By default the frontend calls `http://localhost:8000`. Set `VITE_API_BASE_URL` in `.env` if the backend runs elsewhere. Environment variables prefixed with `VITE_` are public browser configuration; **never put API keys or other secrets in them**.

Run the backend from its repository root with a configured `.env` and schema:

```bash
cd backend-intern-credits
python -m venv .venv
source .venv/bin/activate
pip install -r src/requirements.txt
cp .env.example .env
# Edit .env, then load values into this shell for psql:
set -a && source .env && set +a
psql "${DATABASE_URL/+psycopg/}" -f schema.sql
# Optional demo account; use the returned user_id in the dashboard:
psql "${DATABASE_URL/+psycopg/}" -c "INSERT INTO users (email, name) VALUES ('demo@example.com', 'Demo User') ON CONFLICT (email) DO NOTHING;"
psql "${DATABASE_URL/+psycopg/}" -c "SELECT user_id, email, name FROM users WHERE email = 'demo@example.com';"
uvicorn src.main:app --reload
```

The workspace opens at `/dashboard` on user ID `1`. This backend does not expose user creation or a user directory endpoint, so that ID must already exist in the `users` table. Enter a different existing user ID in the dashboard header to switch accounts. The Vercel rewrite configuration keeps `/dashboard` working on direct visits and page refreshes.

## CORS

The backend allows Vite's local origins by default. For a deployed frontend, configure the backend's `CORS_ORIGINS` environment variable with the exact frontend origin(s), comma-separated, for example:

```env
CORS_ORIGINS=http://localhost:5173,https://your-frontend.example.com
```

Set `VITE_API_BASE_URL` to the deployed API URL on the frontend host, then restart/redeploy both services as needed.

## Admin migration warning

The backend's `POST /api/schema/apply` endpoint executes supplied SQL using the database role in `DATABASE_URL`. The Admin screen requires an API key at runtime and does not store it, but a browser UI is not a security boundary. Use migration controls only for trusted administrators, use a least-privileged database role, and restrict access to the backend/admin endpoints at the network or deployment layer. Do not embed `ADMIN_API_KEY` in the frontend or publish it in a `VITE_` variable.

## API contract used

- `GET /healthz`
- `GET /api/credits/{user_id}`
- `POST /api/credits/{user_id}/add` with `{"amount": positiveInteger}`
- `POST /api/credits/{user_id}/deduct` with `{"amount": positiveInteger}`
- `PATCH /api/credits/{user_id}/reset`
- `GET /api/schema/migrations` with `X-API-Key`
- `POST /api/schema/apply` with `X-API-Key` and `{"migration_name": "...", "sql": "..."}`


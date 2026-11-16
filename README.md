# Mintline — Credit Management Demo

This is the isolated \`demo\` branch of Mintline, the credit-management workspace. It is designed for recruiter and product walkthroughs while leaving the production-oriented \`main\` branch unchanged.

## Try it immediately

The frontend defaults to a browser-only simulation. It does not require PostgreSQL, a deployed API, API secrets, or a backend process.

\`\`\`bash
npm install
cp .env.example .env
npm run dev
\`\`\`

Open the Vite URL and choose **Fill demo sign-in** on the sign-in page.

| Purpose | Demo value |
| --- | --- |
| Email | \`demo@mintline.app\` |
| Password | \`MintlineDemo2026!\` |
| Credit operator key | \`mintline-demo-credit-operator\` |
| Schema admin key | \`mintline-demo-schema-admin\` |

The demo starts with two sample accounts. Account 1 is the seeded sign-in account; account 2 can be selected in the dashboard to demonstrate operator-only cross-account access. New registrations create zero-credit sample accounts.

## What can be explored

- Register and sign in, with an eight-hour tab session and sign-out.
- Read account-specific balances and switch to another sample account with the operator key.
- Add, deduct, and reset credits, with positive-amount, insufficient-balance, and maximum-balance checks.
- Review a seeded migration history and submit a duplicate-safe sample migration.
- Check the workspace health indicator and use the responsive dashboard and mobile navigation.

The local simulation stores sample accounts, balances, and migration history in the browser's \`localStorage\`; the bearer-style session is kept in \`sessionStorage\`. Use a private browser session to start with a clean store, or remove the \`mintline_demo_store_v1\` local-storage entry to reset it. Do not use real credentials or personal data in this demo.

**Safety boundary:** demo keys are public sample values, not secrets. The browser simulation is not production authentication. Sample schema migrations are only validated and recorded; no SQL is executed. Nothing in this branch should be connected to a production database.

## Use the standalone FastAPI demo backend (optional)

A separate in-memory FastAPI implementation is provided in the companion backend repository's \`demo\` branch. It implements the same frontend API contract and can be used instead of the browser adapter.

Start it from a checkout of \`backend-intern-credits\`:

\`\`\`bash
cd backend-intern-credits
python -m venv .venv
source .venv/bin/activate
pip install -r demo-requirements.txt
uvicorn src.demo_main:app --reload --port 8001
\`\`\`

Then set the following values in the frontend \`.env\` and restart Vite:

\`\`\`env
VITE_DEMO_MODE=true
VITE_DEMO_API_URL=http://localhost:8001
\`\`\`

The seeded demo login and the two sample admin keys are the same in both implementations. The backend keeps its state in memory, resets when the process restarts, and never imports or connects to the production SQLAlchemy database module. Its simulated daily-credit endpoint adds five credits once per UTC date when called with the demo operator key.

## Switch back to the real API contract

The demo branch can call an existing compatible backend by setting \`VITE_DEMO_MODE=false\` and \`VITE_API_BASE_URL\` to that backend's origin. This disables the sample browser adapter. Never put \`ADMIN_API_KEY\`, \`CREDIT_ADMIN_API_KEY\`, or database credentials in a \`VITE_\` variable.

## Build and checks

\`\`\`bash
npm run build
\`\`\`

The branch-specific GitHub Actions workflow type-checks and builds this branch. The production integration-evidence workflow that can publish to \`main\` is intentionally absent from this demo branch.

# Mintline — verified end-to-end walkthrough

Generated from the integrated browser/API/database workflow on 2026-10-22T12:41:13.770Z.

**Integration model:** a production-built React frontend makes real HTTP requests from Chromium to the repository's FastAPI backend; PostgreSQL is the backend's actual database. The run observes response codes and queries PostgreSQL after mutations. It does not mock or intercept API routes.

**Data boundary:** a disposable PostgreSQL instance and synthetic, test-only users are used. This workflow does not connect to production or use customer records.

**Result:** PASSED

## Public homepage

![Public homepage](docs/testing/visuals/01-homepage.png)

The public page describes the features that the backend actually exposes. Opening the workspace navigates into the operational dashboard.

## Live account and credit operations

### Live account balance

![Live account balance](docs/testing/visuals/02-dashboard-initial-balance.png)

The selected account balance and last-updated timestamp are loaded from FastAPI and PostgreSQL.

### Add credits

![Add credits](docs/testing/visuals/03-add-credit-dialog.png)

The operation dialog accepts an amount before submitting the real add-credit API request.

### Persisted credit addition

![Persisted credit addition](docs/testing/visuals/04-after-add-credit.png)

After POST /api/credits/1/add, the UI and a direct PostgreSQL query both report 145.

### Deduct credits

![Deduct credits](docs/testing/visuals/05-deduct-credit-dialog.png)

The deduction dialog shows the available balance before the real backend mutation.

### Persisted credit deduction

![Persisted credit deduction](docs/testing/visuals/06-after-deduct-credit.png)

After POST /api/credits/1/deduct, the UI and database both report 105.

### Reset confirmation

![Reset confirmation](docs/testing/visuals/07-reset-confirmation.png)

Reset requires explicit confirmation before the frontend sends PATCH /api/credits/1/reset.

### Reset persisted

![Reset persisted](docs/testing/visuals/08-after-reset.png)

The balance becomes zero through the backend endpoint and is verified directly in PostgreSQL.

## Backend errors and administration

### Backend error handling

![Backend error handling](docs/testing/visuals/09-user-not-found.png)

A missing account displays the actual API 404 response as a user-facing error.

### Admin authentication guard

![Admin authentication guard](docs/testing/visuals/10-admin-unauthorized.png)

The frontend sends an incorrect API key and displays the backend's real 401 response.

### Migration history

![Migration history](docs/testing/visuals/11-admin-migration-history.png)

With a valid runtime-only key, the frontend reads migration records from PostgreSQL through the API.

### Migration applied

![Migration applied](docs/testing/visuals/12-admin-migration-applied.png)

A harmless test-only index is submitted in the browser and independently verified in PostgreSQL.

## Responsive mobile view

### Mobile dashboard

![Mobile dashboard](docs/testing/visuals/13-mobile-dashboard.png)

The production-built dashboard renders at a narrow viewport and still loads its account through the API.

### Mobile navigation

![Mobile navigation](docs/testing/visuals/14-mobile-navigation.png)

The responsive navigation opens on mobile while the workspace remains API-backed.

## Evidence and scope

See [the integration test report](docs/testing/INTEGRATION-REPORT.md) and [captured browser API traffic](docs/testing/api-network.json) for assertions and the HTTP requests observed from the running API.

Each balance operation is checked in the UI, on the next API read, and with a direct SQL query. Schema migration execution is tested only against this disposable database.

A passing run proves the production-built frontend, actual FastAPI implementation, and a real PostgreSQL server worked together in this browser test. It does not establish correctness against a production database, real customer accounts, production secrets, or external service delivery.

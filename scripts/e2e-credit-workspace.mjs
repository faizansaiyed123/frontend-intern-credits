import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const backendRoot = path.join(root, "backend", "backend-intern-credits");
const screenshotsDir = path.join(root, "docs", "testing", "visuals");
const docsDir = path.join(root, "docs", "testing");
const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const apiBaseUrl = (process.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
const apiOrigin = new URL(apiBaseUrl).origin;
const adminKey = process.env.ADMIN_API_KEY;
const creditAdminKey = process.env.CREDIT_ADMIN_API_KEY;
const testEmail = "e2e-mintline@example.invalid";
const testPassword = "Mintline-Test-Password-2026!";
const psqlUrl = process.env.PSQL_URL;
const startedAt = new Date().toISOString();
const checks = [];
let testToken = "";
const apiRequests = [];
const directApiChecks = [];
const dbChecks = [];
const browserErrors = [];
const capturedScreenshots = [];
let browser;
let fatalError;

const catalog = [
  ["01-homepage.png", "Public homepage", "The homepage explains the API-backed capabilities and leads into the workspace."],
  ["02-dashboard-initial-balance.png", "Live account balance", "The selected account balance and last-updated timestamp are loaded from FastAPI and PostgreSQL."],
  ["03-add-credit-dialog.png", "Add credits", "The operation dialog accepts an amount before submitting the real add-credit API request."],
  ["04-after-add-credit.png", "Persisted credit addition", "After POST /api/credits/1/add, the UI and a direct PostgreSQL query both report 145."],
  ["05-deduct-credit-dialog.png", "Deduct credits", "The deduction dialog shows the available balance before the real backend mutation."],
  ["06-after-deduct-credit.png", "Persisted credit deduction", "After POST /api/credits/1/deduct, the UI and database both report 105."],
  ["07-reset-confirmation.png", "Reset confirmation", "Reset requires explicit confirmation before the frontend sends PATCH /api/credits/1/reset."],
  ["08-after-reset.png", "Reset persisted", "The balance becomes zero through the backend endpoint and is verified directly in PostgreSQL."],
  ["09-user-not-found.png", "Backend error handling", "A missing account displays the actual API 404 response as a user-facing error."],
  ["10-admin-unauthorized.png", "Admin authentication guard", "The frontend sends an incorrect API key and displays the backend's real 401 response."],
  ["11-admin-migration-history.png", "Migration history", "With a valid runtime-only key, the frontend reads migration records from PostgreSQL through the API."],
  ["12-admin-migration-applied.png", "Migration applied", "A harmless test-only index is submitted in the browser and independently verified in PostgreSQL."],
  ["13-mobile-dashboard.png", "Mobile dashboard", "The production-built dashboard renders at a narrow viewport and still loads its account through the API."],
  ["14-mobile-navigation.png", "Mobile navigation", "The responsive navigation opens on mobile while the workspace remains API-backed."]
];

function sqlValue(sql) {
  if (!psqlUrl) throw new Error("PSQL_URL is required for direct PostgreSQL verification.");
  return execFileSync("psql", [psqlUrl, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function pass(name, evidence) {
  checks.push({ name, status: "passed", evidence: evidence || "" });
  console.log("PASS: " + name + (evidence ? " — " + evidence : ""));
}

async function verify(name, action) {
  try {
    const evidence = await action();
    pass(name, evidence);
  } catch (error) {
    checks.push({ name, status: "failed", evidence: String(error && error.message ? error.message : error) });
    throw error;
  }
}

function expectApi(method, route, status) {
  const found = apiRequests.find((item) => item.method === method && item.path === route && item.status === status);
  assert.ok(found, "Expected browser HTTP request " + method + " " + route + " with status " + status +
    ". Observed: " + JSON.stringify(apiRequests.map((item) => ({ method: item.method, path: item.path, status: item.status }))));
}

const publicScreenshotMap = {
  "01-homepage.png": "01-homepage.png",
  "02-dashboard-initial-balance.png": "02-credit-overview.png",
  "03-add-credit-dialog.png": "03-add-credits.png",
  "04-after-add-credit.png": "04-balance-after-addition.png",
  "05-deduct-credit-dialog.png": "05-deduct-credits.png",
  "06-after-deduct-credit.png": "06-balance-after-deduction.png",
  "07-reset-confirmation.png": "07-reset-confirmation.png",
  "08-after-reset.png": "08-balance-after-reset.png",
  "11-admin-migration-history.png": "09-migration-history.png",
  "13-mobile-dashboard.png": "10-mobile-dashboard.png",
  "14-mobile-navigation.png": "11-mobile-navigation.png"
};
const publicScreenshotsDir = path.join(root, "docs", "walkthrough", "visuals");

async function takeScreenshot(page, file) {
  await fs.mkdir(screenshotsDir, { recursive: true });
  const sourcePath = path.join(screenshotsDir, file);
  await page.screenshot({ path: sourcePath, fullPage: true, animations: "disabled" });
  if (!capturedScreenshots.includes(file)) capturedScreenshots.push(file);

  const publicName = publicScreenshotMap[file];
  if (publicName) {
    await fs.mkdir(publicScreenshotsDir, { recursive: true });
    await fs.copyFile(sourcePath, path.join(publicScreenshotsDir, publicName));
  }
}

async function waitForBalance(page, expected) {
  await page.waitForFunction((wanted) => {
    const element = document.querySelector(".balance-number");
    if (!element) return false;
    return (element.textContent || "").replace(/,/g, "").trim() === String(wanted);
  }, expected, { timeout: 15000 });
}

async function assertDatabaseBalance(expected, label) {
  const actual = sqlValue("SELECT credits FROM credits WHERE user_id = 1;");
  assert.equal(actual, String(expected), label + " — PostgreSQL returned " + actual + ".");
  dbChecks.push({ check: label, status: "passed", query: "SELECT credits FROM credits WHERE user_id = 1", expected: String(expected), actual });
}

async function writeReports(status, reason) {
  await fs.mkdir(docsDir, { recursive: true });
  const captured = catalog.filter((item) => capturedScreenshots.includes(item[0]));
  const home = captured.find((item) => item[0] === "01-homepage.png");
  const sections = [
    ["Live account and credit operations", captured.filter((item) => /^0[2-8]-/.test(item[0]))],
    ["Backend errors and administration", captured.filter((item) => /^(09|10|11|12)-/.test(item[0]))],
    ["Responsive mobile view", captured.filter((item) => /^1[34]-/.test(item[0]))]
  ];
  const allCatalog = new Map(catalog.map((item) => [item[0], { source: item[0], title: item[1], description: item[2] }]));
  const journey = [
    { source: "01-homepage.png", title: "Welcome to Mintline", heading: "## 1. Start with a clear workspace", text: "The homepage introduces a focused credit-management workspace and takes you directly to the dashboard." },
    { source: "02-dashboard-initial-balance.png", title: "Credit overview", heading: "## 2. Review an account balance", text: "Open an existing account to see its current balance, account ID, and last-updated time. The values are requested from the connected credit service." },
    { source: "03-add-credit-dialog.png", title: "Add credits", heading: "## 3. Add credits", text: "Choose an amount and confirm the operation. Mintline submits the change through the credit API." },
    { source: "04-after-add-credit.png", title: "Balance after addition", heading: "", text: "The updated balance is shown after the service completes the operation: 120 credits becomes 145 after adding 25." },
    { source: "05-deduct-credit-dialog.png", title: "Deduct credits", heading: "## 4. Deduct credits", text: "Deduct an amount from the available balance. The interface helps keep the requested deduction within the current balance, and the service enforces the balance rule as well." },
    { source: "06-after-deduct-credit.png", title: "Balance after deduction", heading: "", text: "After deducting 40 credits, the account balance is 105." },
    { source: "07-reset-confirmation.png", title: "Reset confirmation", heading: "## 5. Reset a balance deliberately", text: "Reset is a distinct action and requires an explicit confirmation before it is submitted." },
    { source: "08-after-reset.png", title: "Balance after reset", heading: "", text: "The account reflects the reset balance of zero once the service returns the updated record." },
    { source: "11-admin-migration-history.png", title: "Migration history", heading: "## 6. View schema migration history", text: "The administrator area can retrieve recorded schema changes from the service. Access is protected by the backend's configured administrator key." },
    { source: "13-mobile-dashboard.png", title: "Mobile dashboard", heading: "## 7. Use the workspace on mobile", text: "The dashboard remains readable at a narrow viewport, with the same account balance coming from the connected service." },
    { source: "14-mobile-navigation.png", title: "Mobile navigation", heading: "", text: "Navigation adapts for a smaller screen so the main workspace remains reachable." }
  ].filter((item) => capturedScreenshots.includes(item.source));

  const lines = [
    "# Mintline — Credit Management Workspace",
    "",
    "A guided look at how Mintline brings account balances and credit operations into one focused workspace.",
    "",
    "The experience follows a simple journey: open an existing account, review its current balance, make a controlled change, and see the updated value returned by the connected service.",
    "",
    "## At a glance",
    "",
    "| Action | Balance shown in this walkthrough |",
    "| --- | ---: |",
    "| Starting balance | 120 credits |",
    "| Add 25 credits | 145 credits |",
    "| Deduct 40 credits | 105 credits |",
    "| Reset balance | 0 credits |",
    "",
    "## The product journey",
    ""
  ];
  for (const item of journey) {
    if (item.heading) lines.push(item.heading, "");
    lines.push("### " + item.title, "", "![" + item.title + "](docs/walkthrough/visuals/" + publicScreenshotMap[item.source] + ")", "", item.text, "");
  }
  lines.push(
    "## One connected source of truth",
    "",
    "Balances are requested from the connected FastAPI service. Add, deduct, and reset actions are sent to that service, and the dashboard reflects the account record returned after each operation.",
    "",
    "## Explore the code",
    "",
    "- [Mintline frontend](https://github.com/faizansaiyed123/frontend-intern-credits)",
    "- [Credit management backend](https://github.com/faizansaiyed123/backend-intern-credits)",
    ""
  );
  const requestRows = apiRequests.length
    ? apiRequests.map((item) => "| " + item.method + " | " + item.path + " | " + item.status + " |").join("\n")
    : "| No API responses observed | — | — |";
  const checkRows = checks.length
    ? checks.map((item) => "| " + item.status.toUpperCase() + " | " + item.name.replace(/\|/g, "\\|") + " | " + (item.evidence || "").replace(/\|/g, "\\|").replace(/\n/g, " ") + " |").join("\n")
    : "| UNKNOWN | No completed assertions | " + String(reason || "See workflow log.") + " |";
  const dbRows = dbChecks.length
    ? dbChecks.map((item) => "| " + item.status.toUpperCase() + " | " + item.check + " | " + item.expected + " | " + item.actual + " |").join("\n")
    : "| UNKNOWN | No direct database assertions recorded | — | — |";
  const directRows = directApiChecks.length
    ? directApiChecks.map((item) => "| " + item.name + " | " + item.status + " | " + item.expected + " | " + item.actual + " |").join("\n")
    : "| No direct validation calls recorded | — | — |";
  const browserErrorLines = browserErrors.length ? browserErrors.map((item) => "- " + item).join("\n") : "- No uncaught browser errors observed.";
  const report = [
    "# Mintline integrated E2E verification report",
    "",
    "- Overall status: " + status,
    "- Started at UTC: " + startedAt,
    "- Frontend: production Vite build served at " + baseUrl,
    "- Backend: FastAPI main checkout at " + apiBaseUrl,
    "- Database: ephemeral PostgreSQL; direct verification via psql",
    "- Data: synthetic test-only users; no production database connection",
    "- Browser: Playwright Chromium",
    "- API mocking: none; observed browser responses come from the live FastAPI process",
    "",
    "## Browser/API assertions",
    "",
    "| Status | Assertion | Evidence |",
    "| --- | --- | --- |",
    checkRows,
    "",
    "## Direct PostgreSQL checks",
    "",
    "| Status | Check | Expected | Actual |",
    "| --- | --- | --- |",
    dbRows,
    "",
    "## Direct backend validation requests",
    "",
    "| Check | Status | Expected | Actual |",
    "| --- | --- | --- |",
    directRows,
    "",
    "## Actual browser API traffic",
    "",
    "| Method | Path | HTTP status |",
    "| --- | --- | --- |",
    requestRows,
    "",
    "## Browser errors",
    "",
    browserErrorLines,
    "",
    "## Screenshots captured",
    "",
    ...captured.map((item) => "- [" + item[1] + "](visuals/" + item[0] + ") — " + item[2]),
    "",
    "## Interpretation",
    "",
    "Passing verifies frontend-to-backend HTTP integration, backend behavior, write persistence, and selected database constraints in an isolated real PostgreSQL server. It is not a production database verification.",
    ""
  ].join("\n");
  await fs.writeFile(path.join(docsDir, "INTEGRATION-REPORT.md"), report, "utf8");
  await fs.writeFile(path.join(docsDir, "api-network.json"), JSON.stringify({
    runStartedAt: startedAt,
    overallStatus: status,
    apiOrigin,
    note: "No API routes were mocked or intercepted. API keys and request headers are deliberately excluded.",
    browserRequests: apiRequests,
    directBackendChecks: directApiChecks,
    databaseChecks: dbChecks,
    assertions: checks,
    browserErrors,
    screenshots: capturedScreenshots
  }, null, 2) + "\n", "utf8");
}

async function run() {
  assert.ok(adminKey, "ADMIN_API_KEY was not configured for this test backend.");
  assert.ok(creditAdminKey, "CREDIT_ADMIN_API_KEY was not configured for this test backend.");
  assert.ok(psqlUrl, "PSQL_URL was not configured for direct database verification.");
  browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => browserErrors.push(String(error.message || error)));
  page.on("response", (response) => {
    try {
      const parsed = new URL(response.url());
      if (parsed.origin !== apiOrigin) return;
      const request = response.request();
      apiRequests.push({
        at: new Date().toISOString(),
        method: request.method(),
        path: parsed.pathname,
        status: response.status()
      });
    } catch {}
  });

  await verify("PostgreSQL schema contains authentication fields and revocable sessions", async () => {
    assert.equal(sqlValue("SELECT count(*) FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash';"), "1");
    assert.equal(sqlValue("SELECT count(*) FROM information_schema.tables WHERE table_name='auth_sessions';"), "1");
    return "password hash column and auth_sessions table exist";
  });

  await verify("Public homepage renders", async () => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Open credit dashboard/i }).waitFor({ state: "visible" });
    await takeScreenshot(page, "01-homepage.png");
  });

  await verify("Opening the dashboard calls live health and account endpoints", async () => {
    await page.getByRole("button", { name: /Open credit dashboard/i }).click();
    await page.waitForURL("**/dashboard");
    await page.getByRole("tab", { name: "Create account" }).click();
    await page.getByLabel("Full name").fill("Mintline E2E Test User");
    await page.getByLabel("Email address").fill(testEmail);
    await page.locator("#auth-password").fill(testPassword);
    await page.locator("#auth-confirm-password").fill(testPassword);
    await page.locator(".auth-form").getByRole("button", { name: /Create account/i }).click();
    await page.waitForFunction(() => {
      const balance = document.querySelector(".balance-number");
      return Boolean(balance && (balance.textContent || "").replace(/,/g, "").trim() === "0");
    }, null, { timeout: 15000 });
    assert.equal(sqlValue("SELECT count(*) FROM users WHERE user_id=1 AND email='e2e-mintline@example.invalid' AND password_hash IS NOT NULL;"), "1");
    assert.equal(sqlValue("SELECT credits FROM credits WHERE user_id=1;"), "0");
    testToken = await page.evaluate(() => window.sessionStorage.getItem("mintline_access_token") || "");
    assert.ok(testToken.length >= 40, "Registration did not store an opaque session token.");
    const storedHash = sqlValue("SELECT token_hash FROM auth_sessions WHERE user_id=1 ORDER BY session_id DESC LIMIT 1;");
    assert.equal(storedHash, createHash("sha256").update(testToken).digest("hex"), "Database should store only the SHA-256 token hash.");
    sqlValue("UPDATE credits SET credits=120, last_updated=NOW() WHERE user_id=1;");
    await page.reload({ waitUntil: "networkidle" });
    await waitForBalance(page, 120);
    await page.locator("#credit-admin-key").fill(creditAdminKey);
    await page.getByText("API connected", { exact: true }).first().waitFor({ state: "visible" });
    expectApi("GET", "/healthz", 200);
    expectApi("POST", "/api/auth/register", 201);
    expectApi("GET", "/api/auth/me", 200);
    expectApi("GET", "/api/credits/1", 200);
    await takeScreenshot(page, "02-dashboard-initial-balance.png");
    return "Account registered; hashed session persisted; authenticated balance read = 120";
  });

  await verify("Adding 25 credits updates the UI and the actual database row", async () => {
    await page.getByRole("button", { name: /Add credits/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    await takeScreenshot(page, "03-add-credit-dialog.png");
    await page.getByLabel("Amount to add").fill("25");
    await dialog.getByRole("button", { name: "Confirm addition" }).click();
    await dialog.waitFor({ state: "hidden" });
    await waitForBalance(page, 145);
    expectApi("POST", "/api/credits/1/add", 200);
    await assertDatabaseBalance(145, "Add operation committed to PostgreSQL");
    await takeScreenshot(page, "04-after-add-credit.png");
    return "POST /api/credits/1/add = 200; UI and direct SQL both report 145";
  });

  await verify("Reloading re-reads the persisted account balance", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await waitForBalance(page, 145);
    // Operator keys intentionally stay only in component memory and must be re-entered after a reload.
    await page.locator("#credit-admin-key").fill(creditAdminKey);
    expectApi("GET", "/api/credits/1", 200);
    await assertDatabaseBalance(145, "Read-after-write persistence after reload");
    return "Browser reload reads 145 through the backend; privileged key is not persisted";
  });

  await verify("Deducting 40 credits updates the UI and the actual database row", async () => {
    await page.getByRole("button", { name: /Deduct credits/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    await takeScreenshot(page, "05-deduct-credit-dialog.png");
    await page.getByLabel("Amount to deduct").fill("40");
    await dialog.getByRole("button", { name: "Confirm deduction" }).click();
    await dialog.waitFor({ state: "hidden" });
    await waitForBalance(page, 105);
    expectApi("POST", "/api/credits/1/deduct", 200);
    await assertDatabaseBalance(105, "Deduct operation committed to PostgreSQL");
    await takeScreenshot(page, "06-after-deduct-credit.png");
    return "POST /api/credits/1/deduct = 200; UI and direct SQL both report 105";
  });

  await verify("Resetting sends PATCH and persists zero", async () => {
    await page.getByRole("button", { name: /Reset balance/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    await page.getByRole("checkbox", { name: /I understand the current balance will be cleared/i }).check();
    await takeScreenshot(page, "07-reset-confirmation.png");
    await dialog.getByRole("button", { name: "Reset balance" }).click();
    await dialog.waitFor({ state: "hidden" });
    await waitForBalance(page, 0);
    expectApi("PATCH", "/api/credits/1/reset", 200);
    await assertDatabaseBalance(0, "Reset operation committed to PostgreSQL");
    await takeScreenshot(page, "08-after-reset.png");
    return "PATCH /api/credits/1/reset = 200; UI and direct SQL both report 0";
  });

  await verify("Backend rejects a zero-amount add without changing the database", async () => {
    const response = await fetch(apiBaseUrl + "/api/credits/1/add", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + testToken, "X-API-Key": creditAdminKey },
      body: JSON.stringify({ amount: 0 })
    });
    const body = await response.text();
    directApiChecks.push({ name: "POST add with amount=0", status: response.status, expected: 422, actual: response.status, detail: body });
    assert.equal(response.status, 422);
    await assertDatabaseBalance(0, "Invalid amount did not alter balance");
    return "POST amount=0 = 422; balance remains 0";
  });

  await verify("Backend rejects over-deduction even on direct API calls", async () => {
    const response = await fetch(apiBaseUrl + "/api/credits/1/deduct", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + testToken, "X-API-Key": creditAdminKey },
      body: JSON.stringify({ amount: 1 })
    });
    const body = await response.text();
    directApiChecks.push({ name: "POST deduct above available balance", status: response.status, expected: 400, actual: response.status, detail: body });
    assert.equal(response.status, 400);
    assert.ok(body.includes("Insufficient credits"));
    await assertDatabaseBalance(0, "Over-deduction did not alter balance");
    return "POST deduct from zero = 400 Insufficient credits; balance remains 0";
  });

  await verify("Credit endpoints reject unauthenticated reads and writes", async () => {
    const read = await fetch(apiBaseUrl + "/api/credits/1");
    assert.equal(read.status, 401);
    const write = await fetch(apiBaseUrl + "/api/credits/1/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 1 })
    });
    assert.equal(write.status, 401);
    await assertDatabaseBalance(0, "Unauthenticated write did not alter the balance");
    directApiChecks.push({ name: "Unauthenticated credit read", status: read.status, expected: 401, actual: read.status });
    directApiChecks.push({ name: "Unauthenticated credit write", status: write.status, expected: 401, actual: write.status });
    return "Read and write attempts without a bearer session return 401; balance is unchanged";
  });

  await verify("A signed-in user still needs the administrator key to mutate credits", async () => {
    const missing = await fetch(apiBaseUrl + "/api/credits/1/add", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + testToken },
      body: JSON.stringify({ amount: 1 })
    });
    assert.equal(missing.status, 401);
    const incorrect = await fetch(apiBaseUrl + "/api/credits/1/add", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + testToken, "X-API-Key": "incorrect-e2e-key" },
      body: JSON.stringify({ amount: 1 })
    });
    assert.equal(incorrect.status, 401);
    const schemaKey = await fetch(apiBaseUrl + "/api/credits/1/add", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + testToken, "X-API-Key": adminKey },
      body: JSON.stringify({ amount: 1 })
    });
    assert.equal(schemaKey.status, 401);
    await assertDatabaseBalance(0, "Missing, incorrect, or schema-only key did not alter the balance");
    directApiChecks.push({ name: "Credit mutation without operator key", status: missing.status, expected: 401, actual: missing.status });
    directApiChecks.push({ name: "Credit mutation with incorrect key", status: incorrect.status, expected: 401, actual: incorrect.status });
    directApiChecks.push({ name: "Credit mutation with schema-only key", status: schemaKey.status, expected: 401, actual: schemaKey.status });
    return "A valid session alone, incorrect key, and schema-only key cannot modify credit balances";
  });

  await verify("An authenticated account cannot access another user's balance", async () => {
    sqlValue("INSERT INTO users (user_id, email, name) VALUES (2, 'other-e2e@example.invalid', 'Other User') ON CONFLICT (user_id) DO NOTHING;");
    const response = await fetch(apiBaseUrl + "/api/credits/2", {
      headers: { Authorization: "Bearer " + testToken, Accept: "application/json" }
    });
    assert.equal(response.status, 404);
    directApiChecks.push({ name: "Cross-account credit read", status: response.status, expected: 404, actual: response.status });
    return "A different existing user's account is concealed with HTTP 404";
  });

  await verify("Invalid passwords and duplicate registrations are rejected", async () => {
    const badLogin = await fetch(apiBaseUrl + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "e2e-mintline@example.invalid", password: "wrong-password" })
    });
    assert.equal(badLogin.status, 401);
    const duplicate = await fetch(apiBaseUrl + "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "e2e-mintline@example.invalid", name: "Duplicate", password: "Mintline-Test-Password-2026!" })
    });
    assert.equal(duplicate.status, 409);
    directApiChecks.push({ name: "Incorrect password", status: badLogin.status, expected: 401, actual: badLogin.status });
    directApiChecks.push({ name: "Duplicate account registration", status: duplicate.status, expected: 409, actual: duplicate.status });
    assert.equal(sqlValue("SELECT count(*) FROM users WHERE email='e2e-mintline@example.invalid';"), "1");
    return "Incorrect credentials return 401; duplicate email cannot create a second account";
  });

  await verify("Missing user shows the real backend 404 in the frontend", async () => {
    await page.getByLabel("User ID").fill("999999");
    await page.getByRole("button", { name: /Open account/i }).click();
    await page.locator(".error-banner").waitFor({ state: "visible" });
    assert.match(await page.locator(".error-banner").innerText(), /User not found/i);
    expectApi("GET", "/api/credits/999999", 404);
    await takeScreenshot(page, "09-user-not-found.png");
    await page.getByLabel("User ID").fill("1");
    await page.getByRole("button", { name: /Open account/i }).click();
    await waitForBalance(page, 0);
    return "GET /api/credits/999999 = 404; visible account-not-found message";
  });

  await verify("Admin screen displays the real 401 from an incorrect API key", async () => {
    await page.getByRole("button", { name: /Admin & migrations/i }).click();
    await page.locator("#admin-key").fill("incorrect-e2e-key");
    await page.getByRole("button", { name: /Load migration history/i }).click();
    await page.locator(".inline-error").filter({ hasText: "Unauthorized" }).first().waitFor({ state: "visible" });
    expectApi("GET", "/api/schema/migrations", 401);
    const creditKeyCannotReadSchema = await fetch(apiBaseUrl + "/api/schema/migrations", {
      headers: { "X-API-Key": creditAdminKey, Accept: "application/json" }
    });
    assert.equal(creditKeyCannotReadSchema.status, 401);
    directApiChecks.push({ name: "Schema migration list with credit-only key", status: creditKeyCannotReadSchema.status, expected: 401, actual: creditKeyCannotReadSchema.status });
    await takeScreenshot(page, "10-admin-unauthorized.png");
    return "GET /api/schema/migrations with bad key = 401";
  });

  await verify("Correct admin key loads migration history from PostgreSQL", async () => {
    await page.locator("#admin-key").fill(adminKey);
    await page.getByRole("button", { name: /Load migration history/i }).click();
    await page.getByRole("heading", { name: "Migration history" }).waitFor({ state: "visible" });
    await page.getByText("No migrations recorded yet", { exact: true }).waitFor({ state: "visible" });
    expectApi("GET", "/api/schema/migrations", 200);
    await takeScreenshot(page, "11-admin-migration-history.png");
    return "GET /api/schema/migrations with correct key = 200";
  });

  await verify("Browser migration submission creates an index and audit record", async () => {
    await page.getByLabel("Migration name").fill("e2e_verified_credits_index");
    await page.getByLabel("SQL statement").fill("CREATE INDEX IF NOT EXISTS idx_e2e_credits_last_updated ON credits(last_updated DESC);");
    await page.getByRole("checkbox", { name: /I reviewed this SQL and understand it will execute/i }).check();
    await page.getByRole("button", { name: /Apply migration/i }).click();
    await page.locator(".inline-success").filter({ hasText: "was applied successfully" }).first().waitFor({ state: "visible" });
    expectApi("POST", "/api/schema/apply", 200);
    assert.equal(sqlValue("SELECT count(*) FROM schema_migrations WHERE migration_name='e2e_verified_credits_index';"), "1");
    assert.equal(sqlValue("SELECT (to_regclass('public.idx_e2e_credits_last_updated') IS NOT NULL)::text;"), "true");
    dbChecks.push({ check: "Migration row is recorded in PostgreSQL", status: "passed", expected: "1", actual: "1" });
    dbChecks.push({ check: "Submitted index exists in PostgreSQL", status: "passed", expected: "true", actual: "true" });
    await takeScreenshot(page, "12-admin-migration-applied.png");
    return "POST /api/schema/apply = 200; SQL confirms the index and exactly one migration record";
  });

  await verify("Migration API rejects destructive and multi-statement SQL", async () => {
    const destructive = await fetch(apiBaseUrl + "/api/schema/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": adminKey },
      body: JSON.stringify({ migration_name: "e2e_rejected_destructive", sql: "DROP TABLE credits;" })
    });
    assert.equal(destructive.status, 400);
    const multi = await fetch(apiBaseUrl + "/api/schema/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": adminKey },
      body: JSON.stringify({ migration_name: "e2e_rejected_multi", sql: "CREATE INDEX idx_e2e_multi ON credits(user_id); DROP TABLE credits;" })
    });
    assert.equal(multi.status, 400);
    const createTableAs = await fetch(apiBaseUrl + "/api/schema/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": adminKey },
      body: JSON.stringify({ migration_name: "e2e_rejected_copy", sql: "CREATE TABLE e2e_copy AS SELECT * FROM users;" })
    });
    assert.equal(createTableAs.status, 400);
    const rename = await fetch(apiBaseUrl + "/api/schema/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": adminKey },
      body: JSON.stringify({ migration_name: "e2e_rejected_rename", sql: "ALTER TABLE credits RENAME TO credits_backup;" })
    });
    assert.equal(rename.status, 400);
    const invalidColumn = await fetch(apiBaseUrl + "/api/schema/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": adminKey },
      body: JSON.stringify({ migration_name: "e2e_rejected_column", sql: "CREATE INDEX e2e_bad_column ON credits(password_hash);" })
    });
    assert.equal(invalidColumn.status, 400);
    assert.equal(sqlValue("SELECT (to_regclass('public.credits') IS NOT NULL)::text;"), "true");
    directApiChecks.push({ name: "Destructive migration SQL", status: destructive.status, expected: 400, actual: destructive.status });
    directApiChecks.push({ name: "Multi-statement migration SQL", status: multi.status, expected: 400, actual: multi.status });
    directApiChecks.push({ name: "CREATE TABLE AS SELECT", status: createTableAs.status, expected: 400, actual: createTableAs.status });
    directApiChecks.push({ name: "ALTER TABLE rename", status: rename.status, expected: 400, actual: rename.status });
    directApiChecks.push({ name: "Index on non-allowlisted column", status: invalidColumn.status, expected: 400, actual: invalidColumn.status });
    return "Destructive, multi-statement, table-copy, rename, and unapproved-column submissions are rejected";
  });

  await verify("Repeated migration name is idempotently skipped", async () => {
    await page.getByLabel("Migration name").fill("e2e_verified_credits_index");
    await page.getByLabel("SQL statement").fill("CREATE INDEX IF NOT EXISTS idx_e2e_credits_last_updated ON credits(last_updated DESC);");
    await page.getByRole("checkbox", { name: /I reviewed this SQL and understand it will execute/i }).check();
    await page.getByRole("button", { name: /Apply migration/i }).click();
    await page.locator(".inline-success").filter({ hasText: "no SQL was applied" }).first().waitFor({ state: "visible" });
    expectApi("POST", "/api/schema/apply", 200);
    assert.equal(sqlValue("SELECT count(*) FROM schema_migrations WHERE migration_name='e2e_verified_credits_index';"), "1");
    return "Second request was skipped; exactly one migration row remains";
  });

  await verify("Production-built dashboard and navigation work at mobile width", async () => {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(baseUrl + "/dashboard", { waitUntil: "networkidle" });
    await mobile.getByLabel("Email address").fill(testEmail);
    await mobile.locator("#auth-password").fill(testPassword);
    await mobile.locator(".auth-form").getByRole("button", { name: /Sign in to workspace/i }).click();
    await waitForBalance(mobile, 0);
    await mobile.locator("#credit-admin-key").fill(creditAdminKey);
    await takeScreenshot(mobile, "13-mobile-dashboard.png");
    await mobile.getByRole("button", { name: "Open navigation" }).click();
    await mobile.getByRole("navigation", { name: "Main navigation" }).waitFor({ state: "visible" });
    await takeScreenshot(mobile, "14-mobile-navigation.png");
    assert.ok(apiRequests.some((item) => item.method === "GET" && item.path === "/api/credits/1" && item.status === 200));
    await mobile.close();
    return "390×844 viewport rendered; account was loaded through GET /api/credits/1";
  });

  await verify("Logout revokes the active database session", async () => {
    const logout = await fetch(apiBaseUrl + "/api/auth/logout", {
      method: "POST",
      headers: { Authorization: "Bearer " + testToken }
    });
    assert.equal(logout.status, 200);
    const stale = await fetch(apiBaseUrl + "/api/auth/me", {
      headers: { Authorization: "Bearer " + testToken }
    });
    assert.equal(stale.status, 401);
    directApiChecks.push({ name: "Session logout", status: logout.status, expected: 200, actual: logout.status });
    directApiChecks.push({ name: "Revoked session reuse", status: stale.status, expected: 401, actual: stale.status });
    return "Logout revokes the server-side session; reuse of the old token returns 401";
  });

  await verify("Daily scheduler logic updates the isolated database", async () => {
    sqlValue("INSERT INTO users (user_id,email,name) VALUES (2,'scheduler-e2e@example.invalid','Scheduler Test User') ON CONFLICT (user_id) DO NOTHING; SELECT setval(pg_get_serial_sequence('users','user_id'), (SELECT MAX(user_id) FROM users), true);");
    const scheduler = spawnSync("python", ["-c", "from src.scheduler import add_daily_credits; first=add_daily_credits(); second=add_daily_credits(); assert first is True and second is False"], {
      cwd: backendRoot, encoding: "utf8", env: process.env
    });
    assert.equal(scheduler.status, 0, "Scheduler failed: " + (scheduler.stderr || scheduler.stdout));
    const state = sqlValue("SELECT user_id || ':' || credits FROM credits ORDER BY user_id;");
    assert.equal(state, "1:5\n2:5");
    const runCount = sqlValue("SELECT count(*) FROM credit_daily_runs;");
    assert.equal(runCount, "1", "Daily scheduler should record the UTC run only once.");
    dbChecks.push({ check: "Scheduler increments existing and creates missing credit rows", status: "passed", expected: "1:5 and 2:5", actual: state });
    dbChecks.push({ check: "Repeated scheduler invocation is idempotent", status: "passed", expected: "one run and balances 1:5, 2:5", actual: runCount + " run; " + state });
    return "Scheduler adds 5 credits once per UTC day and skips repeated or parallel duplicate executions";
  });

  await verify("No uncaught browser JavaScript errors occurred", async () => {
    assert.deepEqual(browserErrors, []);
    return "0 page errors";
  });

  await verify("All implemented frontend API operations were observed against the real backend", async () => {
    const required = [
      ["GET", "/healthz", 200],
      ["GET", "/api/credits/1", 200],
      ["POST", "/api/credits/1/add", 200],
      ["POST", "/api/credits/1/deduct", 200],
      ["PATCH", "/api/credits/1/reset", 200],
      ["GET", "/api/credits/999999", 404],
      ["POST", "/api/auth/register", 201],
      ["GET", "/api/auth/me", 200],
      ["GET", "/api/schema/migrations", 401],
      ["GET", "/api/schema/migrations", 200],
      ["POST", "/api/schema/apply", 200]
    ];
    for (const item of required) expectApi(item[0], item[1], item[2]);
    assert.ok(apiRequests.length >= 10, "Only " + apiRequests.length + " browser API responses were observed.");
    return apiRequests.length + " browser-observed HTTP responses; no API route mocks";
  });
}

try {
  await run();
} catch (error) {
  fatalError = error;
  console.error(error && error.stack ? error.stack : error);
} finally {
  if (browser) {
    try { await browser.close(); } catch {}
  }
  const status = fatalError ? "FAILED" : "PASSED";
  try {
    await writeReports(status, fatalError ? String(fatalError.message || fatalError) : "");
  } catch (reportError) {
    console.error("Unable to write report files: " + String(reportError && reportError.message ? reportError.message : reportError));
    if (!fatalError) fatalError = reportError;
  }
  console.log("Captured screenshots: " + capturedScreenshots.length);
  console.log("Browser-observed backend responses: " + apiRequests.length);
  console.log("Completed assertions: " + checks.filter((item) => item.status === "passed").length);
  console.log("Failed assertions: " + checks.filter((item) => item.status === "failed").length);
}

if (fatalError) process.exitCode = 1;

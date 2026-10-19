import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Coins,
  Database,
  ExternalLink,
  Gauge,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  Menu,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import {
  API_BASE_URL,
  ApiError,
  addCredits,
  applyMigration,
  deductCredits,
  getApiHealth,
  getCredits,
  listMigrations,
  resetCredits,
} from "./api";
import type {
  CreditAccount,
  CreditOperation,
  SchemaMigration,
} from "./types";

type Page = "overview" | "admin";
type ApiState = "checking" | "online" | "offline";
type Notice = { kind: "success" | "error"; text: string };

const creditNumber = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function formatCredits(value: number): string {
  return creditNumber.format(value);
}

function formatTimestamp(value?: string): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}


function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function operationTitle(operation: CreditOperation): string {
  if (operation === "add") return "Add credits";
  if (operation === "deduct") return "Deduct credits";
  return "Reset balance";
}

function App() {
  const [page, setPage] = useState<Page>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [draftUserId, setDraftUserId] = useState("1");
  const [activeUserId, setActiveUserId] = useState(1);
  const [account, setAccount] = useState<CreditAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountError, setAccountError] = useState("");
  const [apiState, setApiState] = useState<ApiState>("checking");
  const [activeOperation, setActiveOperation] = useState<CreditOperation | null>(null);
  const [amount, setAmount] = useState("25");
  const [operationLoading, setOperationLoading] = useState(false);
  const [operationError, setOperationError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const [adminKey, setAdminKey] = useState("");
  const [migrations, setMigrations] = useState<SchemaMigration[] | null>(null);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [migrationName, setMigrationName] = useState("");
  const [migrationSql, setMigrationSql] = useState("");
  const [confirmSql, setConfirmSql] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [adminNotice, setAdminNotice] = useState("");

  const loadAccount = useCallback(async (userId: number) => {
    setAccountLoading(true);
    setAccountError("");
    setAccount(null);
    setActiveUserId(userId);
    setDraftUserId(String(userId));
    try {
      const nextAccount = await getCredits(userId);
      setAccount(nextAccount);
      setApiState("online");
    } catch (error) {
      setAccountError(getErrorMessage(error));
      setApiState(error instanceof ApiError && error.status ? "online" : "offline");
    } finally {
      setAccountLoading(false);
    }
  }, []);

  const checkApi = useCallback(async () => {
    setApiState("checking");
    try {
      await getApiHealth();
      setApiState("online");
    } catch {
      setApiState("offline");
    }
  }, []);

  useEffect(() => {
    void checkApi();
    void loadAccount(1);
  }, [checkApi, loadAccount]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileNavOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavOpen]);

  function showNotice(kind: Notice["kind"], text: string) {
    setNotice({ kind, text });
  }

  function handleUserSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const userId = Number(draftUserId);
    if (!Number.isSafeInteger(userId) || userId < 1) {
      setAccountError("Enter a valid positive user ID.");
      setAccount(null);
      return;
    }
    void loadAccount(userId);
    setMobileNavOpen(false);
  }

  function startOperation(operation: CreditOperation) {
    setOperationError("");
    setAmount("25");
    setConfirmReset(false);
    setActiveOperation(operation);
  }

  async function submitOperation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeOperation || !account) return;

    const parsedAmount = Number(amount);
    if (activeOperation !== "reset" && (!Number.isSafeInteger(parsedAmount) || parsedAmount < 1)) {
      setOperationError("Enter a whole number greater than zero.");
      return;
    }

    if (activeOperation === "deduct" && parsedAmount > account.credits) {
      setOperationError("The deduction cannot be greater than the available balance.");
      return;
    }

    setOperationLoading(true);
    setOperationError("");
    try {
      let updated: CreditAccount;
      if (activeOperation === "add") {
        updated = await addCredits(activeUserId, parsedAmount);
      } else if (activeOperation === "deduct") {
        updated = await deductCredits(activeUserId, parsedAmount);
      } else {
        updated = await resetCredits(activeUserId);
      }

      setAccount(updated);
      setApiState("online");
      setActiveOperation(null);
      showNotice(
        "success",
        activeOperation === "reset"
          ? "The credit balance has been reset."
          : `${formatCredits(parsedAmount)} credits ${activeOperation === "add" ? "added to" : "deducted from"} user #${activeUserId}.`,
      );
    } catch (error) {
      setOperationError(getErrorMessage(error));
      if (!(error instanceof ApiError) || !error.status) setApiState("offline");
    } finally {
      setOperationLoading(false);
    }
  }

  async function loadMigrationHistory(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!adminKey.trim()) {
      setAdminError("Enter the admin API key configured on the backend.");
      return;
    }

    setMigrationLoading(true);
    setAdminError("");
    setAdminNotice("");
    try {
      const result = await listMigrations(adminKey.trim());
      setMigrations(result.migrations);
      setApiState("online");
    } catch (error) {
      setAdminError(getErrorMessage(error));
      setMigrations(null);
      if (!(error instanceof ApiError) || !error.status) setApiState("offline");
    } finally {
      setMigrationLoading(false);
    }
  }

  async function submitMigration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminKey.trim()) {
      setAdminError("Enter the admin API key first.");
      return;
    }
    if (!migrationName.trim() || !migrationSql.trim()) {
      setAdminError("Provide both a migration name and SQL statement.");
      return;
    }
    if (!confirmSql) {
      setAdminError("Confirm that you understand this SQL will execute against the database.");
      return;
    }

    setApplyLoading(true);
    setAdminError("");
    setAdminNotice("");
    try {
      const result = await applyMigration(adminKey.trim(), migrationName.trim(), migrationSql.trim());
      setAdminNotice(
        result.status === "skipped"
          ? `"${result.migration_name}" was already recorded; no SQL was applied.`
          : `Migration "${result.migration_name}" was applied successfully.`,
      );
      setMigrationName("");
      setMigrationSql("");
      setConfirmSql(false);
      const history = await listMigrations(adminKey.trim());
      setMigrations(history.migrations);
      setApiState("online");
    } catch (error) {
      setAdminError(getErrorMessage(error));
      if (!(error instanceof ApiError) || !error.status) setApiState("offline");
    } finally {
      setApplyLoading(false);
    }
  }

  function changePage(nextPage: Page) {
    setPage(nextPage);
    setMobileNavOpen(false);
  }

  const apiStatusLabel =
    apiState === "online" ? "API connected" : apiState === "checking" ? "Connecting…" : "API offline";

  return (
    <div className="app-shell">
      {mobileNavOpen && (
        <button
          type="button"
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><Coins size={21} strokeWidth={2.2} /></div>
          <div className="brand-copy">
            <span className="brand-name">mintline<span>.</span></span>
            <span className="brand-subtitle">CREDIT WORKSPACE</span>
          </div>
          <button
            type="button"
            className="icon-button sidebar-close"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <nav id="primary-navigation" className="main-nav" aria-label="Main navigation">
          <button
            type="button"
            className={`nav-link ${page === "overview" ? "active" : ""}`}
            onClick={() => changePage("overview")}
          >
            <LayoutDashboard size={18} />
            <span>Overview</span>
            {page === "overview" && <span className="nav-active-dot" />}
          </button>
          <button
            type="button"
            className={`nav-link ${page === "admin" ? "active" : ""}`}
            onClick={() => changePage("admin")}
          >
            <Database size={18} />
            <span>Admin & migrations</span>
            <span className="nav-lock"><LockKeyhole size={13} /></span>
          </button>
        </nav>

        <div className="sidebar-divider" />
        <div className="workspace-label">YOUR CONNECTION</div>
        <div className="sidebar-connection">
          <span className={`status-dot ${apiState}`} />
          <div className="connection-copy">
            <strong>{apiStatusLabel}</strong>
            <span>{API_BASE_URL.replace(/^https?:\/\//, "")}</span>
          </div>
          <button
            type="button"
            className="mini-icon-button"
            aria-label="Check API connection"
            onClick={() => void checkApi()}
            title="Check API connection"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="sidebar-spacer" />
        <div className="sidebar-help-card">
          <div className="help-icon"><Sparkles size={16} /></div>
          <strong>Keep your credits in check.</strong>
          <p>A clear view of balances, without the busywork.</p>
          <a href={`${API_BASE_URL}/docs`} target="_blank" rel="noreferrer">
            Explore API docs <ArrowRight size={14} />
          </a>
        </div>
        <div className="sidebar-footer">
          <div className="avatar avatar-small">ML</div>
          <div className="footer-user">
            <strong>Mintline workspace</strong>
            <span>Credit operations</span>
          </div>
          <span className="footer-status" aria-label="Workspace ready"><CircleCheck size={16} /></span>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            {!mobileNavOpen && (
              <button
                type="button"
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                aria-controls="primary-navigation"
                aria-expanded={false}
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu size={20} />
              </button>
            )}
            <div className="breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={14} />
              <strong>{page === "overview" ? "Overview" : "Admin & migrations"}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <div className={`connection-pill ${apiState}`}>
              <span className={`status-dot ${apiState}`} />
              {apiStatusLabel}
            </div>
            <a className="icon-button topbar-docs" href={`${API_BASE_URL}/docs`} target="_blank" rel="noreferrer" aria-label="Open API documentation" title="API documentation">
              <ExternalLink size={17} />
            </a>
            <div className="avatar topbar-avatar">ML</div>
          </div>
        </header>

        <div className="content-wrap">
          {notice && (
            <div className={`toast toast-${notice.kind}`} role="status">
              {notice.kind === "success" ? <CircleCheck size={18} /> : <CircleAlert size={18} />}
              <span>{notice.text}</span>
              <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={() => setNotice(null)}>
                <X size={16} />
              </button>
            </div>
          )}

          {page === "overview" ? (
            <>
              <section className="page-heading">
                <div>
                  <div className="eyebrow"><span className="eyebrow-line" /> YOUR CREDIT CONTROL CENTER</div>
                  <h1>Credit overview<span className="heading-period">.</span></h1>
                  <p>Everything you need to manage balances, in one clear view.</p>
                </div>
                <div className="heading-actions">
                  <button
                    type="button"
                    className="button button-secondary refresh-button"
                    onClick={() => {
                      void checkApi();
                      void loadAccount(activeUserId);
                    }}
                    disabled={accountLoading}
                  >
                    {accountLoading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
                    Refresh
                  </button>
                </div>
              </section>

              <section className="toolbar-card">
                <div className="toolbar-context">
                  <div className="toolbar-icon"><Gauge size={18} /></div>
                  <div>
                    <strong>Account lookup</strong>
                    <span>Open an existing user by ID</span>
                  </div>
                </div>
                <form className="user-search-form" onSubmit={handleUserSearch}>
                  <label className="sr-only" htmlFor="user-id">User ID</label>
                  <span className="search-leading"><SearchIcon /></span>
                  <input
                    id="user-id"
                    inputMode="numeric"
                    value={draftUserId}
                    onChange={(event) => setDraftUserId(event.target.value)}
                    placeholder="Enter user ID"
                    aria-label="User ID"
                  />
                  <button className="button button-dark button-small" type="submit" disabled={accountLoading}>
                    Open account <ArrowRight size={15} />
                  </button>
                </form>
              </section>

              {accountError && (
                <div className="error-banner" role="alert">
                  <div className="error-banner-icon"><CircleAlert size={18} /></div>
                  <div>
                    <strong>{accountError}</strong>
                    <p>
                      {apiState === "offline"
                        ? "Start the FastAPI backend and confirm VITE_API_BASE_URL and CORS_ORIGINS."
                        : accountError.toLowerCase().includes("user not found")
                          ? "This API does not create users. Enter an ID that already exists in the backend users table."
                          : "The API responded but could not load this account. Check the error above and the backend logs."}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="icon-button error-retry"
                    onClick={() => void loadAccount(activeUserId)}
                    aria-label="Retry account lookup"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              )}

              <section className="overview-grid">
                <article className="balance-card">
                  <div className="balance-card-top">
                    <div className="balance-label">
                      <span className="balance-label-icon"><WalletIcon /></span>
                      <span>AVAILABLE BALANCE</span>
                    </div>
                    <span className="live-tag"><span className="live-dot" /> LIVE ACCOUNT</span>
                  </div>

                  <div className="balance-value-row">
                    <div>
                      <div className="balance-number">
                        {accountLoading ? <span className="balance-skeleton" /> : account ? formatCredits(account.credits) : "—"}
                      </div>
                      <div className="balance-unit">credits available</div>
                    </div>
                    <div className="balance-orbit" aria-hidden="true">
                      <div className="orbit-ring ring-one" />
                      <div className="orbit-ring ring-two" />
                      <div className="orbit-core"><Coins size={30} /></div>
                      <span className="orbit-star star-one">✦</span>
                      <span className="orbit-star star-two">✧</span>
                    </div>
                  </div>

                  <div className="balance-card-bottom">
                    <div className="balance-meta">
                      <span className="meta-label">ACCOUNT ID</span>
                      <strong>{account ? `#${account.user_id}` : "—"}</strong>
                    </div>
                    <div className="balance-meta">
                      <span className="meta-label">LAST UPDATED</span>
                      <strong>{accountLoading ? "Syncing…" : account ? formatTimestamp(account.last_updated) : "—"}</strong>
                    </div>
                    <div className="balance-mark"><Zap size={16} fill="currentColor" /></div>
                  </div>
                </article>

                <article className="operations-panel">
                  <div className="section-card-header">
                    <div>
                      <span className="card-kicker">CREDIT OPERATIONS</span>
                      <h2>Manage balance</h2>
                      <p className="operations-intro">Choose an action for account #{activeUserId}.</p>
                    </div>
                    <span className="snapshot-badge"><Coins size={16} /></span>
                  </div>
                  <div className="actions-grid">
                    <button
                      type="button"
                      className="operation-card operation-add"
                      onClick={() => startOperation("add")}
                      disabled={!account || accountLoading}
                    >
                      <span className="operation-icon"><Plus size={19} /></span>
                      <span className="operation-copy">
                        <strong>Add credits</strong>
                        <span>Increase the available balance</span>
                      </span>
                      <span className="operation-arrow"><ArrowUpRight size={17} /></span>
                    </button>
                    <button
                      type="button"
                      className="operation-card operation-deduct"
                      onClick={() => startOperation("deduct")}
                      disabled={!account || accountLoading}
                    >
                      <span className="operation-icon"><ArrowDownLeft size={19} /></span>
                      <span className="operation-copy">
                        <strong>Deduct credits</strong>
                        <span>Subtract from available credits</span>
                      </span>
                      <span className="operation-arrow"><ArrowUpRight size={17} /></span>
                    </button>
                    <button
                      type="button"
                      className="operation-card operation-reset"
                      onClick={() => startOperation("reset")}
                      disabled={!account || accountLoading}
                    >
                      <span className="operation-icon"><RotateCcw size={18} /></span>
                      <span className="operation-copy">
                        <strong>Reset balance</strong>
                        <span>Set the balance to zero</span>
                      </span>
                      <span className="operation-arrow"><ArrowUpRight size={17} /></span>
                    </button>
                  </div>
                  <div className="operations-note">
                    <ShieldCheck size={15} />
                    <span>Changes are applied by the connected API. Deduction cannot exceed the current balance.</span>
                  </div>
                </article>
              </section>

              <footer className="page-footer">
                <span>© 2026 Mintline <span className="footer-separator">·</span> Credit operations, made clear.</span>
                <a href={`${API_BASE_URL}/docs`} target="_blank" rel="noreferrer">API reference <ExternalLink size={13} /></a>
              </footer>
            </>
          ) : (
            <section className="admin-page">
              <div className="page-heading">
                <div>
                  <div className="eyebrow"><span className="eyebrow-line" /> PRIVILEGED OPERATIONS</div>
                  <h1>Admin & migrations<span className="heading-period">.</span></h1>
                  <p>Review schema migration records and apply a controlled update.</p>
                </div>
                <span className="admin-heading-icon"><ShieldCheck size={22} /></span>
              </div>

              <div className="security-banner">
                <div className="security-banner-icon"><LockKeyhole size={19} /></div>
                <div>
                  <strong>High-privilege database access</strong>
                  <p>The backend executes submitted SQL using its configured database role. Only use this screen in a trusted admin environment with a least-privileged database account. Your key stays in component memory and is never saved by this app.</p>
                </div>
              </div>

              <section className="admin-card">
                <div className="admin-card-heading">
                  <div className="admin-card-icon"><ShieldCheck size={18} /></div>
                  <div>
                    <h2>Connect as an administrator</h2>
                    <p>Enter the <code>ADMIN_API_KEY</code> configured on the backend.</p>
                  </div>
                </div>
                <form className="admin-key-form" onSubmit={loadMigrationHistory}>
                  <label htmlFor="admin-key">Admin API key</label>
                  <div className="admin-key-row">
                    <input
                      id="admin-key"
                      type="password"
                      autoComplete="off"
                      value={adminKey}
                      onChange={(event) => setAdminKey(event.target.value)}
                      placeholder="Enter key for this session"
                    />
                    <button className="button button-dark" type="submit" disabled={migrationLoading}>
                      {migrationLoading ? <LoaderCircle className="spin" size={16} /> : <Database size={16} />}
                      Load migration history
                    </button>
                  </div>
                  <span className="field-helper">Not saved to local storage, cookies, or build configuration.</span>
                </form>
                {adminError && <div className="inline-error" role="alert"><CircleAlert size={16} />{adminError}</div>}
                {adminNotice && <div className="inline-success" role="status"><CircleCheck size={16} />{adminNotice}</div>}
              </section>

              <section className="admin-card migration-history-card">
                <div className="admin-section-heading">
                  <div>
                    <span className="card-kicker">DATABASE CHANGE LOG</span>
                    <h2>Migration history</h2>
                    <p>Entries returned by the backend's schema migrations endpoint.</p>
                  </div>
                  {migrations && <span className="history-count">{migrations.length} recorded</span>}
                </div>

                {migrationLoading ? (
                  <div className="admin-loading"><LoaderCircle className="spin" size={20} /> Loading migration records…</div>
                ) : migrations === null ? (
                  <div className="admin-empty">
                    <div className="empty-activity-icon"><Database size={21} /></div>
                    <strong>Connect to view migrations</strong>
                    <p>Enter your admin key above to load applied schema migrations from the backend.</p>
                  </div>
                ) : migrations.length === 0 ? (
                  <div className="admin-empty">
                    <div className="empty-activity-icon"><Database size={21} /></div>
                    <strong>No migrations recorded yet</strong>
                    <p>When the backend records a schema migration, it will be listed here.</p>
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table className="migration-table">
                      <thead>
                        <tr><th>Migration</th><th>Record ID</th><th>Applied at</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {migrations.map((migration) => (
                          <tr key={migration.id}>
                            <td><strong>{migration.migration_name}</strong></td>
                            <td><span className="record-id">#{migration.id}</span></td>
                            <td>{formatTimestamp(migration.applied_at)}</td>
                            <td><span className="migration-status"><Check size={13} /> Recorded</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="admin-card apply-card">
                <div className="admin-section-heading">
                  <div>
                    <span className="card-kicker">ADVANCED ACTION</span>
                    <h2>Apply a schema migration</h2>
                    <p>Use only reviewed SQL from a trusted source.</p>
                  </div>
                  <span className="danger-outline"><LockKeyhole size={14} /> Elevated access</span>
                </div>

                <form className="migration-form" onSubmit={submitMigration}>
                  <div className="form-field">
                    <label htmlFor="migration-name">Migration name</label>
                    <input
                      id="migration-name"
                      value={migrationName}
                      maxLength={200}
                      onChange={(event) => setMigrationName(event.target.value)}
                      placeholder="e.g. add_credits_updated_index"
                    />
                    <span className="field-helper">Unique name used by the backend to avoid applying the same migration twice.</span>
                  </div>
                  <div className="form-field">
                    <label htmlFor="migration-sql">SQL statement</label>
                    <textarea
                      id="migration-sql"
                      value={migrationSql}
                      onChange={(event) => setMigrationSql(event.target.value)}
                      placeholder="CREATE INDEX IF NOT EXISTS ..."
                      rows={5}
                      spellCheck={false}
                    />
                    <span className="field-helper">The database role's permissions determine what this SQL can change.</span>
                  </div>
                  <label className="confirm-line">
                    <input type="checkbox" checked={confirmSql} onChange={(event) => setConfirmSql(event.target.checked)} />
                    <span>I reviewed this SQL and understand it will execute against the configured database.</span>
                  </label>
                  {adminError && <div className="inline-error" role="alert"><CircleAlert size={16} />{adminError}</div>}
                  {adminNotice && <div className="inline-success" role="status"><CircleCheck size={16} />{adminNotice}</div>}
                  <div className="migration-submit-row">
                    <span><CircleAlert size={15} /> This action cannot be undone by the frontend.</span>
                    <button className="button button-danger" type="submit" disabled={applyLoading}>
                      {applyLoading ? <LoaderCircle className="spin" size={16} /> : <Database size={16} />}
                      Apply migration
                    </button>
                  </div>
                </form>
              </section>

              <footer className="page-footer">
                <span>© 2026 Mintline <span className="footer-separator">·</span> Admin actions are audited by the backend migration table.</span>
                <button type="button" className="text-action" onClick={() => changePage("overview")}>Back to overview <ArrowRight size={14} /></button>
              </footer>
            </section>
          )}
        </div>
      </main>

      {activeOperation && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !operationLoading) setActiveOperation(null);
        }}>
          <section className="operation-modal" role="dialog" aria-modal="true" aria-labelledby="operation-modal-title">
            <div className={`modal-symbol modal-symbol-${activeOperation}`}>
              {activeOperation === "add" ? <Plus size={22} /> : activeOperation === "deduct" ? <ArrowDownLeft size={22} /> : <RotateCcw size={21} />}
            </div>
            <button type="button" className="icon-button modal-close" onClick={() => setActiveOperation(null)} aria-label="Close dialog" disabled={operationLoading}>
              <X size={18} />
            </button>
            <form onSubmit={submitOperation}>
            <span className="card-kicker">USER #{activeUserId}</span>
            <h2 id="operation-modal-title">{operationTitle(activeOperation)}</h2>
            <p className="modal-description">
              {activeOperation === "add"
                ? "Add credits to this account. The updated balance will be returned by the API."
                : activeOperation === "deduct"
                  ? "Deduct credits from the current balance. The backend prevents negative balances."
                  : "This will set the account's current balance to zero. This action takes effect immediately."}
            </p>
            {activeOperation === "reset" ? (
              <div className="reset-summary">
                <span>Current balance</span>
                <strong>{formatCredits(account?.credits ?? 0)} <small>credits</small></strong>
                <span className="reset-new-balance">New balance <strong>0 credits</strong></span>
              </div>
            ) : (
              <>
                <label className="modal-field-label" htmlFor="operation-amount">Amount to {activeOperation === "add" ? "add" : "deduct"}</label>
                <div className="amount-input-wrap">
                  <input
                    id="operation-amount"
                    autoFocus
                    type="number"
                    min="1"
                    step="1"
                    max={activeOperation === "deduct" ? account?.credits : undefined}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    aria-describedby="amount-helper"
                  />
                  <span>credits</span>
                </div>
                <span className="field-helper" id="amount-helper">
                  Available balance: {formatCredits(account?.credits ?? 0)} credits
                </span>
              </>
            )}
            {activeOperation === "reset" && (
              <label className="confirm-line reset-confirm">
                <input type="checkbox" checked={confirmReset} onChange={(event) => setConfirmReset(event.target.checked)} />
                <span>I understand the current balance will be cleared.</span>
              </label>
            )}
            {operationError && <div className="inline-error modal-error" role="alert"><CircleAlert size={16} />{operationError}</div>}
              <div className="modal-actions">
                <button type="button" className="button button-secondary" onClick={() => setActiveOperation(null)} disabled={operationLoading}>Cancel</button>
                <button
                  type="submit"
                  className={`button ${activeOperation === "reset" ? "button-danger" : "button-dark"}`}
                  disabled={operationLoading || (activeOperation === "reset" && !confirmReset)}
                >
                  {operationLoading ? <LoaderCircle className="spin" size={16} /> : activeOperation === "add" ? <Plus size={16} /> : activeOperation === "deduct" ? <ArrowDownLeft size={16} /> : <RotateCcw size={16} />}
                  {operationLoading ? "Applying…" : activeOperation === "reset" ? "Reset balance" : `Confirm ${activeOperation === "add" ? "addition" : "deduction"}`}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return <Search size={16} />;
}

function WalletIcon() {
  return <Coins size={16} />;
}

export default App;

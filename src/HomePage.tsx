import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, Check, ChevronRight, Coins,
  Database, ExternalLink, LockKeyhole, Plus, RotateCcw, ShieldCheck, Zap,
} from "lucide-react";
import "./home.css";

interface HomePageProps { onOpenDashboard: () => void; }

const capabilities = [
  { number: "01", icon: Coins, title: "Read the real balance", description: "Review your own balance and last-updated time from the connected API.", endpoint: "GET /api/credits/{user_id}", tone: "mint" },
  { number: "02", icon: Zap, title: "Make controlled changes", description: "Add credits, deduct credits, or reset a balance. The UI updates from the API response.", endpoint: "POST · PATCH /api/credits", tone: "sand" },
  { number: "03", icon: Database, title: "Manage schema migrations", description: "Review migration records and access the existing admin-only schema endpoints with your API key.", endpoint: "GET · POST /api/schema", tone: "lilac" },
];

function Brand() {
  return (
    <a className="home-brand" href="/" aria-label="Mintline home">
      <span className="home-brand-mark"><Coins size={21} strokeWidth={2.2} /></span>
      <span className="home-brand-copy">
        <span className="home-brand-name">mintline<span>.</span></span>
        <span className="home-brand-subtitle">CREDIT WORKSPACE</span>
      </span>
    </a>
  );
}

export default function HomePage({ onOpenDashboard }: HomePageProps) {
  return (
    <div className="home-page">
      <header className="home-header">
        <div className="home-header-inner">
          <Brand />
          <nav className="home-nav" aria-label="Home page navigation">
            <a href="#capabilities">Capabilities</a>
            <a href="#integration">Integration</a>
          </nav>
          <button type="button" className="home-header-cta" onClick={onOpenDashboard}>
            Open workspace <ArrowUpRight size={16} />
          </button>
        </div>
      </header>

      <main>
        <section className="home-hero">
          <div className="home-hero-grid" aria-hidden="true" />
          <div className="home-hero-inner">
            <div className="home-hero-copy">
              <div className="home-eyebrow"><span /> A CLEARER WAY TO MANAGE CREDITS</div>
              <h1>Credit operations,<br /><span>without the clutter.</span></h1>
              <p className="home-hero-description">
                A focused interface for your credit-management API. Sign in to review your balance
                and apply controlled credit changes through the connected backend.
              </p>
              <div className="home-hero-actions">
                <button type="button" className="home-primary-cta" onClick={onOpenDashboard}>
                  Open credit dashboard <ArrowRight size={17} />
                </button>
                <a className="home-secondary-cta" href="https://github.com/faizansaiyed123/backend-intern-credits" target="_blank" rel="noreferrer">
                  Explore the backend <ExternalLink size={16} />
                </a>
              </div>
              <div className="home-stack-note">
                <span className="stack-mark">API</span>
                <span>FastAPI + PostgreSQL</span><span className="stack-separator">·</span>
                <span>Real API data, not demo metrics</span>
              </div>
            </div>

            <div className="home-visual" aria-label="Illustration of the Mintline credit dashboard">
              <div className="visual-glow" />
              <div className="visual-floating-label"><span className="visual-live-dot" /> BUILT AROUND YOUR API</div>
              <div className="visual-window">
                <div className="visual-window-top">
                  <div className="visual-window-dots"><i /><i /><i /></div>
                  <span>mintline / workspace</span>
                  <span className="visual-window-lock"><LockKeyhole size={12} /></span>
                </div>
                <div className="visual-window-content">
                  <div className="visual-account-top">
                    <div><span className="visual-micro-label">ACCOUNT BALANCE</span><span className="visual-account-caption">Live value in the dashboard</span></div>
                    <span className="visual-account-icon"><Coins size={18} /></span>
                  </div>
                  <div className="visual-balance-placeholder"><span>—</span><small>credits</small></div>
                  <div className="visual-value-note"><span className="visual-note-dot" /> Read from the selected account</div>
                  <div className="visual-divider" />
                  <div className="visual-actions-label">SUPPORTED OPERATIONS</div>
                  <div className="visual-operation">
                    <span className="visual-operation-icon visual-add"><Plus size={15} /></span>
                    <span><strong>Add credits</strong><small>Increase balance</small></span><ArrowUpRight size={15} className="visual-operation-arrow" />
                  </div>
                  <div className="visual-operation">
                    <span className="visual-operation-icon visual-deduct"><ArrowDownLeft size={15} /></span>
                    <span><strong>Deduct credits</strong><small>Block negative balances</small></span><ArrowUpRight size={15} className="visual-operation-arrow" />
                  </div>
                  <div className="visual-operation">
                    <span className="visual-operation-icon visual-reset"><RotateCcw size={15} /></span>
                    <span><strong>Reset balance</strong><small>Confirm before clearing</small></span><ArrowUpRight size={15} className="visual-operation-arrow" />
                  </div>
                </div>
                <div className="visual-window-foot">
                  <span><ShieldCheck size={13} /> API-backed actions</span>
                  <span><Check size={13} /> No fake metrics</span>
                </div>
              </div>
              <div className="visual-orbit visual-orbit-one" />
              <div className="visual-orbit visual-orbit-two" />
            </div>
          </div>
          <div className="home-hero-bottom"><span>BUILT FOR CLARITY</span><span className="home-bottom-rule" /><span>01 / 03 CORE CAPABILITIES</span></div>
        </section>

        <section className="home-capabilities home-section" id="capabilities">
          <div className="home-section-heading">
            <div>
              <div className="home-eyebrow home-eyebrow-light"><span /> WHAT THE API SUPPORTS</div>
              <h2>Everything has a purpose.<br /><span>Nothing is made up.</span></h2>
            </div>
            <p>The experience stays intentionally small: each control maps to an endpoint in your backend, instead of filling the screen with features the service cannot provide.</p>
          </div>
          <div className="home-capability-grid">
            {capabilities.map((item) => {
              const Icon = item.icon;
              return (
                <article className="home-capability-card" key={item.number}>
                  <div className="home-capability-card-top">
                    <span className={`home-capability-icon tone-${item.tone}`}><Icon size={20} /></span>
                    <span className="home-capability-number">{item.number}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <div className="home-endpoint"><span />{item.endpoint}</div>
                </article>
              );
            })}
          </div>
          <div className="home-truth-note">
            <div className="truth-note-icon"><Check size={17} /></div>
            <p><strong>Designed around the real contract.</strong> Accounts have their own sign-in session. Credit operations are restricted to the authenticated account; the service does not expose a credit transaction history.</p>
          </div>
        </section>

        <section className="home-integration home-section" id="integration">
          <div className="home-integration-copy">
            <div className="home-eyebrow home-eyebrow-light"><span /> SIMPLE BY DESIGN</div>
            <h2>Your backend stays<br /><span>the source of truth.</span></h2>
            <p>Mintline is a presentation layer over your existing FastAPI service. Balances are fetched from the API, mutations are sent to the API, and the interface reflects the response.</p>
            <button type="button" className="home-primary-cta" onClick={onOpenDashboard}>Go to the dashboard <ArrowRight size={17} /></button>
          </div>
          <div className="home-flow-card">
            <div className="home-flow-heading"><span className="home-flow-heading-icon"><Database size={18} /></span><span><strong>Request flow</strong><small>How the workspace works</small></span></div>
            <div className="home-flow-step"><span className="home-flow-step-number">01</span><div><strong>Sign in to your account</strong><small>Load your account securely</small></div><span className="home-flow-tag">INPUT</span></div>
            <div className="home-flow-connector"><span /></div>
            <div className="home-flow-step"><span className="home-flow-step-number">02</span><div><strong>Call the credit API</strong><small>Read or mutate the balance</small></div><span className="home-flow-tag">FASTAPI</span></div>
            <div className="home-flow-connector"><span /></div>
            <div className="home-flow-step"><span className="home-flow-step-number">03</span><div><strong>Render the response</strong><small>Show the returned balance</small></div><span className="home-flow-tag">UI</span></div>
            <div className="home-flow-foot"><Zap size={15} /><span>One source of truth. No shadow balances.</span></div>
          </div>
        </section>

        <section className="home-final-cta">
          <div className="home-final-cta-copy">
            <span className="home-final-kicker">READY WHEN YOU ARE</span>
            <h2>Make every credit change<br />with confidence.</h2>
            <p>Open the workspace to connect to your running API.</p>
          </div>
          <button type="button" className="home-final-button" onClick={onOpenDashboard}>Open workspace <ArrowRight size={17} /></button>
          <div className="home-final-decoration" aria-hidden="true"><Coins size={72} /></div>
        </section>
      </main>

      <footer className="home-footer">
        <Brand />
        <span>Credit management, made clear.</span>
        <a href="https://github.com/faizansaiyed123/backend-intern-credits" target="_blank" rel="noreferrer">Backend source <ChevronRight size={14} /></a>
        <span className="home-footer-copyright">© 2026 Mintline</span>
      </footer>
    </div>
  );
}

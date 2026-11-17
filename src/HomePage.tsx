import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Coins,
  Database,
  ExternalLink,
  LockKeyhole,
  Zap,
} from 'lucide-react';
import './home.css';

interface HomePageProps {
  onOpenDashboard: () => void;
}

const capabilities = [
  {
    number: '01',
    label: 'READ',
    icon: Coins,
    title: 'Read the real balance',
    description: 'Review the selected account’s current balance and last-updated time from the connected API.',
    endpoint: 'GET /api/credits/{user_id}',
  },
  {
    number: '02',
    label: 'CHANGE',
    icon: Zap,
    title: 'Apply controlled changes',
    description: 'Add credits, deduct credits, or reset a balance. The interface reflects the API response.',
    endpoint: 'POST · PATCH /api/credits',
  },
  {
    number: '03',
    label: 'ADMIN',
    icon: Database,
    title: 'Review schema migrations',
    description: 'Read migration records and use the existing protected schema-management endpoints.',
    endpoint: 'GET · POST /api/schema',
  },
];

function Brand() {
  return (
    <a className="home-brand" href="/" aria-label="Mintline home">
      <span className="home-brand-mark">
        <Coins size={20} strokeWidth={2.2} />
      </span>
      <span className="home-brand-copy">
        <span className="home-brand-name">mintline<span>.</span></span>
        <span className="home-brand-subtitle">CREDIT WORKSPACE</span>
      </span>
    </a>
  );
}

export default function HomePage({ onOpenDashboard }: HomePageProps) {
  return (
    <div className="home-page mintline-page">
      <header className="home-header">
        <div className="home-header-inner">
          <Brand />
          <nav className="home-nav" aria-label="Home page navigation">
            <a href="#operations">Operations</a>
            <a href="#request-flow">Request flow</a>
          </nav>
          <button type="button" className="home-header-cta" onClick={onOpenDashboard}>
            Open workspace <ArrowUpRight size={16} />
          </button>
        </div>
      </header>

      <main>
        <section className="mintline-intro" id="home">
          <div className="mintline-kicker-line">
            <span>ACCOUNT OPERATIONS / 01</span>
            <span>FASTAPI · POSTGRESQL</span>
          </div>
          <h1>
            Credit operations,
            <br />
            <em>without the guesswork.</em>
          </h1>
          <div className="mintline-intro-bottom">
            <p>
              Mintline is a focused control surface for the credit service.
              Review an account, make a deliberate change, and see the value
              returned by the API.
            </p>
            <div className="mintline-intro-actions">
              <button type="button" className="mintline-primary-action" onClick={onOpenDashboard}>
                Open credit workspace <ArrowRight size={16} />
              </button>
              <a
                className="mintline-secondary-action"
                href="https://github.com/faizansaiyed123/backend-intern-credits"
                target="_blank"
                rel="noreferrer"
              >
                Backend source <ExternalLink size={14} />
              </a>
            </div>
          </div>
          <div className="mintline-intro-foot">
            <span>NO SHADOW BALANCES</span>
            <span>RESPONSES COME FROM THE SERVICE <ArrowRight size={13} /></span>
          </div>
        </section>

        <section className="mintline-operations" id="operations">
          <div className="mintline-section-heading">
            <div>
              <span className="mintline-section-label">01 / WHAT THE SERVICE SUPPORTS</span>
              <h2>
                Three jobs.
                <br />
                <em>One clear workspace.</em>
              </h2>
            </div>
            <p>
              The homepage stays close to the available API. No fabricated
              transaction feed, placeholder balances, or controls that the
              backend cannot perform.
            </p>
          </div>

          <div className="mintline-operation-list">
            {capabilities.map((item) => (
              <article className="mintline-operation-row" key={item.number}>
                <span className="mintline-operation-number">{item.number}</span>
                <span className="mintline-operation-icon">
                  <item.icon size={20} strokeWidth={1.8} />
                </span>
                <div className="mintline-operation-copy">
                  <span>{item.label}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
                <code>{item.endpoint}</code>
                <ArrowUpRight className="mintline-operation-arrow" size={17} />
              </article>
            ))}
          </div>

          <div className="mintline-truth-note">
            <span className="mintline-truth-mark"><Check size={15} /></span>
            <p>
              <strong>Built around the actual contract.</strong> The interface
              shows the account state returned by the backend; it does not
              invent a credit history that the service does not provide.
            </p>
          </div>
        </section>

        <section className="mintline-request-flow" id="request-flow">
          <div className="mintline-flow-heading">
            <span className="mintline-section-label">02 / REQUEST FLOW</span>
            <h2>
              One source of truth.
              <br />
              <em>Three clear steps.</em>
            </h2>
            <p>
              The browser sends an authenticated request. FastAPI applies the
              business rules and reads or updates PostgreSQL. Mintline renders
              the response it receives.
            </p>
          </div>

          <div className="mintline-flow-track">
            <article className="mintline-flow-step">
              <span className="mintline-flow-number">01</span>
              <span className="mintline-flow-role">THE OPERATOR</span>
              <h3>Select an account</h3>
              <p>Choose an existing user and the operation to perform.</p>
              <div className="mintline-flow-detail">
                <span>INPUT</span>
                <span><Coins size={14} /> Account ID</span>
              </div>
            </article>
            <article className="mintline-flow-step">
              <span className="mintline-flow-number">02</span>
              <span className="mintline-flow-role">THE SERVICE</span>
              <h3>Validate and process</h3>
              <p>FastAPI checks access, applies the rules, and talks to PostgreSQL.</p>
              <div className="mintline-flow-detail">
                <span>API</span>
                <span><Database size={14} /> FastAPI · PostgreSQL</span>
              </div>
            </article>
            <article className="mintline-flow-step">
              <span className="mintline-flow-number">03</span>
              <span className="mintline-flow-role">THE INTERFACE</span>
              <h3>Show the returned state</h3>
              <p>The dashboard updates from the response, not a local guess.</p>
              <div className="mintline-flow-detail">
                <span>RESULT</span>
                <span><Check size={14} /> API response</span>
              </div>
            </article>
          </div>

          <div className="mintline-stack-line">
            <span>FRONTEND <strong>React</strong></span>
            <span>API <strong>FastAPI</strong></span>
            <span>DATA <strong>PostgreSQL</strong></span>
          </div>
        </section>

        <section className="mintline-access">
          <div className="mintline-access-copy">
            <span className="mintline-section-label">03 / ACCESS BOUNDARIES</span>
            <h2>Every action has its own gate.</h2>
            <p>
              Balance reads require a valid session. Credit mutations use a
              separate operator key, while schema migrations are protected by
              a distinct administrator key.
            </p>
          </div>
          <div className="mintline-access-action">
            <span><LockKeyhole size={16} /> AUTHENTICATED WORKSPACE</span>
            <button type="button" onClick={onOpenDashboard}>
              Open workspace <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </main>

      <footer className="home-footer mintline-footer">
        <Brand />
        <span>Credit management, made clear.</span>
        <a
          href="https://github.com/faizansaiyed123/backend-intern-credits"
          target="_blank"
          rel="noreferrer"
        >
          Backend source <ChevronRight size={14} />
        </a>
        <span className="home-footer-copyright">© 2026 Mintline</span>
      </footer>
    </div>
  );
}
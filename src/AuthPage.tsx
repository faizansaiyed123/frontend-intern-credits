import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Coins, LockKeyhole, ShieldCheck } from "lucide-react";
import { ApiError, loginAccount, registerAccount, setAccessToken } from "./api";
import "./auth.css";

interface AuthPageProps {
  onAuthenticated: () => void;
  onGoHome: () => void;
}

type AuthMode = "login" | "register";

export default function AuthPage({ onAuthenticated, onGoHome }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (mode === "register" && password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    if (mode === "register" && password.length < 12) {
      setError("Use at least 12 characters for your password.");
      return;
    }

    setLoading(true);
    try {
      const result = mode === "register"
        ? await registerAccount({ name: name.trim(), email: email.trim(), password })
        : await loginAccount({ email: email.trim(), password });
      setAccessToken(result.access_token);
      onAuthenticated();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setError("The email or password is incorrect.");
      } else if (cause instanceof ApiError && cause.status === 409) {
        setError("An account could not be created with those details.");
      } else {
        setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-topbar">
        <button type="button" className="auth-brand" onClick={onGoHome} aria-label="Mintline home">
          <span className="auth-brand-mark"><Coins size={21} /></span>
          <span className="auth-brand-copy"><strong>mintline<span>.</span></strong><small>CREDIT WORKSPACE</small></span>
        </button>
        <button type="button" className="auth-back" onClick={onGoHome}><ArrowLeft size={16} /> Back to home</button>
      </header>

      <section className="auth-layout">
        <div className="auth-story">
          <div className="auth-kicker"><span /> YOUR BALANCE, UNDER YOUR CONTROL</div>
          <h1>Good decisions<br /><span>start with clarity.</span></h1>
          <p>Sign in to see your account balance and make controlled credit changes, all backed by the connected service.</p>
          <div className="auth-assurance">
            <span><ShieldCheck size={18} /></span>
            <div><strong>Account-specific access</strong><small>Your session can access only its own credit account.</small></div>
          </div>
          <div className="auth-assurance">
            <span><LockKeyhole size={18} /></span>
            <div><strong>Protected sessions</strong><small>Sessions expire and can be revoked when you sign out.</small></div>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card-top">
            <div className="auth-lock"><LockKeyhole size={19} /></div>
            <span className="auth-secure-label">SECURE WORKSPACE</span>
          </div>
          <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="auth-subtitle">{mode === "login" ? "Sign in to continue to your credit workspace." : "Create an account to get started with a zero-credit balance."}</p>

          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Create account</button>
          </div>

          <form className="auth-form" onSubmit={submit}>
            {mode === "register" && (
              <div className="auth-field">
                <label htmlFor="auth-name">Full name</label>
                <input id="auth-name" name="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={255} required placeholder="Your name" />
              </div>
            )}
            <div className="auth-field">
              <label htmlFor="auth-email">Email address</label>
              <input id="auth-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={255} required placeholder="you@example.com" />
            </div>
            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>
              <input id="auth-password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 12 : 1} maxLength={128} required placeholder={mode === "register" ? "At least 12 characters" : "Enter your password"} />
              {mode === "register" && <small>Use 12–128 characters.</small>}
            </div>
            {mode === "register" && (
              <div className="auth-field">
                <label htmlFor="auth-confirm-password">Confirm password</label>
                <input id="auth-confirm-password" name="confirmPassword" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required placeholder="Enter the password again" />
              </div>
            )}
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? "Please wait…" : mode === "login" ? "Sign in to workspace" : "Create account"}
              {!loading && <ArrowRight size={17} />}
            </button>
          </form>
          <p className="auth-privacy">Your session token is kept in this browser tab and is not saved in local storage.</p>
        </div>
      </section>
      <footer className="auth-footer"><span>© 2026 Mintline</span><span>Credit operations, made clear.</span></footer>
    </main>
  );
}

import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { describeError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { Brand } from "../../components/Brand";

/** Staff sign-in with password + one-time code (M01: F1). */
export function LoginPage() {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/staff";
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === "signedIn") return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setMessage(null);
    try {
      await login({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        otp: String(form.get("otp") ?? ""),
      });
      navigate(from, { replace: true });
    } catch (err) {
      setMessage(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="rh-header">
        <div className="rh-header__inner">
          <Brand />
        </div>
      </header>
      <main id="main" className="rh-main" style={{ maxWidth: 420 }}>
        <h1>Staff sign-in</h1>
        <form onSubmit={onSubmit} className="rh-card" aria-describedby={message ? "login-error" : undefined}>
          <div className="rh-field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" required />
          </div>
          <div className="rh-field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <div className="rh-field">
            <label htmlFor="otp">One-time code</label>
            <input
              id="otp"
              name="otp"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="one-time-code"
              aria-describedby="otp-help"
              required
            />
            <small id="otp-help" className="rh-muted">
              The 6-digit code from your authenticator app.
              {import.meta.env.DEV ? " Development mode: use 123456." : ""}
            </small>
          </div>
          <button className="rh-button" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {message ? (
            <div id="login-error" className="rh-alert" role="alert">
              {message}
            </div>
          ) : null}
        </form>
      </main>
    </>
  );
}

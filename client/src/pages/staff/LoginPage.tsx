import { useState, type FormEvent } from "react";
import { api, ApiClientError } from "../../api/client";
import { Brand } from "../../components/Brand";

/** Staff sign-in with password + one-time code (M01: F1). Wired to POST /api/v1/auth/login. */
export function LoginPage() {
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await api.post("/auth/login", {
        email: form.get("email"),
        password: form.get("password"),
        otp: form.get("otp"),
      });
      // TODO (Iteration 1): setSessionToken(session.token) and navigate to /staff.
    } catch (err) {
      setMessage(
        err instanceof ApiClientError && err.code === "NOT_IMPLEMENTED"
          ? "Staff sign-in is coming in Iteration 1."
          : err instanceof Error
            ? err.message
            : "Sign-in failed",
      );
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
        <form onSubmit={onSubmit} className="rh-card">
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
            <input id="otp" name="otp" inputMode="numeric" pattern="\d{6}" autoComplete="one-time-code" required />
          </div>
          <button className="rh-button" type="submit">
            Sign in
          </button>
          {message ? (
            <div className="rh-alert" role="alert">
              {message}
            </div>
          ) : null}
        </form>
      </main>
    </>
  );
}

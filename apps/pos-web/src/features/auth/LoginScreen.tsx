"use client";

import { useState, type FormEvent } from "react";

export type AuthNoticeState = "signed_out" | "expired" | "unauthorized" | "locked" | "loading";

export type LoginCredentials = {
  readonly email: string;
  readonly password: string;
};

export type LoginScreenProps = {
  noticeState?: AuthNoticeState;
  busy?: boolean;
  errorMessage?: string;
  onSignIn?: (request: LoginCredentials) => void;
};

const NOTICES: Record<Exclude<AuthNoticeState, "signed_out" | "loading">, { tone: "warning" | "danger" | "info"; title: string; body: string }> = {
  expired: {
    tone: "warning",
    title: "Session expired.",
    body: "Sign in again to continue. Your local cart has been kept.",
  },
  unauthorized: {
    tone: "danger",
    title: "Access denied.",
    body: "This account is not authorized to operate this register.",
  },
  locked: {
    tone: "info",
    title: "Register locked.",
    body: "Sign in to unlock the current shift.",
  },
};

export function LoginScreen({
  noticeState = "signed_out",
  busy = false,
  errorMessage,
  onSignIn,
}: LoginScreenProps) {
  const loading = busy || noticeState === "loading";
  const notice = noticeState === "expired" || noticeState === "unauthorized" || noticeState === "locked"
    ? NOTICES[noticeState]
    : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !onSignIn) return;
    onSignIn({ email, password });
  }

  return (
    <main className="auth-screen" id="main-content">
      <section className="card auth-card" aria-labelledby="login-title">
        <div className="auth-logo" aria-hidden="true">
          CT
        </div>
        <div className="eyebrow">Staff sign-in</div>
        <h1 id="login-title">CETECH POS</h1>
        <p className="subtle">Scan → Sell → Pay → Print</p>
        {notice ? (
          <div className={`banner ${notice.tone}`} role="status">
            <div>
              <strong>{notice.title}</strong>
              <span> {notice.body}</span>
            </div>
          </div>
        ) : null}
        {errorMessage ? (
          <div className="banner danger" role="alert">
            {errorMessage}
          </div>
        ) : null}
        <form className="auth-actions stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              name="staff-email"
              autoComplete="username"
              value={email}
              disabled={loading}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              name="staff-password"
              autoComplete="current-password"
              value={password}
              disabled={loading}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button
            className="btn primary block"
            type="submit"
            disabled={loading || !onSignIn}
            aria-busy={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="muted">
          Use your staff account to continue.
        </p>
      </section>
    </main>
  );
}

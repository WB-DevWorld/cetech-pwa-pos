"use client";

import { useState, type FormEvent } from "react";
import { temporaryPasswordError } from "../../server/auth/password-policy";

export function PasswordChangeScreen({
  busy = false,
  errorMessage,
  onSubmit,
  onSignOut,
}: {
  readonly busy?: boolean;
  readonly errorMessage?: string;
  readonly onSubmit: (password: string) => void;
  readonly onSignOut: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const problem = temporaryPasswordError(password);
    if (problem) {
      setLocalError(problem);
      return;
    }
    if (password !== confirm) {
      setLocalError("The two passwords do not match.");
      return;
    }
    setLocalError(null);
    onSubmit(password);
  }

  return (
    <main className="auth-screen" id="main-content">
      <section className="card auth-card" aria-labelledby="password-change-title">
        <div className="eyebrow">Staff sign-in</div>
        <h1 id="password-change-title">Choose a new password</h1>
        <p className="subtle">This temporary password can only be used once. The rest of the POS stays closed until you replace it.</p>
        {errorMessage ? <div className="banner danger" role="alert">{errorMessage}</div> : null}
        {localError ? <div className="banner danger" role="alert">{localError}</div> : null}
        <form className="auth-actions stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>New password</span>
            <input
              className="input"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Confirm new password</span>
            <input
              className="input"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              disabled={busy}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </label>
          <button className="btn" type="button" onClick={() => setVisible((current) => !current)}>
            {visible ? "Hide password" : "Show password"}
          </button>
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save new password"}
          </button>
          <button className="btn" type="button" disabled={busy} onClick={onSignOut}>
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}

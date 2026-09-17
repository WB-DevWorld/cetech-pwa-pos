"use client";

import { useState } from "react";
import { LoginScreen, type AuthNoticeState } from "../features/auth";
import type { StaffSignInRequest } from "../core/identity";

export function StaffAuthGate({
  noticeState,
  busy,
  errorMessage,
  onSignIn,
}: {
  readonly noticeState: AuthNoticeState;
  readonly busy: boolean;
  readonly errorMessage?: string;
  readonly onSignIn: (request: StaffSignInRequest) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="staff-auth-gate">
      <LoginScreen
        noticeState={noticeState}
        busy={busy}
        errorMessage={errorMessage}
        onSignIn={() => onSignIn({ email, password })}
      />
      <section className="card auth-card" aria-labelledby="staff-identity-fields">
        <h2 id="staff-identity-fields" className="eyebrow">
          Transitional staff identity
        </h2>
        <p className="muted">
          Sign-in uses the existing identity abstraction. Credentials are exchanged for a
          server staff session. They are not stored in IndexedDB.
        </p>
        <label className="field">
          <span>Staff email</span>
          <input
            type="email"
            name="staff-email"
            autoComplete="username"
            value={email}
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
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
      </section>
    </div>
  );
}

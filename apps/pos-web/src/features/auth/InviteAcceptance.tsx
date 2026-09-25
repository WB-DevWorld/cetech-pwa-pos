"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { STAFF_PRESENTATION_COPY } from "../../core/identity/staff-presentation-notice";
import {
  completeInvitedPassword,
  consumeInviteCallback,
  INVITE_INVALID_COPY,
  INVITE_PASSWORD_SAVED_COPY,
  INVITE_PASSWORD_SHORT_COPY,
} from "./invite-acceptance";

type Phase = "checking" | "ready" | "working" | "saved" | "invalid" | "unavailable" | "short";

export function InviteAcceptanceView({
  phase,
  onSubmit,
}: {
  readonly phase: Phase;
  readonly onSubmit?: (password: string) => void;
}) {
  return (
    <main className="auth-screen">
      <form
        className="auth-card"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const password = String(new FormData(event.currentTarget).get("password") ?? "");
          onSubmit?.(password);
        }}
      >
        <div className="auth-logo" aria-hidden="true">
          POS
        </div>
        <h1>CETECH POS</h1>
        {phase === "saved" ? (
          <>
            <p>{INVITE_PASSWORD_SAVED_COPY}</p>
            <p className="auth-actions">
              <Link href="/">Sign in</Link>
            </p>
          </>
        ) : null}
        {phase === "invalid" ? (
          <>
            <p role="alert">{INVITE_INVALID_COPY}</p>
            <p className="auth-actions">
              <Link href="/">Sign in</Link>
            </p>
          </>
        ) : null}
        {phase === "unavailable" ? <p role="alert">{STAFF_PRESENTATION_COPY.provider_unavailable}</p> : null}
        {phase === "short" ? <p role="alert">{INVITE_PASSWORD_SHORT_COPY}</p> : null}
        {phase === "checking" ? <p className="muted">Opening your invitation.</p> : null}
        {phase === "ready" || phase === "working" || phase === "short" ? (
          <>
            <p>Choose a password to finish joining CETECH POS. This does not assign a register.</p>
            <label>
              Password
              <input name="password" type="password" autoComplete="new-password" minLength={8} required />
            </label>
            <div className="auth-actions">
              <button type="submit" disabled={phase === "working"}>
                {phase === "working" ? "Saving…" : "Save password"}
              </button>
            </div>
          </>
        ) : null}
      </form>
    </main>
  );
}

export function InviteAcceptance({
  supabaseUrl,
  publishableKey,
}: {
  readonly supabaseUrl: string | null;
  readonly publishableKey: string | null;
}) {
  const [consumed] = useState(() =>
    consumeInviteCallback(
      typeof window === "undefined" ? "" : window.location.hash,
      typeof window === "undefined" ? "" : window.location.search,
    ),
  );
  const tokenRef = useRef(consumed.status === "ready" ? consumed.accessToken : null);
  const [phase, setPhase] = useState<Phase>(() => initialPhase(consumed, supabaseUrl, publishableKey));

  useEffect(() => {
    window.history.replaceState(null, "", consumed.nextLocation);
  }, [consumed.nextLocation]);

  async function onSubmit(password: string) {
    const accessToken = tokenRef.current;
    if (!accessToken || !supabaseUrl || !publishableKey) {
      tokenRef.current = null;
      setPhase("invalid");
      return;
    }
    setPhase("working");
    const result = await completeInvitedPassword({
      supabaseUrl,
      publishableKey,
      accessToken,
      password,
    });
    if (result === "short") {
      setPhase("short");
      return;
    }
    tokenRef.current = null;
    if (result === "saved") {
      setPhase("saved");
      return;
    }
    setPhase(result === "invalid" ? "invalid" : "unavailable");
  }

  return <InviteAcceptanceView phase={phase} onSubmit={(password) => void onSubmit(password)} />;
}

function initialPhase(
  consumed: ReturnType<typeof consumeInviteCallback>,
  supabaseUrl: string | null,
  publishableKey: string | null,
): Phase {
  if (typeof window === "undefined") {
    return "checking";
  }
  if (consumed.status !== "ready") {
    return "invalid";
  }
  if (!supabaseUrl || !publishableKey) {
    return "unavailable";
  }
  return "ready";
}

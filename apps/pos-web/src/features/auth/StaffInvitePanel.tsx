"use client";

import { useState, type FormEvent } from "react";
import { STAFF_CSRF_COOKIE, STAFF_CSRF_HEADER } from "../../config/auth";
import { STAFF_PRESENTATION_COPY } from "../../core/identity/staff-presentation-notice";
import { INVITE_ALREADY_REGISTERED, INVITE_FORBIDDEN, INVITE_NOT_CONFIGURED } from "./invite-messages";

type InviteFormPhase = "idle" | "working" | "sent" | "error";

export function StaffInvitePanel() {
  const [phase, setPhase] = useState<InviteFormPhase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setPhase("working");
    setMessage(null);
    const result = await submitStaffInvite({
      email,
      csrfToken: readCookie(STAFF_CSRF_COOKIE) ?? "",
    });
    setMessage(result.message);
    setPhase(result.status === "sent" ? "sent" : "error");
  }

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={(event) => void onSubmit(event)}>
        <div className="auth-logo" aria-hidden="true">
          POS
        </div>
        <h1>Invite staff</h1>
        <p>Send a CETECH POS invitation. Accepting it does not assign a register or role.</p>
        <label>
          Email
          <input name="email" type="email" autoComplete="off" required />
        </label>
        {message ? <p role="status">{message}</p> : null}
        <div className="auth-actions">
          <button type="submit" disabled={phase === "working"}>
            {phase === "working" ? "Sending…" : "Send invitation"}
          </button>
        </div>
      </form>
    </main>
  );
}

export async function submitStaffInvite(input: {
  readonly email: string;
  readonly csrfToken: string;
  readonly fetchImpl?: typeof fetch;
  readonly correlationId?: string;
}): Promise<{ readonly status: "sent" | "already_registered" | "forbidden" | "not_configured" | "unavailable" | "invalid"; readonly message: string }> {
  const correlationId = input.correlationId ?? crypto.randomUUID();
  try {
    const response = await (input.fetchImpl ?? fetch)("/api/pos/v1/staff/invitations", {
      method: "POST",
      credentials: "include",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-correlation-id": correlationId,
        [STAFF_CSRF_HEADER]: input.csrfToken,
      },
      body: JSON.stringify({ email: input.email }),
    });
    const body = (await response.json()) as {
      readonly ok?: boolean;
      readonly error?: { readonly message?: string; readonly code?: string; readonly details?: { readonly field?: string } };
    };
    if (body.ok) {
      return { status: "sent", message: "Invitation sent. They'll receive an email to join CETECH POS." };
    }
    const message = body.error?.message ?? "";
    if (message === INVITE_ALREADY_REGISTERED) {
      return { status: "already_registered", message };
    }
    if (message === INVITE_FORBIDDEN || body.error?.code === "FORBIDDEN" || body.error?.code === "AUTH_REQUIRED") {
      if (body.error?.details?.field === "session") {
        return { status: "unavailable", message: STAFF_PRESENTATION_COPY.session_expired };
      }
      return { status: "forbidden", message: message === INVITE_FORBIDDEN ? message : INVITE_FORBIDDEN };
    }
    if (message === INVITE_NOT_CONFIGURED) {
      return { status: "not_configured", message };
    }
    if (body.error?.details?.field === "assignments") {
      return { status: "unavailable", message: STAFF_PRESENTATION_COPY.assignments_unavailable };
    }
    if (body.error?.details?.field === "session") {
      return { status: "unavailable", message: STAFF_PRESENTATION_COPY.session_expired };
    }
    if (body.error?.code === "VALIDATION_ERROR" && message) {
      return { status: "invalid", message };
    }
    return { status: "unavailable", message: STAFF_PRESENTATION_COPY.provider_unavailable };
  } catch {
    return { status: "unavailable", message: STAFF_PRESENTATION_COPY.provider_unavailable };
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1);
    }
  }
  return null;
}

import type { ApiFailure, Session, Uuid } from "../../../../../docs/contracts/domain.generated";
import { STAFF_CSRF_COOKIE, STAFF_SESSION_COOKIE } from "../../config/auth";
import { parseCookieHeader } from "../auth/cookies";
import { assertMutationProtection } from "../auth/csrf";
import { authFailure } from "../auth/errors";
import { isUuid } from "../auth/ids";
import type { StaffSessionStore } from "../auth/session-store";
import { resolveCorrelationId } from "../http/correlation";
import { httpStatusFor } from "../http/status";

export type CommandHttpHeaders = {
  readonly "Cache-Control": "no-store";
  readonly "X-Correlation-ID": Uuid;
};

export type GuardedStaffCommand =
  | {
      readonly ok: false;
      readonly status: number;
      readonly body: ApiFailure;
      readonly headers: CommandHttpHeaders;
    }
  | {
      readonly ok: true;
      readonly correlationId: Uuid;
      readonly session: Session;
      readonly headers: CommandHttpHeaders;
      readonly idempotencyKey?: Uuid;
    };

export async function guardStaffCommand(input: {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly requireMutationProtection: boolean;
  readonly idempotencyKeyHeader?: string | null;
  readonly requireIdempotencyKey: boolean;
}): Promise<GuardedStaffCommand> {
  const correlation = resolveCorrelationId(input.correlationIdHeader);
  const headers: CommandHttpHeaders = {
    "Cache-Control": "no-store",
    "X-Correlation-ID": correlation.correlationId,
  };
  if (!correlation.ok) {
    return fail(headers, authFailure("VALIDATION_ERROR", "X-Correlation-ID must be a UUID", correlation.correlationId));
  }
  if (input.requireMutationProtection) {
    const protection = assertMutationProtection({
      origin: input.origin,
      referer: input.referer,
      csrfCookie: readCookie(input.cookieHeader, STAFF_CSRF_COOKIE),
      csrfHeader: input.csrfHeader ?? null,
      allowedOrigins: input.allowedOrigins,
    });
    if (!protection.ok) {
      return fail(
        headers,
        authFailure(
          "FORBIDDEN",
          protection.reason === "csrf"
            ? "mutation requires matching CSRF cookie and header"
            : "mutation origin is not allowed",
          correlation.correlationId,
        ),
      );
    }
  }
  const sessionId = readCookie(input.cookieHeader, STAFF_SESSION_COOKIE);
  let stored = null;
  try {
    stored = sessionId ? await input.sessionStore.get(sessionId, input.now) : null;
  } catch {
    return fail(
      headers,
      authFailure("INTEGRATION_UNAVAILABLE", "staff session store is unavailable", correlation.correlationId),
    );
  }
  if (!stored) {
    return fail(headers, authFailure("AUTH_REQUIRED", "staff session is required", correlation.correlationId));
  }
  if (stored.mustChangePassword === true) {
    return fail(
      headers,
      authFailure("FORBIDDEN", "Create a new password before continuing.", correlation.correlationId),
    );
  }

  if (!input.requireIdempotencyKey) {
    return { ok: true, correlationId: correlation.correlationId, session: stored.session, headers };
  }
  const rawKey = input.idempotencyKeyHeader?.trim().toLowerCase();
  if (!rawKey || !isUuid(rawKey)) {
    return fail(
      headers,
      authFailure("VALIDATION_ERROR", "Idempotency-Key must be a UUID", correlation.correlationId),
    );
  }
  return {
    ok: true,
    correlationId: correlation.correlationId,
    session: stored.session,
    headers,
    idempotencyKey: rawKey,
  };
}

function readCookie(header: string | undefined, name: string): string | null {
  return parseCookieHeader(header)[name] ?? null;
}

function fail(headers: CommandHttpHeaders, body: ApiFailure): GuardedStaffCommand {
  return { ok: false, status: httpStatusFor(body.error.code), body, headers };
}

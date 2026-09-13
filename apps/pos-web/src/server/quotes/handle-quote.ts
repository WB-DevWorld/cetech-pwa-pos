import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Quote, QuoteRequest, Uuid } from "../../../../../docs/contracts/domain.generated";
import { STAFF_CSRF_COOKIE, STAFF_SESSION_COOKIE } from "../../config/auth";
import { authFailure } from "../auth/errors";
import { isUuid } from "../auth/ids";
import { assertMutationProtection } from "../auth/csrf";
import { parseCookieHeader } from "../auth/cookies";
import type { StaffSessionStore } from "../auth/session-store";
import { resolveCorrelationId } from "../http/correlation";
import { httpStatusFor } from "../http/status";

export type QuoteBridge = {
  postQuote(request: QuoteRequest, correlationId: Uuid): Promise<ApiResult<Quote>>;
};

export type HandleQuoteInput = {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly body: unknown;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly bridge?: QuoteBridge;
};

export type HandleQuoteResponse = {
  readonly status: number;
  readonly body: ApiResult<Quote>;
  readonly headers: { readonly "Cache-Control": "no-store"; readonly "X-Correlation-ID": Uuid };
};

export async function handleQuote(input: HandleQuoteInput): Promise<HandleQuoteResponse> {
  const correlation = resolveCorrelationId(input.correlationIdHeader);
  const headers = { "Cache-Control": "no-store" as const, "X-Correlation-ID": correlation.correlationId };
  if (!correlation.ok) {
    const body = authFailure("VALIDATION_ERROR", "X-Correlation-ID must be a UUID", correlation.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers };
  }
  const protection = assertMutationProtection({
    origin: input.origin,
    referer: input.referer,
    csrfCookie: readCookie(input.cookieHeader, STAFF_CSRF_COOKIE),
    csrfHeader: input.csrfHeader ?? null,
    allowedOrigins: input.allowedOrigins,
  });
  if (!protection.ok) {
    const body = authFailure(
      "FORBIDDEN",
      protection.reason === "csrf"
        ? "mutation requires matching CSRF cookie and header"
        : "mutation origin is not allowed",
      correlation.correlationId,
    );
    return { status: httpStatusFor(body.error.code), body, headers };
  }
  const sessionId = readCookie(input.cookieHeader, STAFF_SESSION_COOKIE);
  let stored = null;
  try {
    stored = sessionId ? await input.sessionStore.get(sessionId, input.now) : null;
  } catch {
    const body = authFailure("INTEGRATION_UNAVAILABLE", "staff session store is unavailable", correlation.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers };
  }
  if (!stored) {
    const body = authFailure("AUTH_REQUIRED", "staff session is required", correlation.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers };
  }
  const request = parseQuoteRequest(input.body);
  if (!request) {
    const body = authFailure("VALIDATION_ERROR", "QuoteRequest is invalid", correlation.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers };
  }
  if (!stored.session.locationIds.includes(request.locationId)) {
    const body = authFailure("FORBIDDEN", "location is out of staff scope", correlation.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers };
  }
  if (!input.bridge) {
    const body = authFailure(
      "INTEGRATION_UNAVAILABLE",
      "authoritative quote bridge is not configured",
      correlation.correlationId,
    );
    return { status: httpStatusFor(body.error.code), body, headers };
  }
  const result = await input.bridge.postQuote(request, correlation.correlationId);
  if (!result.ok) {
    return { status: httpStatusFor(result.error.code), body: result, headers };
  }
  return { status: 200, body: result, headers };
}

function readCookie(header: string | undefined, name: string): string | null {
  return parseCookieHeader(header)[name] ?? null;
}

function parseQuoteRequest(body: unknown): QuoteRequest | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const value = body as Partial<QuoteRequest>;
  if (!isUuid(value.cartId) || typeof value.cartRevision !== "number" || value.cartRevision < 0) {
    return null;
  }
  if (!value.locationId || typeof value.locationId !== "string") {
    return null;
  }
  if (!value.customer || typeof value.customer !== "object") {
    return null;
  }
  if (!Array.isArray(value.lines) || value.lines.length === 0) {
    return null;
  }
  return value as QuoteRequest;
}

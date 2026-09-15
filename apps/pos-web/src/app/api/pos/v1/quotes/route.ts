import { NextResponse, type NextRequest } from "next/server";
import { staffAllowedOrigins } from "../../../../../config/env";
import { composeStaffSessionStore } from "../../../../../server/auth/compose-session-store";
import { STAFF_CSRF_HEADER, STAFF_SESSION_COOKIE } from "../../../../../config/auth";
import { parseCookieHeader } from "../../../../../server/auth/cookies";
import { createServerRestFetch } from "../../../../../server/http/server-fetch";
import { composeQuoteBridge } from "../../../../../server/quotes/compose-quote-bridge";
import { handleQuote } from "../../../../../server/quotes/handle-quote";
import { composeCheckoutRuntime } from "../../../../../server/sales/compose-checkout-runtime";
import { httpStatusFor } from "../../../../../server/http/status";
import { authFailure } from "../../../../../server/auth/errors";
import { resolveCorrelationId } from "../../../../../server/http/correlation";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const fetchImpl = createServerRestFetch();
  let sessionStore;
  let runtime;
  try {
    sessionStore = composeStaffSessionStore(process.env, fetchImpl);
    runtime = composeCheckoutRuntime(process.env, fetchImpl);
  } catch {
    const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
    const body = authFailure(
      "INTEGRATION_UNAVAILABLE",
      "durable staff session and checkout stores are required",
      correlation.correlationId,
    );
    return NextResponse.json(body, {
      status: httpStatusFor(body.error.code),
      headers: { "Cache-Control": "no-store", "X-Correlation-ID": body.correlationId },
    });
  }
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const now = new Date();
  const result = await handleQuote({
    correlationIdHeader: request.headers.get("x-correlation-id") ?? undefined,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    cookieHeader: request.headers.get("cookie") ?? undefined,
    csrfHeader: request.headers.get(STAFF_CSRF_HEADER),
    body,
    now,
    sessionStore,
    allowedOrigins: staffAllowedOrigins(),
    bridge: composeQuoteBridge(process.env, fetchImpl),
  });
  if (!result.body.ok) {
    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  }

  const sessionId = parseCookieHeader(request.headers.get("cookie") ?? "")[STAFF_SESSION_COOKIE];
  const stored = sessionId ? await sessionStore.get(sessionId, now) : null;
  if (!stored) {
    const failure = authFailure("AUTH_REQUIRED", "staff session is required", result.body.correlationId);
    return NextResponse.json(failure, { status: httpStatusFor(failure.error.code), headers: result.headers });
  }
  try {
    await runtime.quoteSnapshots.save(stored.session.organizationId, result.body.data);
  } catch {
    const failure = authFailure(
      "INTEGRATION_UNAVAILABLE",
      "authoritative quote succeeded but its durable POS snapshot could not be recorded",
      result.body.correlationId,
    );
    return NextResponse.json(failure, { status: httpStatusFor(failure.error.code), headers: result.headers });
  }
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

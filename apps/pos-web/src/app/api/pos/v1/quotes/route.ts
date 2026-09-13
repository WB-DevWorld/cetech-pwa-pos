import { NextResponse, type NextRequest } from "next/server";
import { staffAllowedOrigins } from "../../../../../config/env";
import { composeStaffSessionStore } from "../../../../../server/auth/compose-session-store";
import { STAFF_CSRF_HEADER } from "../../../../../config/auth";
import { createServerRestFetch } from "../../../../../server/http/server-fetch";
import { composeQuoteBridge } from "../../../../../server/quotes/compose-quote-bridge";
import { handleQuote } from "../../../../../server/quotes/handle-quote";
import { httpStatusFor } from "../../../../../server/http/status";
import { authFailure } from "../../../../../server/auth/errors";
import { resolveCorrelationId } from "../../../../../server/http/correlation";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let sessionStore;
  try {
    sessionStore = composeStaffSessionStore(process.env, createServerRestFetch());
  } catch {
    const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
    const body = authFailure(
      "INTEGRATION_UNAVAILABLE",
      "durable staff session store is required",
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
  const result = await handleQuote({
    correlationIdHeader: request.headers.get("x-correlation-id") ?? undefined,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    cookieHeader: request.headers.get("cookie") ?? undefined,
    csrfHeader: request.headers.get(STAFF_CSRF_HEADER),
    body,
    now: new Date(),
    sessionStore,
    allowedOrigins: staffAllowedOrigins(),
    bridge: composeQuoteBridge(process.env, createServerRestFetch()),
  });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}

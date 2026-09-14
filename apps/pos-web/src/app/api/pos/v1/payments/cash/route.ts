import { NextResponse, type NextRequest } from "next/server";
import { staffAllowedOrigins } from "../../../../../../config/env";
import { STAFF_CSRF_HEADER } from "../../../../../../config/auth";
import { composeStaffSessionStore } from "../../../../../../server/auth/compose-session-store";
import { authFailure } from "../../../../../../server/auth/errors";
import { createServerRestFetch } from "../../../../../../server/http/server-fetch";
import { resolveCorrelationId } from "../../../../../../server/http/correlation";
import { httpStatusFor } from "../../../../../../server/http/status";
import { composeCheckoutRuntime } from "../../../../../../server/sales/compose-checkout-runtime";
import { handleConfirmCash } from "../../../../../../server/sales/handle-confirm-cash";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const composed = composeHandlers(request);
  if (!composed.ok) {
    return composed.response;
  }
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const result = await handleConfirmCash({
    correlationIdHeader: request.headers.get("x-correlation-id") ?? undefined,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    cookieHeader: request.headers.get("cookie") ?? undefined,
    csrfHeader: request.headers.get(STAFF_CSRF_HEADER),
    idempotencyKeyHeader: request.headers.get("idempotency-key"),
    body,
    now: new Date(),
    sessionStore: composed.sessionStore,
    allowedOrigins: staffAllowedOrigins(),
    checkoutStore: composed.runtime.store,
  });
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

function composeHandlers(request: NextRequest) {
  try {
    const sessionStore = composeStaffSessionStore(process.env, createServerRestFetch());
    const runtime = composeCheckoutRuntime(process.env);
    return { ok: true as const, sessionStore, runtime };
  } catch {
    const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
    const body = authFailure(
      "INTEGRATION_UNAVAILABLE",
      "durable staff session and checkout stores are required",
      correlation.correlationId,
    );
    return {
      ok: false as const,
      response: NextResponse.json(body, {
        status: httpStatusFor(body.error.code),
        headers: { "Cache-Control": "no-store", "X-Correlation-ID": body.correlationId },
      }),
    };
  }
}

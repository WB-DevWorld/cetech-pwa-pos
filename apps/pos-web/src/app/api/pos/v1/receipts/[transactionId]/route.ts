import { NextResponse, type NextRequest } from "next/server";
import { staffAllowedOrigins } from "../../../../../../config/env";
import { composeStaffSessionStore } from "../../../../../../server/auth/compose-session-store";
import { authFailure } from "../../../../../../server/auth/errors";
import { createServerRestFetch } from "../../../../../../server/http/server-fetch";
import { resolveCorrelationId } from "../../../../../../server/http/correlation";
import { httpStatusFor } from "../../../../../../server/http/status";
import { composeCheckoutRuntime } from "../../../../../../server/sales/compose-checkout-runtime";
import { composeStaffAssignmentDirectory } from "../../../../../../server/sales/compose-assignment-directory";
import { handleGetReceipt } from "../../../../../../server/sales/handle-get-receipt";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ transactionId: string }> },
): Promise<NextResponse> {
  const composed = composeHandlers(request);
  if (!composed.ok) {
    return composed.response;
  }
  const { transactionId } = await context.params;
  const result = await handleGetReceipt({
    correlationIdHeader: request.headers.get("x-correlation-id") ?? undefined,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    cookieHeader: request.headers.get("cookie") ?? undefined,
    csrfHeader: request.headers.get("x-csrf-token"),
    transactionId,
    now: new Date(),
    sessionStore: composed.sessionStore,
    allowedOrigins: staffAllowedOrigins(),
    checkoutStore: composed.runtime.store,
    assignments: composed.assignments,
  });
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

function composeHandlers(request: NextRequest) {
  try {
    const sessionStore = composeStaffSessionStore(process.env, createServerRestFetch());
    const runtime = composeCheckoutRuntime(process.env);
    const assignments = composeStaffAssignmentDirectory(process.env);
    return { ok: true as const, sessionStore, runtime, assignments };
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

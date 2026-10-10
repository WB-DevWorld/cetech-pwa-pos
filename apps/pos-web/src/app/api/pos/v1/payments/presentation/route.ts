import { NextResponse, type NextRequest } from "next/server";
import { composeStaffSessionStore } from "../../../../../../server/auth/compose-session-store";
import { authFailure } from "../../../../../../server/auth/errors";
import { createServerRestFetch } from "../../../../../../server/http/server-fetch";
import { resolveCorrelationId } from "../../../../../../server/http/correlation";
import { httpStatusFor } from "../../../../../../server/http/status";
import { composePosCommandHandlers } from "../../../../../../server/sales/compose-pos-command-runtime";
import { handlePaystackPresentation } from "../../../../../../server/payments/handle-paystack-presentation";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
  const composed = composePosCommandHandlers(request);
  if (!composed.ok) return composed.response;
  try {
    const result = await handlePaystackPresentation({
      correlationId: correlation.correlationId,
      cookieHeader: request.headers.get("cookie") ?? undefined,
      paymentId: request.nextUrl.searchParams.get("paymentId") ?? undefined,
      now: new Date(),
      sessions: composeStaffSessionStore(process.env, createServerRestFetch()),
      checkoutStore: composed.runtime.store,
      env: process.env,
    });
    return NextResponse.json(result, {
      status: result.ok ? 200 : httpStatusFor(result.error.code),
      headers: { "Cache-Control": "no-store", "X-Correlation-ID": result.correlationId },
    });
  } catch {
    const body = authFailure("INTEGRATION_UNAVAILABLE", "Paystack test handoff is unavailable", correlation.correlationId);
    return NextResponse.json(body, {
      status: httpStatusFor(body.error.code),
      headers: { "Cache-Control": "no-store", "X-Correlation-ID": body.correlationId },
    });
  }
}

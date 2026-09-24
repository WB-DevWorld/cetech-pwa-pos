import { NextResponse, type NextRequest } from "next/server";
import { composeStaffSessionStore } from "../../../../../../server/auth/compose-session-store";
import { authFailure } from "../../../../../../server/auth/errors";
import { handlePaymentMethodCapabilities } from "../../../../../../server/payments/handle-payment-capabilities";
import { createServerRestFetch } from "../../../../../../server/http/server-fetch";
import { resolveCorrelationId } from "../../../../../../server/http/correlation";
import { httpStatusFor } from "../../../../../../server/http/status";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
  try {
    const result = await handlePaymentMethodCapabilities({
      correlationId: correlation.correlationId,
      cookieHeader: request.headers.get("cookie") ?? undefined,
      now: new Date(),
      sessions: composeStaffSessionStore(process.env, createServerRestFetch()),
      env: process.env,
    });
    return NextResponse.json(result, {
      status: result.ok ? 200 : httpStatusFor(result.error.code),
      headers: { "Cache-Control": "no-store", "X-Correlation-ID": result.correlationId },
    });
  } catch {
    const body = authFailure(
      "INTEGRATION_UNAVAILABLE",
      "payment capability check is unavailable",
      correlation.correlationId,
    );
    return NextResponse.json(body, {
      status: httpStatusFor(body.error.code),
      headers: { "Cache-Control": "no-store", "X-Correlation-ID": body.correlationId },
    });
  }
}

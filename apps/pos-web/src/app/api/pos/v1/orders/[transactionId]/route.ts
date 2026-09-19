import { NextResponse, type NextRequest } from "next/server";
import { staffAllowedOrigins } from "../../../../../../config/env";
import { STAFF_CSRF_HEADER } from "../../../../../../config/auth";
import { composePosCommandHandlers } from "../../../../../../server/sales/compose-pos-command-runtime";
import { handleGetOrder } from "../../../../../../server/orders/handle-get-order";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ transactionId: string }> },
): Promise<NextResponse> {
  const composed = composePosCommandHandlers(request);
  if (!composed.ok) {
    return composed.response;
  }
  const { transactionId } = await context.params;
  const result = await handleGetOrder({
    correlationIdHeader: request.headers.get("x-correlation-id") ?? undefined,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    cookieHeader: request.headers.get("cookie") ?? undefined,
    csrfHeader: request.headers.get(STAFF_CSRF_HEADER),
    transactionId,
    now: new Date(),
    sessionStore: composed.sessionStore,
    allowedOrigins: staffAllowedOrigins(),
    checkoutStore: composed.runtime.store,
    assignments: composed.assignments,
  });
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

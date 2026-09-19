import { NextResponse, type NextRequest } from "next/server";
import { staffAllowedOrigins } from "../../../../../config/env";
import { STAFF_CSRF_HEADER } from "../../../../../config/auth";
import { composePosCommandHandlers } from "../../../../../server/sales/compose-pos-command-runtime";
import { handleListOrders } from "../../../../../server/orders/handle-list-orders";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const composed = composePosCommandHandlers(request);
  if (!composed.ok) {
    return composed.response;
  }
  const result = await handleListOrders({
    correlationIdHeader: request.headers.get("x-correlation-id") ?? undefined,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    cookieHeader: request.headers.get("cookie") ?? undefined,
    csrfHeader: request.headers.get(STAFF_CSRF_HEADER),
    query: request.nextUrl.searchParams.get("q") ?? "",
    now: new Date(),
    sessionStore: composed.sessionStore,
    allowedOrigins: staffAllowedOrigins(),
    checkoutStore: composed.runtime.store,
    assignments: composed.assignments,
  });
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

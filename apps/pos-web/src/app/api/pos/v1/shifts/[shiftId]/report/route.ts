import { NextResponse, type NextRequest } from "next/server";
import { staffAllowedOrigins } from "../../../../../../../config/env";
import { composePosCommandHandlers } from "../../../../../../../server/sales/compose-pos-command-runtime";
import { handleGetShiftReport } from "../../../../../../../server/sales/handle-get-shift-report";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ shiftId: string }> },
): Promise<NextResponse> {
  const composed = composePosCommandHandlers(request);
  if (!composed.ok) {
    return composed.response;
  }
  const { shiftId } = await context.params;
  const result = await handleGetShiftReport({
    correlationIdHeader: request.headers.get("x-correlation-id") ?? undefined,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    cookieHeader: request.headers.get("cookie") ?? undefined,
    csrfHeader: request.headers.get("x-csrf-token"),
    shiftId,
    kind: request.nextUrl.searchParams.get("kind"),
    now: new Date(),
    sessionStore: composed.sessionStore,
    allowedOrigins: staffAllowedOrigins(),
    checkoutStore: composed.runtime.store,
    assignments: composed.assignments,
  });
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

import { NextResponse, type NextRequest } from "next/server";
import { composeStaffSessionStore } from "../../../../../../server/auth/compose-session-store";
import { composeStaffAssignmentDirectory } from "../../../../../../server/sales/compose-assignment-directory";
import { composeControlPlaneDirectory } from "../../../../../../server/admin/compose-control-plane-directory";
import { composeManagementShiftCashDirectory } from "../../../../../../server/admin/compose-management-shift-cash-directory";
import { handleGetManagementShiftsCash } from "../../../../../../server/admin/handle-management-shifts-cash";
import { createServerRestFetch } from "../../../../../../server/http/server-fetch";
import { resolveCorrelationId } from "../../../../../../server/http/correlation";
import { httpStatusFor } from "../../../../../../server/http/status";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
  try {
    const fetchImpl = createServerRestFetch();
    const locationId = request.nextUrl.searchParams.get("locationId") ?? undefined;
    const result = await handleGetManagementShiftsCash({
      correlationId: correlation.correlationId,
      cookieHeader: request.headers.get("cookie") ?? undefined,
      now: new Date(),
      sessions: composeStaffSessionStore(process.env, fetchImpl),
      assignments: composeStaffAssignmentDirectory(process.env, fetchImpl),
      controlPlane: composeControlPlaneDirectory(process.env),
      shifts: composeManagementShiftCashDirectory(process.env),
      locationId,
    });
    return NextResponse.json(result, {
      status: result.ok ? 200 : httpStatusFor(result.error.code),
      headers: {
        "Cache-Control": "no-store",
        "X-Correlation-ID": result.correlationId,
      },
    });
  } catch {
    const result = {
      ok: false as const,
      error: {
        code: "INTEGRATION_UNAVAILABLE" as const,
        message: "shift and cash oversight is unavailable",
        retryable: true,
        nextAction: "resolve" as const,
      },
      correlationId: correlation.correlationId,
    };
    return NextResponse.json(result, {
      status: httpStatusFor(result.error.code),
      headers: {
        "Cache-Control": "no-store",
        "X-Correlation-ID": result.correlationId,
      },
    });
  }
}

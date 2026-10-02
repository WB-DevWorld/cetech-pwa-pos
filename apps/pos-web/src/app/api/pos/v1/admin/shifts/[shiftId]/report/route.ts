import { NextResponse, type NextRequest } from "next/server";
import { composeControlPlaneDirectory } from "@/server/admin/compose-control-plane-directory";
import { handleManagementShiftReport } from "@/server/admin/handle-management-shift-report";
import { resolveCorrelationId } from "@/server/http/correlation";
import { httpStatusFor } from "@/server/http/status";
import { composePosCommandHandlers } from "@/server/sales/compose-pos-command-runtime";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ shiftId: string }> },
): Promise<NextResponse> {
  const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
  const composed = composePosCommandHandlers(request);
  if (!composed.ok) return composed.response;
  try {
    const { shiftId } = await context.params;
    const result = await handleManagementShiftReport({
      correlationId: correlation.correlationId,
      cookieHeader: request.headers.get("cookie") ?? undefined,
      now: new Date(),
      sessions: composed.sessionStore,
      assignments: composed.assignments,
      controlPlane: composeControlPlaneDirectory(process.env),
      checkout: composed.runtime.store,
      shiftId,
      kind: request.nextUrl.searchParams.get("kind") ?? "",
    });
    return NextResponse.json(result, {
      status: result.ok ? 200 : httpStatusFor(result.error.code),
      headers: { "Cache-Control": "no-store", "X-Correlation-ID": result.correlationId },
    });
  } catch {
    const result = {
      ok: false as const,
      error: {
        code: "INTEGRATION_UNAVAILABLE" as const,
        message: "shift report is unavailable",
        retryable: true,
        nextAction: "resolve" as const,
      },
      correlationId: correlation.correlationId,
    };
    return NextResponse.json(result, {
      status: httpStatusFor(result.error.code),
      headers: { "Cache-Control": "no-store", "X-Correlation-ID": result.correlationId },
    });
  }
}

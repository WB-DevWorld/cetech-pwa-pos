import { NextResponse, type NextRequest } from "next/server";
import { STAFF_CSRF_COOKIE, STAFF_CSRF_HEADER } from "@/config/auth";
import { staffAllowedOrigins } from "@/config/env";
import { parseCookieHeader } from "@/server/auth/cookies";
import { composeControlPlaneDirectory } from "@/server/admin/compose-control-plane-directory";
import { handleManagementRefundReconciliation } from "@/server/admin/handle-management-refund-reconciliation";
import { resolveCorrelationId } from "@/server/http/correlation";
import { httpStatusFor } from "@/server/http/status";
import { composePosCommandHandlers } from "@/server/sales/compose-pos-command-runtime";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ refundId: string }> },
): Promise<NextResponse> {
  const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
  const composed = composePosCommandHandlers(request);
  if (!composed.ok) return composed.response;
  try {
    const { refundId } = await context.params;
    const result = await handleManagementRefundReconciliation({
      correlationId: correlation.correlationId,
      cookieHeader: request.headers.get("cookie") ?? undefined,
      now: new Date(),
      sessions: composed.sessionStore,
      assignments: composed.assignments,
      controlPlane: composeControlPlaneDirectory(process.env),
      checkoutStore: composed.runtime.store,
      returns: composed.returns.store,
      provider: composed.returns.refundProvider,
      refundId,
      protection: {
        origin: request.headers.get("origin"),
        referer: request.headers.get("referer"),
        csrfCookie: parseCookieHeader(request.headers.get("cookie") ?? undefined)[STAFF_CSRF_COOKIE] ?? null,
        csrfHeader: request.headers.get(STAFF_CSRF_HEADER),
        allowedOrigins: staffAllowedOrigins(),
      },
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
        message: "refund reconciliation is unavailable",
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

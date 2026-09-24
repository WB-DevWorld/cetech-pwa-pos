import { NextResponse, type NextRequest } from "next/server";
import { STAFF_CSRF_COOKIE, STAFF_CSRF_HEADER } from "@/config/auth";
import { staffAllowedOrigins } from "@/config/env";
import { composeStaffSessionStore } from "@/server/auth/compose-session-store";
import { parseCookieHeader } from "@/server/auth/cookies";
import { composeAdminAuditStore } from "@/server/admin/compose-admin-audit-store";
import { composeControlPlaneDirectory } from "@/server/admin/compose-control-plane-directory";
import { composeReturnApprovalAdminStore } from "@/server/admin/compose-return-approval-admin-store";
import { handleManagementReturnApproval } from "@/server/admin/handle-management-return-approval";
import { createServerRestFetch } from "@/server/http/server-fetch";
import { resolveCorrelationId } from "@/server/http/correlation";
import { httpStatusFor } from "@/server/http/status";
import { composeStaffAssignmentDirectory } from "@/server/sales/compose-assignment-directory";
import { composeReturnRuntime } from "@/server/returns/compose-return-runtime";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ returnId: string }> },
): Promise<NextResponse> {
  const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
  try {
    const fetchImpl = createServerRestFetch();
    const runtime = composeReturnRuntime(process.env, fetchImpl);
    const audit = composeAdminAuditStore(process.env);
    const { returnId } = await context.params;
    const result = await handleManagementReturnApproval({
      correlationId: correlation.correlationId,
      cookieHeader: request.headers.get("cookie") ?? undefined,
      now: new Date(),
      sessions: composeStaffSessionStore(process.env, fetchImpl),
      assignments: composeStaffAssignmentDirectory(process.env, fetchImpl),
      controlPlane: composeControlPlaneDirectory(process.env),
      returns: runtime.store,
      approvals: composeReturnApprovalAdminStore({
        env: process.env,
        returns: runtime.store,
        audit,
      }),
      returnId,
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
        message: "return approval is unavailable",
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

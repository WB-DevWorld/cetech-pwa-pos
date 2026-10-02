import { NextResponse, type NextRequest } from "next/server";
import { STAFF_CSRF_COOKIE, STAFF_CSRF_HEADER } from "@/config/auth";
import { staffAllowedOrigins } from "@/config/env";
import { parseCookieHeader } from "@/server/auth/cookies";
import { composeStaffSessionStore } from "@/server/auth/compose-session-store";
import { composeStaffAssignmentDirectory } from "@/server/sales/compose-assignment-directory";
import { composeControlPlaneDirectory } from "@/server/admin/compose-control-plane-directory";
import { composeStaffIdentityAdminStore } from "@/server/admin/compose-staff-identity-admin-store";
import { composeAdminAuditStore } from "@/server/admin/compose-admin-audit-store";
import { handleResetStaffPassword } from "@/server/admin/handle-reset-staff-password";
import { createServerRestFetch } from "@/server/http/server-fetch";
import { resolveCorrelationId } from "@/server/http/correlation";
import { httpStatusFor } from "@/server/http/status";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ actorId: string }> },
): Promise<NextResponse> {
  const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
  try {
    const { actorId } = await context.params;
    const body = await request.json() as unknown;
    const temporaryPassword = body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).temporaryPassword
      : undefined;
    if (typeof temporaryPassword !== "string" || !actorId) {
      return NextResponse.json({
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Enter a temporary password.",
          retryable: false,
          nextAction: "none",
        },
        correlationId: correlation.correlationId,
      }, {
        status: httpStatusFor("VALIDATION_ERROR"),
        headers: { "Cache-Control": "no-store", "X-Correlation-ID": correlation.correlationId },
      });
    }
    const fetchImpl = createServerRestFetch();
    const result = await handleResetStaffPassword({
      correlationId: correlation.correlationId,
      cookieHeader: request.headers.get("cookie") ?? undefined,
      now: new Date(),
      sessions: composeStaffSessionStore(process.env, fetchImpl),
      assignments: composeStaffAssignmentDirectory(process.env, fetchImpl),
      controlPlane: composeControlPlaneDirectory(process.env),
      identities: composeStaffIdentityAdminStore(process.env),
      audit: composeAdminAuditStore(process.env),
      targetActorId: actorId,
      temporaryPassword,
      protection: {
        origin: request.headers.get("origin"),
        referer: request.headers.get("referer"),
        csrfCookie: parseCookieHeader(request.headers.get("cookie") ?? undefined)[STAFF_CSRF_COOKIE] ?? null,
        csrfHeader: request.headers.get(STAFF_CSRF_HEADER),
        allowedOrigins: staffAllowedOrigins(),
      },
    });
    const serialized = result.ok
      ? result
      : { ...result, error: { ...result.error, message: result.error.message } };
    return NextResponse.json(serialized, {
      status: result.ok ? 200 : httpStatusFor(result.error.code),
      headers: { "Cache-Control": "no-store", "X-Correlation-ID": result.correlationId },
    });
  } catch {
    return NextResponse.json({
      ok: false,
      error: {
        code: "INTEGRATION_UNAVAILABLE",
        message: "Password reset is unavailable.",
        retryable: true,
        nextAction: "resolve",
      },
      correlationId: correlation.correlationId,
    }, {
      status: httpStatusFor("INTEGRATION_UNAVAILABLE"),
      headers: { "Cache-Control": "no-store", "X-Correlation-ID": correlation.correlationId },
    });
  }
}

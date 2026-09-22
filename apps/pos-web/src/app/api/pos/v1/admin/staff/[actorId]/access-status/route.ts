import { NextResponse, type NextRequest } from "next/server";
import { STAFF_CSRF_COOKIE, STAFF_CSRF_HEADER } from "@/config/auth";
import { staffAllowedOrigins } from "@/config/env";
import { parseCookieHeader } from "@/server/auth/cookies";
import { composeStaffSessionStore } from "@/server/auth/compose-session-store";
import { composeStaffAssignmentDirectory } from "@/server/sales/compose-assignment-directory";
import { composeControlPlaneDirectory } from "@/server/admin/compose-control-plane-directory";
import { composeStaffAccessDirectory } from "@/server/admin/compose-staff-access-directory";
import { composeStaffAccessStatusAdminStore } from "@/server/admin/compose-staff-access-status-admin-store";
import { handleSetStaffAccessStatus } from "@/server/admin/handle-staff-access-status";
import { createServerRestFetch } from "@/server/http/server-fetch";
import { resolveCorrelationId } from "@/server/http/correlation";
import { httpStatusFor } from "@/server/http/status";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ actorId: string }> },
): Promise<NextResponse> {
  const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
  try {
    const body = await request.json() as unknown;
    const parsed = parseBody(body);
    if (!parsed) {
      const result = {
        ok: false as const,
        error: {
          code: "VALIDATION_ERROR" as const,
          message: "staff access-status request is invalid",
          retryable: false,
          nextAction: "resolve" as const,
        },
        correlationId: correlation.correlationId,
      };
      return NextResponse.json(result, {
        status: httpStatusFor(result.error.code),
        headers: { "Cache-Control": "no-store", "X-Correlation-ID": result.correlationId },
      });
    }
    const fetchImpl = createServerRestFetch();
    const { actorId } = await context.params;
    const result = await handleSetStaffAccessStatus({
      correlationId: correlation.correlationId,
      cookieHeader: request.headers.get("cookie") ?? undefined,
      now: new Date(),
      sessions: composeStaffSessionStore(process.env, fetchImpl),
      assignments: composeStaffAssignmentDirectory(process.env, fetchImpl),
      controlPlane: composeControlPlaneDirectory(process.env),
      staff: composeStaffAccessDirectory(process.env),
      mutation: composeStaffAccessStatusAdminStore(process.env),
      targetActorId: actorId,
      status: parsed.status,
      reason: parsed.reason,
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
        message: "staff access-status runtime is unavailable",
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

function parseBody(value: unknown): {
  readonly status: "active" | "disabled";
  readonly reason?: string;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const root = value as Record<string, unknown>;
  if (root.status !== "active" && root.status !== "disabled") return null;
  return {
    status: root.status,
    ...(typeof root.reason === "string" && root.reason.trim().length > 0
      ? { reason: root.reason.trim() }
      : {}),
  };
}

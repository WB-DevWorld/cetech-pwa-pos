import { NextResponse, type NextRequest } from "next/server";
import { STAFF_CSRF_COOKIE, STAFF_CSRF_HEADER } from "@/config/auth";
import { staffAllowedOrigins } from "@/config/env";
import { parseCookieHeader } from "@/server/auth/cookies";
import { isStaffAssignmentRole } from "@/server/auth/roles";
import { composeStaffSessionStore } from "@/server/auth/compose-session-store";
import { composeStaffAssignmentDirectory } from "@/server/sales/compose-assignment-directory";
import { composeControlPlaneDirectory } from "@/server/admin/compose-control-plane-directory";
import { composeStaffAccessDirectory } from "@/server/admin/compose-staff-access-directory";
import { composeStaffAssignmentAdminStore } from "@/server/admin/compose-staff-assignment-admin-store";
import { composeManagementTopologyDirectory } from "@/server/admin/compose-management-topology-directory";
import { handleSetStaffAssignment } from "@/server/admin/handle-staff-access";
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
          message: "staff assignment request is invalid",
          retryable: false,
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

    const fetchImpl = createServerRestFetch();
    const { actorId } = await context.params;
    const result = await handleSetStaffAssignment({
      correlationId: correlation.correlationId,
      cookieHeader: request.headers.get("cookie") ?? undefined,
      now: new Date(),
      sessions: composeStaffSessionStore(process.env, fetchImpl),
      assignments: composeStaffAssignmentDirectory(process.env, fetchImpl),
      controlPlane: composeControlPlaneDirectory(process.env),
      staff: composeStaffAccessDirectory(process.env),
      mutation: composeStaffAssignmentAdminStore(process.env),
      topology: composeManagementTopologyDirectory(process.env),
      targetActorId: actorId,
      locationId: parsed.locationId,
      role: parsed.role,
      registerIds: parsed.registerIds,
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
        message: "staff assignment runtime is unavailable",
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

function parseBody(value: unknown): {
  readonly locationId: string;
  readonly role: "cashier" | "manager";
  readonly registerIds: readonly string[];
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const root = value as Record<string, unknown>;
  const role = root.role;
  if (
    typeof root.locationId !== "string" ||
    !isStaffAssignmentRole(role) ||
    !Array.isArray(root.registerIds) ||
    root.registerIds.some((id) => typeof id !== "string" || id.length === 0)
  ) {
    return null;
  }
  return {
    locationId: root.locationId,
    role,
    registerIds: root.registerIds as string[],
  };
}

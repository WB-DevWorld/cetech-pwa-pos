import { NextResponse, type NextRequest } from "next/server";
import { STAFF_CSRF_COOKIE, STAFF_CSRF_HEADER } from "@/config/auth";
import { staffAllowedOrigins } from "@/config/env";
import { parseCookieHeader } from "@/server/auth/cookies";
import { composeStaffSessionStore } from "@/server/auth/compose-session-store";
import { composeStaffAssignmentDirectory } from "@/server/sales/compose-assignment-directory";
import { composeControlPlaneDirectory } from "@/server/admin/compose-control-plane-directory";
import { composeStaffIdentityAdminStore } from "@/server/admin/compose-staff-identity-admin-store";
import { composeStaffAccessStatusAdminStore } from "@/server/admin/compose-staff-access-status-admin-store";
import { composeControlMembershipAdminStore } from "@/server/admin/compose-control-membership-admin-store";
import { composeStaffAssignmentAdminStore } from "@/server/admin/compose-staff-assignment-admin-store";
import { composeManagementTopologyDirectory } from "@/server/admin/compose-management-topology-directory";
import { composeAdminAuditStore } from "@/server/admin/compose-admin-audit-store";
import { handleCreateStaffAccount } from "@/server/admin/handle-create-staff";
import type { OrganizationControlRole } from "@/server/auth/policy";
import type { StaffAssignmentRole } from "@/server/auth/roles";
import { createServerRestFetch } from "@/server/http/server-fetch";
import { resolveCorrelationId } from "@/server/http/correlation";
import { httpStatusFor } from "@/server/http/status";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
  try {
    const parsed = parseBody(await request.json() as unknown);
    if (!parsed) {
      return NextResponse.json({
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Staff account request is invalid.",
          retryable: false,
          nextAction: "resolve",
        },
        correlationId: correlation.correlationId,
      }, {
        status: httpStatusFor("VALIDATION_ERROR"),
        headers: { "Cache-Control": "no-store", "X-Correlation-ID": correlation.correlationId },
      });
    }
    const fetchImpl = createServerRestFetch();
    const result = await handleCreateStaffAccount({
      correlationId: correlation.correlationId,
      cookieHeader: request.headers.get("cookie") ?? undefined,
      now: new Date(),
      sessions: composeStaffSessionStore(process.env, fetchImpl),
      assignments: composeStaffAssignmentDirectory(process.env, fetchImpl),
      controlPlane: composeControlPlaneDirectory(process.env),
      identities: composeStaffIdentityAdminStore(process.env),
      accessStatus: composeStaffAccessStatusAdminStore(process.env),
      memberships: composeControlMembershipAdminStore(process.env),
      staffAssignments: composeStaffAssignmentAdminStore(process.env),
      topology: composeManagementTopologyDirectory(process.env),
      audit: composeAdminAuditStore(process.env),
      ...parsed,
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
    return NextResponse.json({
      ok: false,
      error: {
        code: "INTEGRATION_UNAVAILABLE",
        message: "Staff account creation is unavailable.",
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

function parseBody(value: unknown): {
  readonly email: string;
  readonly displayName: string;
  readonly temporaryPassword: string;
  readonly controlRole: OrganizationControlRole | null;
  readonly locations: readonly {
    readonly locationId: string;
    readonly role: StaffAssignmentRole;
    readonly registerIds: readonly string[];
  }[];
  readonly enableAccess: boolean;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const root = value as Record<string, unknown>;
  if (typeof root.email !== "string" || typeof root.displayName !== "string" || typeof root.temporaryPassword !== "string") {
    return null;
  }
  if (root.controlRole !== null && root.controlRole !== "owner" && root.controlRole !== "admin" && root.controlRole !== "support") {
    return null;
  }
  if (!Array.isArray(root.locations) || typeof root.enableAccess !== "boolean") return null;
  const locations = [];
  for (const item of root.locations) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    if (typeof row.locationId !== "string" || (row.role !== "cashier" && row.role !== "manager")) return null;
    if (!Array.isArray(row.registerIds) || row.registerIds.some((id) => typeof id !== "string")) return null;
    const role: "cashier" | "manager" = row.role === "manager" ? "manager" : "cashier";
    locations.push({
      locationId: row.locationId,
      role,
      registerIds: row.registerIds.filter((id): id is string => typeof id === "string"),
    });
  }
  return {
    email: root.email,
    displayName: root.displayName,
    temporaryPassword: root.temporaryPassword,
    controlRole: root.controlRole,
    locations,
    enableAccess: root.enableAccess,
  };
}

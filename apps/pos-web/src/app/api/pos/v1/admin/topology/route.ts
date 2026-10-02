import { NextResponse, type NextRequest } from "next/server";
import { STAFF_CSRF_COOKIE, STAFF_CSRF_HEADER } from "../../../../../../config/auth";
import { staffAllowedOrigins } from "../../../../../../config/env";
import { parseCookieHeader } from "../../../../../../server/auth/cookies";
import { composeStaffSessionStore } from "../../../../../../server/auth/compose-session-store";
import { composeStaffAssignmentDirectory } from "../../../../../../server/sales/compose-assignment-directory";
import { composeControlPlaneDirectory } from "../../../../../../server/admin/compose-control-plane-directory";
import { composeManagementTopologyDirectory } from "../../../../../../server/admin/compose-management-topology-directory";
import {
  handleGetManagementTopology,
  handleSaveManagementTopology,
  type TopologySaveRequest,
} from "../../../../../../server/admin/handle-management-topology";
import { createServerRestFetch } from "../../../../../../server/http/server-fetch";
import { resolveCorrelationId } from "../../../../../../server/http/correlation";
import { httpStatusFor } from "../../../../../../server/http/status";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
  try {
    const fetchImpl = createServerRestFetch();
    const result = await handleGetManagementTopology({
      correlationId: correlation.correlationId,
      cookieHeader: request.headers.get("cookie") ?? undefined,
      now: new Date(),
      sessions: composeStaffSessionStore(process.env, fetchImpl),
      assignments: composeStaffAssignmentDirectory(process.env, fetchImpl),
      controlPlane: composeControlPlaneDirectory(process.env),
      topology: composeManagementTopologyDirectory(process.env),
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
        message: "management topology runtime is unavailable",
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
  try {
    const change = parseTopologyChange(await request.json() as unknown);
    if (!change) {
      return NextResponse.json({
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "That location, register, or device change is not allowed.",
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
    const result = await handleSaveManagementTopology({
      correlationId: correlation.correlationId,
      cookieHeader: request.headers.get("cookie") ?? undefined,
      now: new Date(),
      sessions: composeStaffSessionStore(process.env, fetchImpl),
      assignments: composeStaffAssignmentDirectory(process.env, fetchImpl),
      controlPlane: composeControlPlaneDirectory(process.env),
      topology: composeManagementTopologyDirectory(process.env),
      change,
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
        message: "The change could not be saved.",
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

function parseTopologyChange(value: unknown): TopologySaveRequest | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.kind === "location") {
    if (typeof row.name !== "string" || (row.status !== "active" && row.status !== "inactive")) return null;
    if (row.locationId != null && typeof row.locationId !== "string") return null;
    return {
      kind: "location",
      ...(typeof row.locationId === "string" ? { locationId: row.locationId } : {}),
      name: row.name,
      status: row.status,
    };
  }
  if (row.kind === "register") {
    if (typeof row.locationId !== "string" || typeof row.name !== "string") return null;
    if (row.status !== "active" && row.status !== "disabled" && row.status !== "maintenance") return null;
    if (row.registerId != null && typeof row.registerId !== "string") return null;
    if (row.currency != null && typeof row.currency !== "string") return null;
    return {
      kind: "register",
      locationId: row.locationId,
      ...(typeof row.registerId === "string" ? { registerId: row.registerId } : {}),
      name: row.name,
      ...(typeof row.currency === "string" ? { currency: row.currency } : {}),
      status: row.status,
    };
  }
  if (row.kind === "device") {
    if (typeof row.locationId !== "string" || typeof row.label !== "string") return null;
    if (row.status !== "active" && row.status !== "inactive") return null;
    if (row.deviceId != null && typeof row.deviceId !== "string") return null;
    return {
      kind: "device",
      locationId: row.locationId,
      ...(typeof row.deviceId === "string" ? { deviceId: row.deviceId } : {}),
      label: row.label,
      status: row.status,
    };
  }
  return null;
}

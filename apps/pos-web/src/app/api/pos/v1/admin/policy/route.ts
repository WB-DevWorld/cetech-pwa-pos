import { NextResponse, type NextRequest } from "next/server";
import { STAFF_CSRF_COOKIE, STAFF_CSRF_HEADER } from "../../../../../../config/auth";
import { staffAllowedOrigins } from "../../../../../../config/env";
import { composeStaffSessionStore } from "../../../../../../server/auth/compose-session-store";
import { parseCookieHeader } from "../../../../../../server/auth/cookies";
import { composeStaffAssignmentDirectory } from "../../../../../../server/sales/compose-assignment-directory";
import { composeControlPlaneDirectory } from "../../../../../../server/admin/compose-control-plane-directory";
import { composeOperationalPolicyStore } from "../../../../../../server/admin/compose-operational-policy-store";
import {
  handleGetOperationalPolicy,
  handleSetOperationalPolicy,
} from "../../../../../../server/admin/handle-operational-policy";
import { createServerRestFetch } from "../../../../../../server/http/server-fetch";
import { resolveCorrelationId } from "../../../../../../server/http/correlation";
import { httpStatusFor } from "../../../../../../server/http/status";
import type { ShiftClosePolicyOverride } from "../../../../../../server/auth/policy";

export async function GET(request: NextRequest): Promise<NextResponse> {
  return run(request, false);
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return run(request, true);
}

async function run(request: NextRequest, mutation: boolean): Promise<NextResponse> {
  const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
  try {
    const fetchImpl = createServerRestFetch();
    const common = {
      correlationId: correlation.correlationId,
      cookieHeader: request.headers.get("cookie") ?? undefined,
      now: new Date(),
      sessions: composeStaffSessionStore(process.env, fetchImpl),
      assignments: composeStaffAssignmentDirectory(process.env, fetchImpl),
      controlPlane: composeControlPlaneDirectory(process.env),
      policies: composeOperationalPolicyStore(process.env),
      locationId: request.nextUrl.searchParams.get("locationId") ?? undefined,
      registerId: request.nextUrl.searchParams.get("registerId") ?? undefined,
    };

    const result = mutation
      ? await handleSetOperationalPolicy({
          ...common,
          protection: {
            origin: request.headers.get("origin"),
            referer: request.headers.get("referer"),
            csrfCookie: parseCookieHeader(request.headers.get("cookie") ?? undefined)[STAFF_CSRF_COOKIE] ?? null,
            csrfHeader: request.headers.get(STAFF_CSRF_HEADER),
            allowedOrigins: staffAllowedOrigins(),
          },
          override: await readOverride(request),
        })
      : await handleGetOperationalPolicy(common);

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
        message: "operational policy runtime is unavailable",
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

async function readOverride(request: NextRequest): Promise<ShiftClosePolicyOverride> {
  const body = (await request.json()) as unknown;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {};
  }
  const root = body as Record<string, unknown>;
  return {
    ...(typeof root.cashierCanCloseShift === "boolean"
      ? { cashierCanCloseShift: root.cashierCanCloseShift }
      : {}),
    ...(typeof root.managerCanCloseShift === "boolean"
      ? { managerCanCloseShift: root.managerCanCloseShift }
      : {}),
    ...(typeof root.cashierOwnShiftOnly === "boolean"
      ? { cashierOwnShiftOnly: root.cashierOwnShiftOnly }
      : {}),
    ...(typeof root.managerCanCloseOthersShift === "boolean"
      ? { managerCanCloseOthersShift: root.managerCanCloseOthersShift }
      : {}),
    ...(typeof root.nonZeroVarianceRequiresManager === "boolean"
      ? { nonZeroVarianceRequiresManager: root.nonZeroVarianceRequiresManager }
      : {}),
    ...(typeof root.varianceToleranceMinor === "number"
      ? { varianceToleranceMinor: root.varianceToleranceMinor }
      : {}),
    ...(typeof root.varianceCurrency === "string"
      ? { varianceCurrency: root.varianceCurrency }
      : {}),
  };
}

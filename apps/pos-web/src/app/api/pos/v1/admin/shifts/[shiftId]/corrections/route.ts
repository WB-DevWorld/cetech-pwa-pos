import { NextResponse, type NextRequest } from "next/server";
import { STAFF_CSRF_COOKIE, STAFF_CSRF_HEADER } from "@/config/auth";
import { staffAllowedOrigins } from "@/config/env";
import { parseCookieHeader } from "@/server/auth/cookies";
import { composeCashCorrectionAdminStore } from "@/server/admin/compose-cash-correction-admin-store";
import { composeControlPlaneDirectory } from "@/server/admin/compose-control-plane-directory";
import { handleManagementCashCorrection } from "@/server/admin/handle-management-cash-correction";
import { resolveCorrelationId } from "@/server/http/correlation";
import { httpStatusFor } from "@/server/http/status";
import { composePosCommandHandlers } from "@/server/sales/compose-pos-command-runtime";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ shiftId: string }> },
): Promise<NextResponse> {
  const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
  const composed = composePosCommandHandlers(request);
  if (!composed.ok) return composed.response;
  try {
    const body = await request.json() as unknown;
    const parsed = parseBody(body);
    if (!parsed) {
      const result = {
        ok: false as const,
        error: {
          code: "VALIDATION_ERROR" as const,
          message: "cash correction request is invalid",
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
    const { shiftId } = await context.params;
    const result = await handleManagementCashCorrection({
      correlationId: correlation.correlationId,
      cookieHeader: request.headers.get("cookie") ?? undefined,
      now: new Date(),
      sessions: composed.sessionStore,
      assignments: composed.assignments,
      controlPlane: composeControlPlaneDirectory(process.env),
      checkout: composed.runtime.store,
      corrections: composeCashCorrectionAdminStore(process.env),
      shiftId,
      movementId: parsed.movementId,
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
        message: "cash correction is unavailable",
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

function parseBody(value: unknown): { readonly movementId: string; readonly reason: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const root = value as Record<string, unknown>;
  if (typeof root.movementId !== "string" || typeof root.reason !== "string") return null;
  return { movementId: root.movementId, reason: root.reason };
}

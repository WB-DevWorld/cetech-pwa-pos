import { NextResponse, type NextRequest } from "next/server";
import { STAFF_CSRF_COOKIE, STAFF_CSRF_HEADER } from "../../../../../../config/auth";
import { staffAllowedOrigins } from "../../../../../../config/env";
import { parseCookieHeader } from "../../../../../../server/auth/cookies";
import { composeStaffSessionStore } from "../../../../../../server/auth/compose-session-store";
import { composeStaffIdentityAdminStore } from "../../../../../../server/admin/compose-staff-identity-admin-store";
import { handleChangeRequiredPassword } from "../../../../../../server/auth/handle-change-password";
import { createServerRestFetch } from "../../../../../../server/http/server-fetch";
import { resolveCorrelationId } from "../../../../../../server/http/correlation";
import { httpStatusFor } from "../../../../../../server/http/status";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
  try {
    const body = await request.json() as unknown;
    const password = body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).password
      : undefined;
    if (typeof password !== "string") {
      return NextResponse.json({
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Enter a new password.",
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
    const result = await handleChangeRequiredPassword({
      correlationId: correlation.correlationId,
      cookieHeader: request.headers.get("cookie") ?? undefined,
      now: new Date(),
      sessions: composeStaffSessionStore(process.env, fetchImpl),
      identities: composeStaffIdentityAdminStore(process.env),
      password,
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
        message: "Password change is unavailable.",
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

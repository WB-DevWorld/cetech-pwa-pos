import { NextResponse, type NextRequest } from "next/server";
import { staffAllowedOrigins } from "@/config/env";
import { handleRegisterClosePresentation } from "@/server/sales/handle-register-close-presentation";
import { composePosCommandHandlers } from "@/server/sales/compose-pos-command-runtime";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ registerId: string }> },
): Promise<NextResponse> {
  const composed = composePosCommandHandlers(request);
  if (!composed.ok) return composed.response;
  const { registerId } = await context.params;
  const result = await handleRegisterClosePresentation({
    correlationIdHeader: request.headers.get("x-correlation-id") ?? undefined,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    cookieHeader: request.headers.get("cookie") ?? undefined,
    csrfHeader: request.headers.get("x-csrf-token"),
    registerId,
    now: new Date(),
    sessionStore: composed.sessionStore,
    allowedOrigins: staffAllowedOrigins(),
    checkoutStore: composed.runtime.store,
    assignments: composed.assignments,
    policies: composed.policies,
  });
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

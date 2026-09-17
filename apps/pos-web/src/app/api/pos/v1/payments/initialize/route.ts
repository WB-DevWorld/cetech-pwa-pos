import { NextResponse, type NextRequest } from "next/server";
import { staffAllowedOrigins } from "../../../../../../config/env";
import { STAFF_CSRF_HEADER } from "../../../../../../config/auth";
import { composePosCommandHandlers } from "../../../../../../server/sales/compose-pos-command-runtime";
import { handleInitializePayment } from "../../../../../../server/payments/handle-initialize-payment";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const composed = composePosCommandHandlers(request);
  if (!composed.ok) {
    return composed.response;
  }
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const result = await handleInitializePayment({
    correlationIdHeader: request.headers.get("x-correlation-id") ?? undefined,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    cookieHeader: request.headers.get("cookie") ?? undefined,
    csrfHeader: request.headers.get(STAFF_CSRF_HEADER),
    idempotencyKeyHeader: request.headers.get("idempotency-key"),
    body,
    now: new Date(),
    sessionStore: composed.sessionStore,
    allowedOrigins: staffAllowedOrigins(),
    checkoutStore: composed.runtime.store,
    assignments: composed.assignments,
    provider: composed.payments.kind === "ready" ? composed.payments.provider : undefined,
    appEnv: process.env.APP_ENV ?? "local",
    sandboxPayerEmail: composed.payments.kind === "ready" ? composed.payments.sandboxPayerEmail : undefined,
    env: process.env,
  });
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

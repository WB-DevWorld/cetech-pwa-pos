import { NextResponse, type NextRequest } from "next/server";
import { composeStaffSessionStore } from "../auth/compose-session-store";
import { authFailure } from "../auth/errors";
import { createServerRestFetch } from "../http/server-fetch";
import { resolveCorrelationId } from "../http/correlation";
import { httpStatusFor } from "../http/status";
import { composeElectronicPaymentProvider } from "../payments/compose-payment-provider";
import { composeCheckoutRuntime } from "./compose-checkout-runtime";
import { composeStaffAssignmentDirectory } from "./compose-assignment-directory";

export function composePosCommandHandlers(request: NextRequest) {
  try {
    const fetchImpl = createServerRestFetch();
    const payments = composeElectronicPaymentProvider(process.env);
    return {
      ok: true as const,
      sessionStore: composeStaffSessionStore(process.env, fetchImpl),
      runtime: composeCheckoutRuntime(process.env, fetchImpl),
      assignments: composeStaffAssignmentDirectory(process.env, fetchImpl),
      payments,
    };
  } catch {
    const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
    const body = authFailure(
      "INTEGRATION_UNAVAILABLE",
      "durable staff session and checkout stores are required",
      correlation.correlationId,
    );
    return {
      ok: false as const,
      response: NextResponse.json(body, {
        status: httpStatusFor(body.error.code),
        headers: { "Cache-Control": "no-store", "X-Correlation-ID": body.correlationId },
      }),
    };
  }
}

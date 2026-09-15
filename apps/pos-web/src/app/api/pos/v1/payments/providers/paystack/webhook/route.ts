import { NextResponse, type NextRequest } from "next/server";
import { composePosCommandHandlers } from "../../../../../../../../server/sales/compose-pos-command-runtime";
import { handlePaystackWebhook } from "../../../../../../../../server/payments/handle-paystack-webhook";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const composed = composePosCommandHandlers(request);
  if (!composed.ok) {
    return composed.response;
  }
  const rawBody = await request.text();
  const result = await handlePaystackWebhook({
    correlationIdHeader: request.headers.get("x-correlation-id") ?? undefined,
    rawBody,
    signature: request.headers.get("x-paystack-signature"),
    now: new Date(),
    checkoutStore: composed.runtime.store,
    provider: composed.payments.kind === "ready" ? composed.payments.provider : undefined,
  });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}

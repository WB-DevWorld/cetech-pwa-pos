import { NextResponse, type NextRequest } from "next/server";
import { resolveCorrelationId } from "../../../../../../server/http/correlation";

/**
 * Browser/provider redirect hint only. Query status is not payment truth.
 * Staff clients must call PaymentPort.resolve. This route never verifies,
 * never constructs VerifiedPaymentEvidence, and never calls Woo.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
  return NextResponse.json(
    {
      ok: true,
      data: { message: "payment is being checked" },
      correlationId: correlation.correlationId,
    },
    { status: 200, headers: { "Cache-Control": "no-store", "X-Correlation-ID": correlation.correlationId } },
  );
}

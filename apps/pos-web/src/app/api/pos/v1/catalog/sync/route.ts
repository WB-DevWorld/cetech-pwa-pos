import { NextResponse, type NextRequest } from "next/server";
import { readAppEnv } from "../../../../../../config/env";
import { composeStaffSessionStore } from "../../../../../../server/auth/compose-session-store";
import { composeCatalogBridge } from "../../../../../../server/catalog/compose-catalog-bridge";
import { handleCatalogSync } from "../../../../../../server/catalog/handle-catalog-sync";
import { createServerRestFetch } from "../../../../../../server/http/server-fetch";
import { authFailure } from "../../../../../../server/auth/errors";
import { resolveCorrelationId } from "../../../../../../server/http/correlation";
import { httpStatusFor } from "../../../../../../server/http/status";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const fetchImpl = createServerRestFetch();
  let sessionStore;
  try {
    sessionStore = composeStaffSessionStore(process.env, fetchImpl);
  } catch {
    const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
    const body = authFailure(
      "INTEGRATION_UNAVAILABLE",
      "durable staff session store is required",
      correlation.correlationId,
    );
    return NextResponse.json(body, {
      status: httpStatusFor(body.error.code),
      headers: { "Cache-Control": "no-store", "X-Correlation-ID": body.correlationId },
    });
  }
  const result = await handleCatalogSync({
    correlationIdHeader: request.headers.get("x-correlation-id") ?? undefined,
    cookieHeader: request.headers.get("cookie") ?? undefined,
    cursor: request.nextUrl.searchParams.get("cursor"),
    limit: request.nextUrl.searchParams.get("limit"),
    modifiedAfter: request.nextUrl.searchParams.get("modifiedAfter"),
    now: new Date(),
    appEnv: readAppEnv(),
    sessionStore,
    bridge: composeCatalogBridge(process.env, fetchImpl),
  });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}

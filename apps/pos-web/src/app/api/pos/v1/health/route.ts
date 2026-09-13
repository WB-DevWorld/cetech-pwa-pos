import { NextResponse, type NextRequest } from "next/server";
import { readServerEnv } from "../../../../../config/env";
import { composeStaffSessionStore } from "../../../../../server/auth/compose-session-store";
import { authFailure } from "../../../../../server/auth/errors";
import {
  composeBridgeHealthInspect,
  createServerBridgeFetch,
} from "../../../../../server/health/compose-bridge-health";
import { handleStoreHealth } from "../../../../../server/health/handle-store-health";
import { composeSupabaseHealthProbe } from "../../../../../server/health/supabase-health-probe";
import { createServerRestFetch } from "../../../../../server/http/server-fetch";
import { resolveCorrelationId } from "../../../../../server/http/correlation";
import { httpStatusFor } from "../../../../../server/http/status";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const env = readServerEnv();
  const restFetch = createServerRestFetch();
  let sessionStore;
  try {
    sessionStore = composeStaffSessionStore(process.env, restFetch);
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
  const inspectBridge = composeBridgeHealthInspect(process.env, createServerBridgeFetch());
  const result = await handleStoreHealth({
    correlationIdHeader: request.headers.get("x-correlation-id") ?? undefined,
    cookieHeader: request.headers.get("cookie") ?? undefined,
    now: new Date(),
    sessionStore,
    inspectBridge,
    supabaseProbe: composeSupabaseHealthProbe(process.env, restFetch),
    supabaseConfigured: Boolean(env.supabaseUrl),
    bridgeConfigured: Boolean(env.bridgeBaseUrl) || inspectBridge !== undefined,
    buildId: env.buildId,
  });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}

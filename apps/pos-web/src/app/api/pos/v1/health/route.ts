import { NextResponse, type NextRequest } from "next/server";
import { readServerEnv } from "../../../../../config/env";
import { getEphemeralDevStaffSessionStore } from "../../../../../server/auth/session-store";
import {
  composeBridgeHealthInspect,
  createServerBridgeFetch,
} from "../../../../../server/health/compose-bridge-health";
import { handleStoreHealth } from "../../../../../server/health/handle-store-health";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const env = readServerEnv();
  const inspectBridge = composeBridgeHealthInspect(process.env, createServerBridgeFetch());
  const result = await handleStoreHealth({
    correlationIdHeader: request.headers.get("x-correlation-id") ?? undefined,
    cookieHeader: request.headers.get("cookie") ?? undefined,
    now: new Date(),
    sessionStore: getEphemeralDevStaffSessionStore(),
    inspectBridge,
    supabaseConfigured: Boolean(env.supabaseUrl),
    bridgeConfigured: Boolean(env.bridgeBaseUrl) || inspectBridge !== undefined,
    buildId: env.buildId,
  });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}

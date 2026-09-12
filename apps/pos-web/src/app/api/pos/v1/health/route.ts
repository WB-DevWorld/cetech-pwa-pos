import { NextResponse, type NextRequest } from "next/server";
import { readServerEnv } from "../../../../../config/env";
import { getEphemeralDevStaffSessionStore } from "../../../../../server/auth/session-store";
import { handleStoreHealth } from "../../../../../server/health/handle-store-health";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const env = readServerEnv();
  const result = await handleStoreHealth({
    correlationIdHeader: request.headers.get("x-correlation-id") ?? undefined,
    cookieHeader: request.headers.get("cookie") ?? undefined,
    now: new Date(),
    sessionStore: getEphemeralDevStaffSessionStore(),
    supabaseConfigured: Boolean(env.supabaseUrl),
    bridgeConfigured: Boolean(env.bridgeBaseUrl),
    buildId: env.buildId,
  });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}

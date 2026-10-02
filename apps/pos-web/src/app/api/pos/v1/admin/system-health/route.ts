import { NextResponse, type NextRequest } from "next/server";
import { readServerEnv } from "../../../../../../config/env";
import { composeStaffSessionStore } from "../../../../../../server/auth/compose-session-store";
import { composeStaffAssignmentDirectory } from "../../../../../../server/sales/compose-assignment-directory";
import { composeControlPlaneDirectory } from "../../../../../../server/admin/compose-control-plane-directory";
import { handleGetManagementSystemHealth } from "../../../../../../server/admin/handle-management-system-health";
import {
  composeBridgeHealthInspect,
  createServerBridgeFetch,
} from "../../../../../../server/health/compose-bridge-health";
import { handleStoreHealth } from "../../../../../../server/health/handle-store-health";
import { composeSupabaseHealthProbe } from "../../../../../../server/health/supabase-health-probe";
import { createServerRestFetch } from "../../../../../../server/http/server-fetch";
import { resolveCorrelationId } from "../../../../../../server/http/correlation";
import { httpStatusFor } from "../../../../../../server/http/status";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
  try {
    const env = readServerEnv();
    const fetchImpl = createServerRestFetch();
    const cookieHeader = request.headers.get("cookie") ?? undefined;
    const inspectBridge = composeBridgeHealthInspect(process.env, createServerBridgeFetch());
    const result = await handleGetManagementSystemHealth({
      correlationId: correlation.correlationId,
      cookieHeader,
      now: new Date(),
      sessions: composeStaffSessionStore(process.env, fetchImpl),
      assignments: composeStaffAssignmentDirectory(process.env, fetchImpl),
      controlPlane: composeControlPlaneDirectory(process.env),
      readHealth: async () => {
        const health = await handleStoreHealth({
          correlationIdHeader: correlation.correlationId,
          cookieHeader,
          now: new Date(),
          sessionStore: composeStaffSessionStore(process.env, fetchImpl),
          inspectBridge,
          supabaseProbe: composeSupabaseHealthProbe(process.env, fetchImpl),
          supabaseConfigured: Boolean(env.supabaseUrl),
          bridgeConfigured: Boolean(env.bridgeBaseUrl) || inspectBridge !== undefined,
          buildId: env.buildId,
        });
        return health.body.ok ? health.body.data : "unavailable";
      },
    });
    return NextResponse.json(result, {
      status: result.ok ? 200 : httpStatusFor(result.error.code),
      headers: {
        "Cache-Control": "no-store",
        "X-Correlation-ID": result.correlationId,
      },
    });
  } catch {
    return NextResponse.json({
      ok: false as const,
      error: {
        code: "INTEGRATION_UNAVAILABLE" as const,
        message: "system health is unavailable",
        retryable: true,
        nextAction: "resolve" as const,
      },
      correlationId: correlation.correlationId,
    }, {
      status: httpStatusFor("INTEGRATION_UNAVAILABLE"),
      headers: {
        "Cache-Control": "no-store",
        "X-Correlation-ID": correlation.correlationId,
      },
    });
  }
}

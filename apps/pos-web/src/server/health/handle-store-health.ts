import { STAFF_SESSION_COOKIE } from "../../config/auth";
import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { BridgeHealth, HealthCheck, StoreHealth, Uuid } from "../../../../../docs/contracts/domain.generated";
import { authFailure } from "../auth/errors";
import { toIsoTimestamp } from "../auth/ids";
import type { StaffSessionStore } from "../auth/session-store";
import { resolveCorrelationId } from "../http/correlation";
import { httpStatusFor } from "../http/status";
import type { BridgeInspect } from "./compose-bridge-health";
import {
  assembleStoreHealth,
  assertPrepOnlyBridgeHealth,
  createSkippedProbe,
  detectionMessage,
  mockBridgeHealth,
  withoutClaimedPricingParity,
  type HealthProbe,
} from "./probes";

export type StoreHealthRequest = {
  readonly correlationIdHeader?: string;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly supabaseProbe?: HealthProbe;
  readonly bridgeProbe?: HealthProbe;
  /** Mapped BridgeHealth from an injected adapter when inspectBridge is not used. */
  readonly bridgeHealth?: BridgeHealth;
  /** Composed BR-01 inspect. When set, it owns the bridge check and mapped health. */
  readonly inspectBridge?: BridgeInspect;
  readonly supabaseConfigured: boolean;
  readonly bridgeConfigured: boolean;
  readonly buildId: string;
};

export type StoreHealthResponse = {
  readonly status: number;
  readonly body: ApiResult<StoreHealth>;
  readonly headers: { readonly "Cache-Control": "no-store"; readonly "X-Correlation-ID": Uuid };
};

export async function handleStoreHealth(input: StoreHealthRequest): Promise<StoreHealthResponse> {
  const correlation = resolveCorrelationId(input.correlationIdHeader);
  const headers = { "Cache-Control": "no-store" as const, "X-Correlation-ID": correlation.correlationId };
  if (!correlation.ok) {
    const body = authFailure("VALIDATION_ERROR", "X-Correlation-ID must be a UUID", correlation.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers };
  }

  const sessionId = readCookie(input.cookieHeader, STAFF_SESSION_COOKIE);
  let stored = null;
  try {
    stored = sessionId ? await input.sessionStore.get(sessionId, input.now) : null;
  } catch {
    const body = authFailure(
      "INTEGRATION_UNAVAILABLE",
      "staff session store is unavailable",
      correlation.correlationId,
    );
    return { status: httpStatusFor(body.error.code), body, headers };
  }
  if (!stored) {
    const body = authFailure("AUTH_REQUIRED", "staff session is required", correlation.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers };
  }

  const supabaseProbe =
    input.supabaseProbe ??
    createSkippedProbe(
      "supabase",
      input.supabaseConfigured
        ? "live supabase probe skipped; PREP_ONLY mock"
        : "supabase is not configured",
    );
  const supabase = await runProbe(supabaseProbe, input.now, "supabase");
  const { bridge, bridgeHealth } = await resolveBridge(input, correlation.correlationId);

  const contractCheck: HealthCheck = {
    id: "bridge-contract",
    status: "unverified",
    message: detectionMessage(bridgeHealth),
    checkedAt: toIsoTimestamp(input.now),
  };

  const data = assembleStoreHealth({
    checks: [supabase, bridge, contractCheck],
    buildId: input.buildId,
  });
  return {
    status: 200,
    body: { ok: true, data, correlationId: correlation.correlationId },
    headers,
  };
}

async function resolveBridge(
  input: StoreHealthRequest,
  correlationId: Uuid,
): Promise<{ bridge: HealthCheck; bridgeHealth: BridgeHealth }> {
  if (input.inspectBridge) {
    try {
      const inspected = await input.inspectBridge(correlationId, input.now);
      return {
        bridge: inspected.check,
        bridgeHealth: withoutClaimedPricingParity(inspected.health),
      };
    } catch {
      return {
        bridge: {
          id: "bridge",
          status: "unavailable",
          message: "health probe failed; not trusted access",
          checkedAt: toIsoTimestamp(input.now),
        },
        bridgeHealth: mockBridgeHealth(),
      };
    }
  }
  const bridgeProbe =
    input.bridgeProbe ??
    createSkippedProbe(
      "bridge",
      input.bridgeConfigured
        ? "live bridge probe skipped; PREP_ONLY mock. detection is not pricing parity"
        : "bridge is not configured",
    );
  const bridge = await runProbe(bridgeProbe, input.now, "bridge");
  const bridgeHealth = input.bridgeHealth
    ? withoutClaimedPricingParity(input.bridgeHealth)
    : mockBridgeHealth();
  if (!input.bridgeHealth) {
    assertPrepOnlyBridgeHealth(bridgeHealth);
  }
  return { bridge, bridgeHealth };
}

async function runProbe(probe: HealthProbe, now: Date, id: string): Promise<HealthCheck> {
  try {
    return await probe.check(now);
  } catch {
    return {
      id,
      status: "unavailable",
      message: "health probe failed; not trusted access",
      checkedAt: toIsoTimestamp(now),
    };
  }
}

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 1) {
      continue;
    }
    if (trimmed.slice(0, eq).trim() === name) {
      return trimmed.slice(eq + 1).trim();
    }
  }
  return null;
}

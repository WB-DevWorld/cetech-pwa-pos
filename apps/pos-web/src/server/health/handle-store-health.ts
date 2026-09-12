import { STAFF_SESSION_COOKIE } from "../../config/auth";
import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { HealthCheck, StoreHealth, Uuid } from "../../../../../docs/contracts/domain.generated";
import { authFailure } from "../auth/errors";
import { toIsoTimestamp } from "../auth/ids";
import type { StaffSessionStore } from "../auth/session-store";
import { resolveCorrelationId } from "../http/correlation";
import { httpStatusFor } from "../http/status";
import {
  assembleStoreHealth,
  assertPrepOnlyBridgeHealth,
  createSkippedProbe,
  mockBridgeHealth,
  type HealthProbe,
} from "./probes";

export type StoreHealthRequest = {
  readonly correlationIdHeader?: string;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly supabaseProbe?: HealthProbe;
  readonly bridgeProbe?: HealthProbe;
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
  const stored = sessionId ? await input.sessionStore.get(sessionId, input.now) : null;
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
  const bridgeProbe =
    input.bridgeProbe ??
    createSkippedProbe(
      "bridge",
      input.bridgeConfigured
        ? "live bridge probe skipped; PREP_ONLY mock. detection is not pricing parity"
        : "bridge is not configured",
    );
  const [supabase, bridge] = await Promise.all([
    runProbe(supabaseProbe, input.now, "supabase"),
    runProbe(bridgeProbe, input.now, "bridge"),
  ]);
  const bridgeHealth = mockBridgeHealth();
  assertPrepOnlyBridgeHealth(bridgeHealth);

  const contractCheck: HealthCheck = {
    id: "bridge-contract",
    status: "unverified",
    message:
      `wooDetected=${bridgeHealth.wooDetected} woodmartDetected=${bridgeHealth.woodmartDetected} ` +
      `b2bkingDetected=${bridgeHealth.b2bkingDetected} pricingParityVerified=${bridgeHealth.pricingParityVerified}; ` +
      "detection is not pricing parity",
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

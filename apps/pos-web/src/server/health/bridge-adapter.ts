import type { BridgeHealth, HealthCheck, Uuid } from "../../../../../docs/contracts/domain.generated";
import { isUuid, toIsoTimestamp } from "../auth/ids";
import { detectionMessage, withoutClaimedPricingParity, type HealthProbe } from "./probes";

export type BridgeFetchLike = (
  input: string,
  init: { readonly headers: Record<string, string>; readonly signal?: AbortSignal },
) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  readonly json: () => Promise<unknown>;
  readonly header?: (name: string) => string | null;
}>;

export type BridgeServiceIdentity = {
  readonly authorizationHeader: string;
};

/**
 * Health-only deadline. Training bridge startup has been measured around 9s,
 * so the previous 5s default reported a timeout while a longer quote could
 * still succeed. This does not change quote, payment, or other operational
 * deadlines. 12s covers that measured startup with a small bound.
 */
export const BRIDGE_HEALTH_PROBE_DEADLINE_MS = 12_000;

export type BridgeHealthClientOptions = {
  readonly baseUrl: string;
  readonly username: string;
  readonly applicationPassword: string;
  readonly fetchImpl: BridgeFetchLike;
  readonly timeoutMs?: number;
};

/**
 * BFF-held WordPress application-password identity. This is not a staff session
 * and must not be a Supabase service-role credential.
 */
export function createBridgeServiceIdentity(input: {
  readonly username: string;
  readonly applicationPassword: string;
}): BridgeServiceIdentity {
  const username = input.username.trim();
  const applicationPassword = input.applicationPassword.trim();
  if (!username || !applicationPassword) {
    throw new Error("bridge service identity is incomplete");
  }
  if (looksLikeServiceRole(username) || looksLikeServiceRole(applicationPassword)) {
    throw new Error("service-role credential must not be used as bridge authorization");
  }
  return {
    authorizationHeader: `Basic ${Buffer.from(`${username}:${applicationPassword}`, "utf8").toString("base64")}`,
  };
}

/**
 * BFF → bridge health/permission adapter against frozen BridgeHealth.
 * Requires an injected fetchImpl; there is no default live WordPress client.
 * Detection flags may be mapped; pricingParityVerified is always false.
 */
export function createBridgeHealthClient(options: BridgeHealthClientOptions) {
  const identity = createBridgeServiceIdentity({
    username: options.username,
    applicationPassword: options.applicationPassword,
  });
  const healthUrl = bridgeHealthUrl(options.baseUrl);
  const timeoutMs = options.timeoutMs ?? BRIDGE_HEALTH_PROBE_DEADLINE_MS;
  const fetchImpl = options.fetchImpl;

  return {
    map(body: unknown): BridgeHealth {
      return mapBridgeHealth(body);
    },
    probe(correlationId: Uuid): HealthProbe {
      return {
        async check(now: Date): Promise<HealthCheck> {
          const inspected = await inspectBridgeHealth({
            fetchImpl,
            url: healthUrl,
            authorizationHeader: identity.authorizationHeader,
            correlationId,
            timeoutMs,
            now,
          });
          return inspected.check;
        },
      };
    },
    async inspect(correlationId: Uuid, now: Date): Promise<{ check: HealthCheck; health: BridgeHealth }> {
      return inspectBridgeHealth({
        fetchImpl,
        url: healthUrl,
        authorizationHeader: identity.authorizationHeader,
        correlationId,
        timeoutMs,
        now,
      });
    },
  };
}

/** Always GET /wp-json/cetech-pos/v1/health regardless of whether the env base is the site origin or the REST prefix. */
export function bridgeHealthUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/wp-json/cetech-pos/v1/health")) {
    return trimmed;
  }
  if (trimmed.endsWith("/wp-json/cetech-pos/v1")) {
    return `${trimmed}/health`;
  }
  return `${trimmed}/wp-json/cetech-pos/v1/health`;
}

export function mapBridgeHealth(body: unknown): BridgeHealth {
  if (body === null || typeof body !== "object") return unavailableHealth();
  const root = body as Record<string, unknown>;
  if (root.ok !== true || root.data === null || typeof root.data !== "object") return unavailableHealth();
  const data = root.data as Record<string, unknown>;
  const status = data.status;
  if (data.contractVersion !== "1.0.0") return unavailableHealth();
  if (status !== "healthy" && status !== "degraded" && status !== "unavailable") return unavailableHealth();
  if (
    typeof data.wooDetected !== "boolean" ||
    typeof data.woodmartDetected !== "boolean" ||
    typeof data.b2bkingDetected !== "boolean"
  ) {
    return unavailableHealth();
  }
  return withoutClaimedPricingParity({
    status,
    contractVersion: "1.0.0",
    wooDetected: data.wooDetected,
    woodmartDetected: data.woodmartDetected,
    b2bkingDetected: data.b2bkingDetected,
    pricingParityVerified: false,
  });
}

async function inspectBridgeHealth(input: {
  readonly fetchImpl: BridgeFetchLike;
  readonly url: string;
  readonly authorizationHeader: string;
  readonly correlationId: Uuid;
  readonly timeoutMs: number;
  readonly now: Date;
}): Promise<{ check: HealthCheck; health: BridgeHealth }> {
  if (!isUuid(input.correlationId)) {
    const health = unavailableHealth();
    return { health, check: checkOf(input.now, "bridge correlation is invalid") };
  }
  try {
    const response = await input.fetchImpl(input.url, {
      headers: {
        Authorization: input.authorizationHeader,
        Accept: "application/json",
        "X-Correlation-ID": input.correlationId,
      },
      signal: AbortSignal.timeout(input.timeoutMs),
    });
    if (response.status === 401 || response.status === 403) {
      const health = unavailableHealth();
      return { health, check: checkOf(input.now, "bridge denied the BFF service identity") };
    }
    if (!response.ok) {
      const health = unavailableHealth();
      return {
        health,
        check: checkOf(
          input.now,
          response.status >= 500 ? "bridge is unavailable" : "bridge health response is invalid",
        ),
      };
    }
    const body = await response.json();
    if (!correlationMatchesRequest(input.correlationId, body, response.header)) {
      const health = unavailableHealth();
      return {
        health,
        check: checkOf(input.now, "bridge correlation mismatch; not trusted access"),
      };
    }
    const health = mapBridgeHealth(body);
    return {
      health,
      check: {
        id: "bridge",
        status: reachabilityStatus(health.status),
        message: detectionMessage(health),
        checkedAt: toIsoTimestamp(input.now),
      },
    };
  } catch (error) {
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    const health = unavailableHealth();
    return {
      health,
      check: checkOf(
        input.now,
        timeout ? "bridge probe timed out; not trusted access" : "bridge probe failed; not trusted access",
      ),
    };
  }
}

/** Reachability only. Pricing parity stays false on the mapped BridgeHealth. */
function reachabilityStatus(status: BridgeHealth["status"]): HealthCheck["status"] {
  if (status === "healthy" || status === "degraded") return status;
  return "unavailable";
}

function unavailableHealth(): BridgeHealth {
  return withoutClaimedPricingParity({
    status: "unavailable",
    contractVersion: "1.0.0",
    wooDetected: false,
    woodmartDetected: false,
    b2bkingDetected: false,
    pricingParityVerified: false,
  });
}

function checkOf(now: Date, message: string): HealthCheck {
  return {
    id: "bridge",
    status: "unavailable",
    message,
    checkedAt: toIsoTimestamp(now),
  };
}

function correlationMatchesRequest(
  requestId: Uuid,
  body: unknown,
  header?: (name: string) => string | null,
): boolean {
  const echoed = envelopeCorrelationId(body);
  if (echoed !== requestId) {
    return false;
  }
  if (!header) {
    return true;
  }
  const headerId = header("x-correlation-id") ?? header("X-Correlation-ID");
  return headerId === null || headerId === requestId;
}

function envelopeCorrelationId(body: unknown): string | undefined {
  if (body === null || typeof body !== "object") {
    return undefined;
  }
  const id = (body as Record<string, unknown>).correlationId;
  return typeof id === "string" ? id : undefined;
}

function looksLikeServiceRole(value: string): boolean {
  const upper = value.toUpperCase();
  return upper.includes("SERVICE_ROLE") || upper.includes("SUPABASE_SECRET");
}

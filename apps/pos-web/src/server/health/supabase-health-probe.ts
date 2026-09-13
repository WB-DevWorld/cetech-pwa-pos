import { toIsoTimestamp } from "../auth/ids";
import type { HealthCheck } from "../../../../../docs/contracts/domain.generated";
import { readSupabaseInfrastructureEnv } from "../../config/env";
import type { PosRestFetch } from "../http/server-fetch";
import type { HealthProbe } from "./probes";

const DEFAULT_TIMEOUT_MS = 5_000;

export type SupabaseHealthProbeOptions = {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
};

/**
 * Read-only connectivity probe against POS-owned `pos_organizations`.
 * Does not use customer rows. Environment presence alone is not healthy.
 * service-role is infrastructure access, not command authorization.
 */
export function createSupabaseHealthProbe(options: SupabaseHealthProbeOptions): HealthProbe {
  const base = options.url.replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = `${base}/rest/v1/pos_organizations?select=id&limit=1`;

  return {
    async check(now) {
      try {
        const response = await options.fetchImpl(url, {
          method: "GET",
          headers: {
            apikey: options.serviceRoleKey,
            Authorization: `Bearer ${options.serviceRoleKey}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
        return mapStatus(response.status, now);
      } catch (error) {
        const timeout =
          error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
        return checkOf(
          now,
          timeout ? "unavailable" : "unavailable",
          timeout
            ? "supabase probe timed out; not trusted access"
            : "supabase probe failed; not trusted access",
        );
      }
    },
  };
}

export function composeSupabaseHealthProbe(
  env: Readonly<Record<string, string | undefined>>,
  fetchImpl: PosRestFetch | undefined,
): HealthProbe | undefined {
  const infrastructure = readSupabaseInfrastructureEnv(env);
  if (!infrastructure || !fetchImpl) {
    return undefined;
  }
  return createSupabaseHealthProbe({
    url: infrastructure.url,
    serviceRoleKey: infrastructure.serviceRoleKey,
    fetchImpl,
  });
}

function mapStatus(status: number, now: Date): HealthCheck {
  if (status === 401 || status === 403) {
    return checkOf(
      now,
      "degraded",
      "supabase denied the BFF infrastructure role; not business authorization",
    );
  }
  if (status >= 500) {
    return checkOf(now, "unavailable", "supabase is unavailable; not trusted access");
  }
  if (status >= 200 && status < 300) {
    return checkOf(
      now,
      "healthy",
      "POS operational schema reachable; connectivity only, not checkout or pricing",
    );
  }
  return checkOf(now, "unavailable", "supabase health response is invalid; not trusted access");
}

function checkOf(now: Date, status: HealthCheck["status"], message: string): HealthCheck {
  return {
    id: "supabase",
    status,
    message,
    checkedAt: toIsoTimestamp(now),
  };
}

import { readBridgeServiceEnv } from "../../config/env";
import type { BridgeHealth, HealthCheck, Uuid } from "../../../../../docs/contracts/domain.generated";
import { createBridgeHealthClient, type BridgeFetchLike } from "./bridge-adapter";

export type BridgeInspect = (
  correlationId: Uuid,
  now: Date,
) => Promise<{ check: HealthCheck; health: BridgeHealth }>;

/**
 * Compose the BR-01 health adapter for the BFF. Missing or placeholder service
 * identity stays unattached (no live WordPress). fetchImpl is required; this
 * module never invents a live client for tests.
 */
export function composeBridgeHealthInspect(
  env: Readonly<Record<string, string | undefined>>,
  fetchImpl: BridgeFetchLike | undefined,
): BridgeInspect | undefined {
  const identity = readBridgeServiceEnv(env);
  if (!identity || !fetchImpl) {
    return undefined;
  }
  const client = createBridgeHealthClient({
    baseUrl: identity.baseUrl,
    username: identity.username,
    applicationPassword: identity.applicationPassword,
    fetchImpl,
  });
  return (correlationId, now) => client.inspect(correlationId, now);
}

/**
 * Server fetch wrapper for Next composition. Not a default inside the adapter.
 * Do not call this from browser modules.
 */
export function createServerBridgeFetch(): BridgeFetchLike {
  return async (input, init) => {
    const response = await fetch(input, init);
    return {
      ok: response.ok,
      status: response.status,
      json: async () => response.json(),
      header: (name) => response.headers.get(name),
    };
  };
}

import type { BridgeHealth, HealthCheck, StoreHealth } from "../../../../../docs/contracts/domain.generated";
import { toIsoTimestamp } from "../auth/ids";

export type HealthProbe = {
  check(now: Date): Promise<HealthCheck>;
};

/**
 * PREP_ONLY: never contacts live Woo/bridge hosts. Detection flags stay false.
 * pricingParityVerified is always false; detection is not pricing parity.
 */
export function mockBridgeHealth(): BridgeHealth {
  return {
    status: "unavailable",
    contractVersion: "1.0.0",
    wooDetected: false,
    woodmartDetected: false,
    b2bkingDetected: false,
    pricingParityVerified: false,
  };
}

export function assertPrepOnlyBridgeHealth(health: BridgeHealth): void {
  if (
    health.status === "healthy" ||
    health.wooDetected ||
    health.woodmartDetected ||
    health.b2bkingDetected ||
    health.pricingParityVerified
  ) {
    throw new Error("PREP_ONLY mock must not claim live bridge detection or pricing parity");
  }
}

export function createSkippedProbe(id: string, message: string): HealthProbe {
  return {
    async check(now) {
      return {
        id,
        status: "unverified",
        message,
        checkedAt: toIsoTimestamp(now),
      };
    },
  };
}

export function assembleStoreHealth(input: {
  readonly checks: readonly HealthCheck[];
  readonly buildId: string;
  readonly pendingOperationCount?: number;
  readonly attentionCount?: number;
}): StoreHealth {
  return {
    checks: [...input.checks],
    contractVersion: "1.0.0",
    pendingOperationCount: input.pendingOperationCount ?? 0,
    attentionCount: input.attentionCount ?? 0,
    buildId: input.buildId,
  };
}

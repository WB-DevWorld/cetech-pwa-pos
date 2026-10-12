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

export function withoutClaimedPricingParity(health: BridgeHealth): BridgeHealth {
  return { ...health, pricingParityVerified: false };
}

/**
 * Separate from bridge reachability and from pricing qualification.
 * Detection is not proof that prices are correct.
 */
export function dependencyHealthCheck(health: BridgeHealth, now: Date): HealthCheck {
  if (health.status === "unavailable") {
    return {
      id: "bridge-dependencies",
      status: "unavailable",
      message: "dependency health was not confirmed; detection is not pricing parity",
      checkedAt: toIsoTimestamp(now),
    };
  }
  const missing = [
    health.wooDetected ? null : "woocommerce",
    health.woodmartDetected ? null : "woodmart",
    health.b2bkingDetected ? null : "b2bking",
  ].filter((item): item is string => item !== null);
  if (missing.length === 0) {
    return {
      id: "bridge-dependencies",
      status: "healthy",
      message: "required store dependencies detected; detection is not pricing parity",
      checkedAt: toIsoTimestamp(now),
    };
  }
  return {
    id: "bridge-dependencies",
    status: "degraded",
    message: `missing or inactive dependencies: ${missing.join(", ")}; detection is not pricing parity`,
    checkedAt: toIsoTimestamp(now),
  };
}

export function detectionMessage(health: BridgeHealth): string {
  return (
    `wooDetected=${health.wooDetected} woodmartDetected=${health.woodmartDetected} ` +
    `b2bkingDetected=${health.b2bkingDetected} pricingParityVerified=${health.pricingParityVerified}; ` +
    "detection is not pricing parity"
  );
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

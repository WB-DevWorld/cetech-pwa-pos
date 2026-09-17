"use client";

import { useMemo } from "react";
import type { StoreHealth } from "../../../../../docs/contracts/domain.generated";
import type { ApiResult, HealthPort } from "../../../../../docs/contracts/ports";
import {
  StoreHealthScreen,
  useStoreHealth,
  type StoreHealthPorts,
} from "../../features/health";
import { inspectLocalRecoveryState } from "../../local";
import { usePwaLifecycle } from "../pwa-lifecycle-runtime";

function createBrowserHealthPort(): HealthPort {
  return {
    async getStoreHealth(): Promise<ApiResult<StoreHealth>> {
      const correlationId = crypto.randomUUID();
      try {
        const response = await fetch("/api/pos/v1/health", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { "x-correlation-id": correlationId },
        });
        return (await response.json()) as ApiResult<StoreHealth>;
      } catch {
        return {
          ok: false,
          error: {
            code: "INTEGRATION_UNAVAILABLE",
            message: "Store health transport failed.",
            retryable: true,
            nextAction: "none",
          },
          correlationId,
        };
      }
    },
  };
}

export function HealthRuntime() {
  const lifecycle = usePwaLifecycle();
  const health = useMemo(() => createBrowserHealthPort(), []);

  const ports = useMemo<StoreHealthPorts | undefined>(() => {
    if (!lifecycle) {
      return undefined;
    }
    return {
      health,
      getRecoveryDiagnostics: () => inspectLocalRecoveryState(),
      getLifecycleSnapshot: () => lifecycle.getLifecycleSnapshot(),
      activationDecision: () => lifecycle.activationDecision(),
      activateWaitingUpdate: () => lifecycle.activateWaitingUpdate(),
      checkForUpdate: () => lifecycle.checkForUpdate(),
    };
  }, [health, lifecycle]);

  const state = useStoreHealth(ports);

  if (!lifecycle || !ports) {
    return <p className="muted">Shared lifecycle runtime is unavailable. Update activation is disabled.</p>;
  }

  return (
    <StoreHealthScreen
      session={state.session}
      inFlight={state.inFlight}
      onRefresh={() => void state.refresh()}
      onCheckForUpdate={() => void state.checkForUpdate()}
      onActivateWaitingUpdate={() => void state.activateWaitingUpdate()}
    />
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoreHealth } from "../../../../../docs/contracts/domain.generated";
import type { ApiResult, HealthPort } from "../../../../../docs/contracts/ports";
import {
  StoreHealthScreen,
  useStoreHealth,
  type StoreHealthPorts,
} from "../../features/health";
import {
  createServiceWorkerLifecycle,
  inspectLocalRecoveryState,
  openPosLocalDatabase,
} from "../../local";

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
            nextAction: "retry",
          },
          correlationId,
        };
      }
    },
  };
}

async function buildSafetySnapshot() {
  const db = openPosLocalDatabase();
  const [diagnostics, journalRows, schemaRow] = await Promise.all([
    inspectLocalRecoveryState(db),
    db.journal.toArray(),
    db.schemaMeta.get("schema"),
  ]);
  const unresolved = journalRows.filter((row) => row.status !== "acknowledged");
  const activeTender = unresolved.some((row) => String(row.operation).startsWith("payment."));

  return {
    activeTender,
    criticalOperationCount: diagnostics.pendingOperationCount,
    syncMutationInProgress: false,
    localMigrationInProgress: !diagnostics.schemaCompatible,
    activeWindow: typeof document !== "undefined" && document.visibilityState === "visible",
    appBuild: schemaRow?.appBuild ?? "0",
  } as const;
}

export function HealthRuntime() {
  const [updateReady, setUpdateReady] = useState(false);
  const ownerId = useMemo(() => `health-${crypto.randomUUID()}`, []);
  const health = useMemo(() => createBrowserHealthPort(), []);
  const lifecycle = useMemo(
    () =>
      createServiceWorkerLifecycle({
        ownerId,
        getSafetySnapshot: buildSafetySnapshot,
        onUpdateReady: () => setUpdateReady(true),
      }),
    [ownerId],
  );

  useEffect(() => {
    void lifecycle.start();
    return () => lifecycle.stop();
  }, [lifecycle]);

  const ports = useMemo<StoreHealthPorts>(
    () => ({
      health,
      getRecoveryDiagnostics: () => inspectLocalRecoveryState(),
      getLifecycleSnapshot: async () => {
        const diagnostics = await inspectLocalRecoveryState();
        return {
          connectivity: navigator.onLine ? "online" : "offline",
          leadership: document.visibilityState === "visible" ? "active" : "passive",
          updateReady,
          unknownOperationPresent: diagnostics.attentionOperationCount > 0,
        };
      },
      activationDecision: () => lifecycle.activationDecision(),
      activateWaitingUpdate: async () => {
        const decision = await lifecycle.activateWaitingUpdate();
        if (decision.safe) setUpdateReady(false);
        return decision;
      },
      checkForUpdate: () => lifecycle.checkForUpdate(true),
    }),
    [health, lifecycle, updateReady],
  );

  const state = useStoreHealth(ports);

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

import type { ReleasePolicy } from "../../../../docs/contracts/domain.generated";
import type { UpdateSafetySnapshot } from "./pwa-lifecycle";
import { inspectLocalRecoveryState } from "./recovery-diagnostics";
import { hasActiveTender } from "./tender-activity";
import { openPosLocalDatabase } from "./pos-local-db";

export async function buildMountedSafetySnapshot(
  appBuild: string,
  releasePolicy: ReleasePolicy | undefined,
): Promise<UpdateSafetySnapshot> {
  const db = openPosLocalDatabase();
  const [diagnostics, activeTender] = await Promise.all([
    inspectLocalRecoveryState(db),
    hasActiveTender(db),
  ]);

  return {
    activeTender,
    criticalOperationCount: diagnostics.pendingOperationCount,
    syncMutationInProgress: false,
    localMigrationInProgress: !diagnostics.schemaCompatible,
    activeWindow: typeof document !== "undefined" && document.visibilityState === "visible",
    appBuild,
    releasePolicy,
  };
}

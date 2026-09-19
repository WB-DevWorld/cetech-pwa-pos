"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { UpdateReadyDialog, type UpdateSafetyView } from "../ui/operational";
import type { ReleasePolicy } from "../../../../docs/contracts/domain.generated";
import {
  createServiceWorkerLifecycle,
  inspectLocalRecoveryState,
  type ServiceWorkerLifecycleController,
  type UpdateActivationDecision,
} from "../local";
import { buildMountedSafetySnapshot } from "../local/mounted-update-safety";

export type SharedLifecycleSnapshot = {
  readonly connectivity: "online" | "offline" | "checking";
  readonly leadership: "active" | "passive" | "unknown";
  readonly updateReady: boolean;
  readonly releasePolicy?: ReleasePolicy;
  readonly unknownOperationPresent?: boolean;
};

export type PwaLifecycleApi = {
  readonly updateReady: boolean;
  readonly releasePolicy?: ReleasePolicy;
  activationDecision(): Promise<UpdateActivationDecision>;
  activateWaitingUpdate(): Promise<UpdateActivationDecision>;
  checkForUpdate(): Promise<void>;
  getLifecycleSnapshot(): Promise<SharedLifecycleSnapshot>;
};

const PwaLifecycleContext = createContext<PwaLifecycleApi | null>(null);

export function usePwaLifecycle(): PwaLifecycleApi | null {
  return useContext(PwaLifecycleContext);
}

export function PwaLifecycleRuntime({
  appBuild,
  initialReleasePolicy,
  children,
}: {
  appBuild: string;
  initialReleasePolicy?: ReleasePolicy;
  children: ReactNode;
}) {
  const [updateReady, setUpdateReady] = useState(false);
  const [releasePolicy, setReleasePolicy] = useState<ReleasePolicy | undefined>(initialReleasePolicy);
  const [activationDecision, setActivationDecision] = useState<UpdateActivationDecision | null>(null);
  const [updateDialogDismissed, setUpdateDialogDismissed] = useState(false);
  const ownerId = useMemo(() => `pwa-${crypto.randomUUID()}`, []);

  const lifecycle = useMemo(
    () =>
      createSharedPwaLifecycle({
        ownerId,
        appBuild,
        initialReleasePolicy,
        onReleasePolicy: setReleasePolicy,
        onUpdateReady: () => setUpdateReady(true),
      }),
    [appBuild, initialReleasePolicy, ownerId],
  );

  useEffect(() => {
    return bindPwaLifecycleEffects(lifecycle);
  }, [lifecycle]);

  useEffect(() => {
    if (!updateReady) {
      setActivationDecision(null);
      setUpdateDialogDismissed(false);
      return;
    }
    let cancelled = false;
    const refreshDecision = () => {
      void lifecycle.activationDecision().then((decision) => {
        if (!cancelled) setActivationDecision(decision);
      });
    };
    refreshDecision();
    const timer = window.setInterval(refreshDecision, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [lifecycle, updateReady]);

  const updateSafety: UpdateSafetyView =
    activationDecision?.safe === true
      ? "safe"
      : activationDecision && !activationDecision.safe &&
          activationDecision.reasons.every((reason) => reason === "PASSIVE_WINDOW")
        ? "defer"
        : "blocked_critical";

  const api = useMemo<PwaLifecycleApi>(
    () => ({
      updateReady,
      releasePolicy,
      activationDecision: () => lifecycle.activationDecision(),
      activateWaitingUpdate: async () => {
        const decision = await lifecycle.activateWaitingUpdate();
        if (decision.safe) setUpdateReady(false);
        return decision;
      },
      checkForUpdate: () => lifecycle.checkForUpdate(true),
      getLifecycleSnapshot: async () => {
        const diagnostics = await inspectLocalRecoveryState();
        return {
          connectivity: typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline",
          leadership:
            typeof document !== "undefined" && document.visibilityState === "visible" ? "active" : "passive",
          updateReady,
          releasePolicy,
          unknownOperationPresent: diagnostics.attentionOperationCount > 0,
        };
      },
    }),
    [lifecycle, releasePolicy, updateReady],
  );

  return (
    <PwaLifecycleContext.Provider value={api}>
      {children}
      <UpdateReadyDialog
        open={updateReady && !updateDialogDismissed}
        safety={updateSafety}
        currentBuild={appBuild}
        nextBuild={releasePolicy?.latestBuild}
        onLater={() => setUpdateDialogDismissed(true)}
        onApply={() => {
          void lifecycle.activateWaitingUpdate().then((decision) => {
            setActivationDecision(decision);
            if (decision.safe) {
              setUpdateReady(false);
              setUpdateDialogDismissed(false);
            }
          });
        }}
      />
    </PwaLifecycleContext.Provider>
  );
}

export function createSharedPwaLifecycle(options: {
  readonly ownerId: string;
  readonly appBuild: string;
  readonly initialReleasePolicy?: ReleasePolicy;
  readonly onReleasePolicy: (policy: ReleasePolicy) => void;
  readonly onUpdateReady: () => void;
}): ServiceWorkerLifecycleController {
  return createServiceWorkerLifecycle({
    ownerId: options.ownerId,
    appBuild: options.appBuild,
    getSafetySnapshot: () => buildMountedSafetySnapshot(options.appBuild, options.initialReleasePolicy),
    onReleasePolicy: options.onReleasePolicy,
    onUpdateReady: options.onUpdateReady,
  });
}

export function bindPwaLifecycleEffects(lifecycle: ServiceWorkerLifecycleController): () => void {
  void lifecycle.start();
  return () => lifecycle.stop();
}

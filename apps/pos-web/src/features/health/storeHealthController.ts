import type { ApiFailure } from "../../../../../docs/contracts/domain.generated";
import type { ApiResult, HealthPort } from "../../../../../docs/contracts/ports";
import {
  deriveOverallSeverity,
  HEALTH_FETCH_FAILED_COPY,
  idleStoreHealthSession,
  mapReleasePolicy,
  mapStoreHealth,
  type RecoveryDiagnosticsView,
  type StoreHealthLifecycleSnapshot,
  type StoreHealthSessionView,
  type UpdateActivationDecisionView,
} from "./storeHealthView";

export type StoreHealthPorts = {
  readonly health: HealthPort;
  readonly getRecoveryDiagnostics: () => Promise<RecoveryDiagnosticsView>;
  readonly getLifecycleSnapshot: () => StoreHealthLifecycleSnapshot | Promise<StoreHealthLifecycleSnapshot>;
  readonly activationDecision: () => Promise<UpdateActivationDecisionView>;
  readonly activateWaitingUpdate: () => Promise<UpdateActivationDecisionView>;
  readonly checkForUpdate: () => Promise<void>;
};

type UnknownOutcome = { readonly kind: "unknown"; readonly message: string };
type KnownOutcome<T> = { readonly kind: "result"; readonly value: ApiResult<T> };
type Settled<T> = UnknownOutcome | KnownOutcome<T>;

async function settle<T>(run: () => Promise<ApiResult<T>>): Promise<Settled<T>> {
  try {
    return { kind: "result", value: await run() };
  } catch (error) {
    return {
      kind: "unknown",
      message: error instanceof Error ? error.message : HEALTH_FETCH_FAILED_COPY,
    };
  }
}

function failureMessage(failure: ApiFailure): string {
  return `${HEALTH_FETCH_FAILED_COPY} ${failure.error.message}`;
}

export function createStoreHealthController(ports: StoreHealthPorts) {
  let session: StoreHealthSessionView = idleStoreHealthSession();
  let commandLock = false;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function setSession(next: StoreHealthSessionView): void {
    session = { ...next, overallSeverity: deriveOverallSeverity(next) };
    notify();
  }

  async function readLifecycle(): Promise<StoreHealthLifecycleSnapshot> {
    return ports.getLifecycleSnapshot();
  }

  async function loadRecovery(): Promise<RecoveryDiagnosticsView | undefined> {
    try {
      return await ports.getRecoveryDiagnostics();
    } catch {
      return session.recovery;
    }
  }

  async function readActivation(): Promise<UpdateActivationDecisionView | null> {
    try {
      return await ports.activationDecision();
    } catch {
      return session.activation;
    }
  }

  async function refreshUnlocked(): Promise<void> {
    const lifecycle = await readLifecycle();
    setSession({
      ...session,
      stage: session.stage === "ready" ? "ready" : "loading",
      connectivity: lifecycle.connectivity,
      leadership: lifecycle.leadership,
      updateReady: lifecycle.updateReady,
      releasePolicy: lifecycle.releasePolicy ? mapReleasePolicy(lifecycle.releasePolicy) : session.releasePolicy,
      unknownOperationPresent: Boolean(lifecycle.unknownOperationPresent),
      checkingUpdate: session.checkingUpdate,
      activating: false,
      message: lifecycle.connectivity === "checking" ? "Checking store health and connection." : "Checking store health.",
    });

    const [healthOutcome, recovery, activation] = await Promise.all([
      settle(() => ports.health.getStoreHealth()),
      loadRecovery(),
      readActivation(),
    ]);

    const unknownFromRecovery = (recovery?.attentionOperationCount ?? 0) > 0;
    const unknownOperationPresent = Boolean(lifecycle.unknownOperationPresent) || unknownFromRecovery;

    if (healthOutcome.kind === "unknown") {
      setSession({
        ...session,
        stage: "failed",
        connectivity: lifecycle.connectivity,
        leadership: lifecycle.leadership,
        updateReady: lifecycle.updateReady,
        activation,
        recovery,
        releasePolicy: lifecycle.releasePolicy ? mapReleasePolicy(lifecycle.releasePolicy) : session.releasePolicy,
        unknownOperationPresent,
        health: undefined,
        message: `${HEALTH_FETCH_FAILED_COPY} ${healthOutcome.message}`,
      });
      return;
    }
    if (!healthOutcome.value.ok) {
      setSession({
        ...session,
        stage: "failed",
        connectivity: lifecycle.connectivity,
        leadership: lifecycle.leadership,
        updateReady: lifecycle.updateReady,
        activation,
        recovery,
        releasePolicy: lifecycle.releasePolicy ? mapReleasePolicy(lifecycle.releasePolicy) : session.releasePolicy,
        unknownOperationPresent,
        health: undefined,
        message: failureMessage(healthOutcome.value),
      });
      return;
    }

    setSession({
      ...session,
      stage: "ready",
      connectivity: lifecycle.connectivity,
      leadership: lifecycle.leadership,
      updateReady: lifecycle.updateReady,
      activation,
      recovery,
      releasePolicy: lifecycle.releasePolicy ? mapReleasePolicy(lifecycle.releasePolicy) : session.releasePolicy,
      unknownOperationPresent,
      health: mapStoreHealth(healthOutcome.value.data),
      message: "Store health loaded from the server.",
    });
  }

  return {
    getSession(): StoreHealthSessionView {
      return session;
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isLocked(): boolean {
      return commandLock;
    },
    async refresh(): Promise<void> {
      if (commandLock) {
        return;
      }
      commandLock = true;
      try {
        await refreshUnlocked();
      } finally {
        commandLock = false;
        notify();
      }
    },
    async checkForUpdate(): Promise<void> {
      if (commandLock) {
        return;
      }
      if (session.leadership === "passive") {
        return;
      }
      commandLock = true;
      setSession({
        ...session,
        checkingUpdate: true,
        message: "Checking for an application update.",
      });
      try {
        await ports.checkForUpdate();
        await refreshUnlocked();
      } finally {
        commandLock = false;
        setSession({ ...session, checkingUpdate: false });
      }
    },
    async activateWaitingUpdate(): Promise<void> {
      if (commandLock) {
        return;
      }
      if (!session.updateReady || session.leadership === "passive") {
        return;
      }
      commandLock = true;
      setSession({
        ...session,
        activating: true,
        message: "Asking the lifecycle controller to activate the waiting update.",
      });
      try {
        const latest = await ports.activationDecision();
        setSession({
          ...session,
          activating: true,
          activation: latest,
        });
        if (!latest.safe) {
          setSession({
            ...session,
            activating: false,
            activation: latest,
            message: "Update is not safe. The lifecycle controller blocked activation.",
          });
          return;
        }
        const result = await ports.activateWaitingUpdate();
        setSession({
          ...session,
          activating: false,
          activation: result,
          updateReady: result.safe ? false : session.updateReady,
          message: result.safe
            ? "The lifecycle controller accepted activation of the waiting update."
            : "The lifecycle controller blocked activation after a fresh safety check.",
        });
      } finally {
        commandLock = false;
        notify();
      }
    },
  };
}

export type StoreHealthController = ReturnType<typeof createStoreHealthController>;

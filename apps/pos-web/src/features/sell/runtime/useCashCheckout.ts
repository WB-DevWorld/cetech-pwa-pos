import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { CustomerSummary, Quote } from "../../../../../../docs/contracts/domain.generated";
import { openPosLocalDatabase } from "../../../local";
import { checkoutCommandInFlight, idleCheckoutSession, type CheckoutSessionView } from "../state/checkoutSession";
import { createCheckoutAttemptStore, type CheckoutAttemptStore } from "./checkout-attempt-store";
import {
  createCashCheckoutController,
  isCashCheckoutReady,
  type CashCheckoutController,
  type CashCheckoutPorts,
} from "./cashCheckoutController";

export type { CashCheckoutPorts };

function checkoutScopeKey(ports: CashCheckoutPorts): string {
  return `${ports.scope.registerId}\u001f${ports.scope.shiftId}\u001f${ports.scope.deviceId}`;
}

type CheckoutRuntimeSnapshot = {
  readonly hydrated: boolean;
  readonly controller: CashCheckoutController | null;
  readonly session: CheckoutSessionView;
  readonly inFlight: boolean;
};

/**
 * Checkout owner outside React render. Port identity changes and scope changes
 * are applied from effects; React only subscribes to the published snapshot.
 */
function createCheckoutRuntime(attemptStore: CheckoutAttemptStore) {
  let hydrated = false;
  let ports: CashCheckoutPorts | undefined;
  let controller: CashCheckoutController | null = null;
  let scopeKey = "";
  let stopController: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const build = (): CheckoutRuntimeSnapshot => {
    const session = controller?.getSession() ?? idleCheckoutSession();
    return {
      hydrated,
      controller,
      session,
      inFlight: Boolean(controller?.isLocked()) || checkoutCommandInFlight(session.stage),
    };
  };

  let cached = build();

  const publish = () => {
    cached = build();
    for (const listener of listeners) {
      listener();
    }
  };

  const releaseController = () => {
    stopController?.();
    stopController = null;
    controller = null;
    scopeKey = "";
  };

  const reconcile = () => {
    if (!hydrated || !ports || !isCashCheckoutReady(ports)) {
      if (controller) {
        releaseController();
        publish();
      }
      return;
    }
    const nextScope = checkoutScopeKey(ports);
    if (controller && scopeKey === nextScope) {
      controller.replacePorts({ ...ports, attemptStore });
      return;
    }
    releaseController();
    const created = createCashCheckoutController({ ...ports, attemptStore });
    controller = created;
    scopeKey = nextScope;
    stopController = created.subscribe(() => {
      publish();
    });
    publish();
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot(): CheckoutRuntimeSnapshot {
      return cached;
    },
    markHydrated() {
      if (hydrated) {
        return;
      }
      hydrated = true;
      reconcile();
    },
    setPorts(next: CashCheckoutPorts | undefined) {
      ports = next;
      reconcile();
    },
  };
}

export function useCashCheckout(ports: CashCheckoutPorts | undefined): {
  readonly ready: boolean;
  readonly session: CheckoutSessionView;
  readonly inFlight: boolean;
  readonly startPrepare: (quote: Quote | undefined, customerSnapshot?: CustomerSummary) => Promise<void>;
  readonly confirmCash: (cashReceivedText: string) => Promise<void>;
  readonly resolveSale: () => Promise<void>;
  readonly resolvePayment: () => Promise<void>;
  readonly selectCash: () => void;
  readonly backToPaymentChoice: () => void;
  readonly cancelPreparedSale: (reason?: string) => Promise<void>;
  readonly retryFinalize: () => Promise<void>;
  readonly loadReceipt: () => Promise<void>;
  readonly printReceipt: () => Promise<void>;
  readonly dismiss: () => void;
  readonly resetForNewSale: () => void;
} {
  const attemptStore = useMemo(() => createCheckoutAttemptStore(openPosLocalDatabase()), []);
  const runtime = useMemo(() => createCheckoutRuntime(attemptStore), [attemptStore]);
  const snapshot = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);

  useEffect(() => {
    let cancelled = false;
    void attemptStore.hydrate().finally(() => {
      if (!cancelled) {
        runtime.markHydrated();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [attemptStore, runtime]);

  useEffect(() => {
    runtime.setPorts(ports);
  }, [ports, runtime]);

  const controller = snapshot.hydrated ? snapshot.controller : null;

  return {
    ready: snapshot.hydrated && isCashCheckoutReady(ports),
    session: snapshot.session,
    inFlight: snapshot.inFlight,
    startPrepare: (quote, customerSnapshot) => controller?.startPrepare(quote, customerSnapshot) ?? Promise.resolve(),
    confirmCash: (cashReceivedText) => controller?.confirmCash(cashReceivedText) ?? Promise.resolve(),
    resolveSale: () => controller?.resolveSale() ?? Promise.resolve(),
    resolvePayment: () => controller?.resolvePayment() ?? Promise.resolve(),
    selectCash: () => controller?.selectCash(),
    backToPaymentChoice: () => controller?.backToPaymentChoice(),
    cancelPreparedSale: (reason?: string) => controller?.cancelPreparedSale(reason) ?? Promise.resolve(),
    retryFinalize: () => controller?.retryFinalize() ?? Promise.resolve(),
    loadReceipt: () => controller?.loadReceipt() ?? Promise.resolve(),
    printReceipt: () => controller?.printReceipt() ?? Promise.resolve(),
    dismiss: () => controller?.dismiss(),
    resetForNewSale: () => controller?.resetForNewSale(),
  };
}

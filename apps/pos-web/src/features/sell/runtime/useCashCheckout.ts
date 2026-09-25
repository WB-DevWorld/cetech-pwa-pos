import { useEffect, useMemo, useState } from "react";
import type { CustomerSummary, Quote } from "../../../../../../docs/contracts/domain.generated";
import { openPosLocalDatabase } from "../../../local";
import { checkoutCommandInFlight, idleCheckoutSession, type CheckoutSessionView } from "../state/checkoutSession";
import { createCheckoutAttemptStore } from "./checkout-attempt-store";
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
  const ready = isCashCheckoutReady(ports);
  const attemptStore = useMemo(() => createCheckoutAttemptStore(openPosLocalDatabase()), []);
  const [hydrated, setHydrated] = useState(false);
  const [generation, setGeneration] = useState<{
    scopeKey: string;
    controller: CashCheckoutController;
  } | null>(null);
  const scopeKey = ports ? checkoutScopeKey(ports) : "";
  const portsReady = Boolean(hydrated && ports && isCashCheckoutReady(ports));
  let controller: CashCheckoutController | null =
    generation && portsReady && generation.scopeKey === scopeKey ? generation.controller : null;

  if (hydrated && ports && isCashCheckoutReady(ports) && (!generation || generation.scopeKey !== scopeKey)) {
    controller = createCashCheckoutController({ ...ports, attemptStore });
    setGeneration({ scopeKey, controller });
  } else if (generation && !portsReady) {
    controller = null;
    setGeneration(null);
  }

  useEffect(() => {
    let cancelled = false;
    void attemptStore.hydrate().finally(() => {
      if (!cancelled) {
        setHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [attemptStore]);

  useEffect(() => {
    if (!controller || !ports) {
      return;
    }
    controller.replacePorts({ ...ports, attemptStore });
  }, [attemptStore, controller, ports]);

  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!controller) {
      return;
    }
    return controller.subscribe(() => {
      setVersion((value) => value + 1);
    });
  }, [controller]);

  const session = controller?.getSession() ?? idleCheckoutSession();
  const inFlight = version >= 0 && (Boolean(controller?.isLocked()) || checkoutCommandInFlight(session.stage));

  return {
    ready,
    session,
    inFlight,
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

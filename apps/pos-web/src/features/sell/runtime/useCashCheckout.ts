import { useEffect, useMemo, useState } from "react";
import type { Quote } from "../../../../../../docs/contracts/domain.generated";
import { checkoutCommandInFlight, idleCheckoutSession, type CheckoutSessionView } from "../state/checkoutSession";
import {
  createCashCheckoutController,
  isCashCheckoutReady,
  type CashCheckoutController,
  type CashCheckoutPorts,
} from "./cashCheckoutController";

export type { CashCheckoutPorts };

export function useCashCheckout(ports: CashCheckoutPorts | undefined): {
  readonly ready: boolean;
  readonly session: CheckoutSessionView;
  readonly inFlight: boolean;
  readonly startPrepare: (quote: Quote | undefined) => Promise<void>;
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
  const controller = useMemo<CashCheckoutController | null>(
    () => (ready && ports ? createCashCheckoutController(ports) : null),
    [ports, ready],
  );
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
    startPrepare: (quote) => controller?.startPrepare(quote) ?? Promise.resolve(),
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

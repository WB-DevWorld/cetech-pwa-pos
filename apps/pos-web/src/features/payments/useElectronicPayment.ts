import { useEffect, useMemo, useState } from "react";
import {
  createElectronicPaymentController,
  type ElectronicPaymentController,
  type ElectronicPaymentPorts,
} from "./electronicPaymentController";
import { idleElectronicPaymentSession, type ElectronicPaymentSessionView } from "./electronicPaymentView";

export function useElectronicPayment(ports: ElectronicPaymentPorts | undefined): {
  readonly ready: boolean;
  readonly session: ElectronicPaymentSessionView;
  readonly inFlight: boolean;
  readonly present: ElectronicPaymentController["present"];
  readonly resolve: () => Promise<void>;
  readonly noteBrowserCallback: () => Promise<void>;
  readonly reset: () => void;
} {
  const ready = Boolean(ports?.payments.initialize && ports.payments.resolve);
  const controller = useMemo<ElectronicPaymentController | null>(
    () => (ready && ports ? createElectronicPaymentController(ports) : null),
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

  const session = controller?.getSession() ?? idleElectronicPaymentSession();
  const inFlight = version >= 0 && Boolean(controller?.isLocked());

  return {
    ready,
    session,
    inFlight,
    present: (input) => controller?.present(input) ?? Promise.resolve(),
    resolve: () => controller?.resolve() ?? Promise.resolve(),
    noteBrowserCallback: () => controller?.noteBrowserCallback() ?? Promise.resolve(),
    reset: () => controller?.reset(),
  };
}

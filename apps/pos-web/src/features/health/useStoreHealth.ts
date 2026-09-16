"use client";

import { useEffect, useMemo, useState } from "react";
import { createStoreHealthController, type StoreHealthController, type StoreHealthPorts } from "./storeHealthController";
import { idleStoreHealthSession, type StoreHealthSessionView } from "./storeHealthView";

export function useStoreHealth(ports: StoreHealthPorts | undefined): {
  readonly ready: boolean;
  readonly session: StoreHealthSessionView;
  readonly inFlight: boolean;
  readonly refresh: () => Promise<void>;
  readonly checkForUpdate: () => Promise<void>;
  readonly activateWaitingUpdate: () => Promise<void>;
} {
  const controller = useMemo<StoreHealthController | null>(
    () => (ports ? createStoreHealthController(ports) : null),
    [ports],
  );
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!controller) {
      return;
    }
    const unsubscribe = controller.subscribe(() => {
      setVersion((value) => value + 1);
    });
    void controller.refresh();
    return unsubscribe;
  }, [controller]);

  const session = controller?.getSession() ?? idleStoreHealthSession();
  const inFlight = version >= 0 && Boolean(controller?.isLocked());

  return {
    ready: Boolean(controller),
    session,
    inFlight,
    refresh: () => controller?.refresh() ?? Promise.resolve(),
    checkForUpdate: () => controller?.checkForUpdate() ?? Promise.resolve(),
    activateWaitingUpdate: () => controller?.activateWaitingUpdate() ?? Promise.resolve(),
  };
}

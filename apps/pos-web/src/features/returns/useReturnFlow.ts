import { useEffect, useMemo, useState } from "react";
import { createReturnController, type ReturnController, type ReturnControllerPorts } from "./returnController";
import { idleReturnSession, type ReturnSessionView } from "./returnView";

export function useReturnFlow(ports: ReturnControllerPorts | undefined): {
  readonly ready: boolean;
  readonly session: ReturnSessionView;
  readonly inFlight: boolean;
  readonly controller: ReturnController | null;
} {
  const ready = Boolean(ports?.returns);
  const controller = useMemo<ReturnController | null>(
    () => (ready && ports ? createReturnController(ports) : null),
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

  return {
    ready,
    session: controller?.getSession() ?? idleReturnSession(),
    inFlight: version >= 0 && Boolean(controller?.isLocked()),
    controller,
  };
}

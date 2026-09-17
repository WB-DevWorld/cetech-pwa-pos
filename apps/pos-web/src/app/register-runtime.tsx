"use client";

import { useEffect, useMemo, useState } from "react";
import {
  RegisterScreen,
  createRegisterController,
  type RegisterController,
  type RegisterWorkspacePorts,
} from "../features/register";
import { idleShiftWorkspace, type ShiftWorkspaceView } from "../features/register/shiftView";
import type { RegisterPort } from "../../../../docs/contracts/ports";
import { LOCAL_CHECKOUT_SCOPE, createBrowserRegisterPort } from "./checkout-client";

export function useRegisterFlow(ports: RegisterWorkspacePorts | undefined): {
  readonly ready: boolean;
  readonly session: ShiftWorkspaceView;
  readonly inFlight: boolean;
  readonly controller: RegisterController | null;
} {
  const ready = Boolean(ports?.register);
  const controller = useMemo<RegisterController | null>(
    () => (ready && ports ? createRegisterController(ports) : null),
    [ports, ready],
  );
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!controller) {
      return;
    }
    const unsubscribe = controller.subscribe(() => {
      setVersion((value) => value + 1);
    });
    void controller.load();
    return unsubscribe;
  }, [controller]);

  return {
    ready,
    session: controller?.getSession() ?? idleShiftWorkspace(),
    inFlight: version >= 0 && Boolean(controller?.isLocked()),
    controller,
  };
}

export function RegisterRuntimeScreen({
  register,
  registerId,
  deviceId,
  currency,
}: {
  readonly register: RegisterPort;
  readonly registerId: string;
  readonly deviceId: string;
  readonly currency: string;
}) {
  const ports = useMemo(
    () => ({ register, registerId, deviceId, currency }),
    [register, registerId, deviceId, currency],
  );
  const flow = useRegisterFlow(ports);
  if (!flow.ready || !flow.controller) {
    return <p className="muted">Loading register…</p>;
  }
  return (
    <>
      <RegisterScreen
        openForm={{
          registers: [{ id: registerId, name: "Front Counter 1", locationLabel: "Main store" }],
          selectedRegisterId: registerId,
          online: typeof navigator === "undefined" ? true : navigator.onLine,
          onSubmit: (input) => {
            void flow.controller?.open(input.openingFloatMinor);
          },
        }}
        session={flow.session}
        inFlight={flow.inFlight}
        onOpen={(openingFloatMinor) => {
          void flow.controller?.open(openingFloatMinor);
        }}
        onClose={(countedCashText) => {
          void flow.controller?.close(countedCashText);
        }}
        onShowXReport={() => {
          void flow.controller?.report("X");
        }}
      />
      {flow.session.status === "requires_attention" ? (
        <p className="muted" data-shift-variance-recorded="" role="status">
          Counted cash has been recorded. Variance requires attention. Manager/reconciliation
          action is still required. Do not open a replacement close to bypass this state.
        </p>
      ) : null}
    </>
  );
}

export function createProductionRegisterRuntime(options?: { readonly fetchImpl?: typeof fetch }): {
  readonly register: RegisterPort;
  readonly registerId: string;
  readonly deviceId: string;
  readonly currency: string;
} {
  return {
    register: createBrowserRegisterPort({ fetchImpl: options?.fetchImpl }),
    registerId: LOCAL_CHECKOUT_SCOPE.registerId,
    deviceId: LOCAL_CHECKOUT_SCOPE.deviceId,
    currency: "GHS",
  };
}

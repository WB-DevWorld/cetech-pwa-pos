"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  RegisterScreen,
  createRegisterController,
  type RegisterController,
  type RegisterWorkspacePorts,
} from "../features/register";
import { idleShiftWorkspace, shouldAnnounceRegisterOpened, type ShiftWorkspaceView } from "../features/register/shiftView";
import type { RegisterPort } from "../../../../docs/contracts/ports";
import type { Shift } from "../../../../docs/contracts/domain.generated";
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
  registerName = registerId,
  locationLabel = "Assigned location",
  deviceId,
  currency,
  onShiftChange,
  onOpened,
}: {
  readonly register: RegisterPort;
  readonly registerId: string;
  readonly registerName?: string;
  readonly locationLabel?: string;
  readonly deviceId: string;
  readonly currency: string;
  readonly onShiftChange?: (shift: Shift | null) => void;
  readonly onOpened?: () => void;
}) {
  const ports = useMemo(
    () => ({ register, registerId, deviceId, currency }),
    [register, registerId, deviceId, currency],
  );
  const flow = useRegisterFlow(ports);
  const previousStatus = useRef(flow.session.status);

  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = flow.session.status;
    if (onOpened && shouldAnnounceRegisterOpened(previous, flow.session.status)) {
      onOpened();
    }
  }, [flow.session.status, onOpened]);

  useEffect(() => {
    if (!onShiftChange) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await register.activeShift(registerId);
      if (cancelled) {
        return;
      }
      if (result.ok) {
        onShiftChange(result.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flow.session.shiftId, flow.session.status, onShiftChange, register, registerId]);

  if (!flow.ready || !flow.controller) {
    return <p className="muted">Loading register…</p>;
  }
  return (
    <>
      <RegisterScreen
        openForm={{
          registers: [{ id: registerId, name: registerName, locationLabel }],
          selectedRegisterId: registerId,
          online: typeof navigator === "undefined" ? true : navigator.onLine,
          errorMessage:
            flow.session.inputError ??
            (flow.session.message &&
            flow.session.message !== "Select a register and open a shift before taking payment." &&
            flow.session.message !== "Opening the register."
              ? flow.session.message
              : undefined),
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
      {flow.session.message &&
      flow.session.message !== "Select a register and open a shift before taking payment." &&
      flow.session.status === "no_open_shift" ? (
        <p className="banner danger" role="alert" data-register-command-error="">
          {flow.session.message}
        </p>
      ) : null}
      {flow.session.status === "requires_attention" ? (
        <p className="muted" data-shift-variance-recorded="" role="status">
          Counted cash has been recorded. Variance requires attention. Manager/reconciliation
          action is still required. Do not resubmit close with another approval ID or open a
          replacement close to bypass this state.
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

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  RegisterScreen,
  createRegisterController,
  type RegisterChoice,
  type RegisterController,
  type RegisterWorkspacePorts,
} from "../features/register";
import { idleShiftWorkspace, shouldAnnounceRegisterOpened, type ShiftWorkspaceView } from "../features/register/shiftView";
import type { RegisterPort } from "../../../../docs/contracts/ports";
import type { Shift } from "../../../../docs/contracts/domain.generated";
import { createBrowserRegisterPort } from "./checkout-client";

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
  registerChoices = [],
  registerName = registerId ?? "Register",
  locationLabel = "Assigned location",
  deviceId,
  currency,
  onSelectRegister,
  onShiftChange,
  onOpened,
}: {
  readonly register: RegisterPort;
  readonly registerId: string | null;
  readonly registerChoices?: readonly RegisterChoice[];
  readonly registerName?: string;
  readonly locationLabel?: string;
  readonly deviceId: string;
  readonly currency: string;
  readonly onSelectRegister?: (registerId: string) => void;
  readonly onShiftChange?: (shift: Shift | null) => void;
  readonly onOpened?: () => void;
}) {
  const choices =
    registerChoices.length > 0
      ? registerChoices
      : registerId
        ? [{ id: registerId, name: registerName, locationLabel }]
        : [];
  const ports = useMemo(
    () => (registerId ? { register, registerId, deviceId, currency } : undefined),
    [register, registerId, deviceId, currency],
  );
  const flow = useRegisterFlow(ports);
  const [closePresentation, setClosePresentation] = useState<{
    readonly registerId: string;
    readonly showClose: boolean;
    readonly notice: string;
  } | null>(null);
  const previousStatus = useRef(flow.session.status);
  const visibleClosePresentation = closePresentation?.registerId === registerId
    ? { showClose: closePresentation.showClose, notice: closePresentation.notice }
    : registerId
      ? { showClose: false, notice: "Checking whether you can close this shift." }
      : undefined;

  useEffect(() => {
    if (!registerId) return;
    const requestedId = registerId;
    let cancelled = false;
    void fetch(`/api/pos/v1/registers/${encodeURIComponent(requestedId)}/close-presentation`, {
      credentials: "include",
    })
      .then(async (response) => response.json() as Promise<{ ok?: boolean; data?: { showClose: boolean; notice: string } }>)
      .then((body) => {
        if (cancelled) return;
        const next = body.ok && body.data
          ? body.data
          : { showClose: false, notice: "Close availability could not be confirmed." };
        setClosePresentation({ registerId: requestedId, ...next });
      })
      .catch(() => {
        if (!cancelled) {
          setClosePresentation({
            registerId: requestedId,
            showClose: false,
            notice: "Close availability could not be confirmed.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [registerId]);

  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = flow.session.status;
    if (onOpened && shouldAnnounceRegisterOpened(previous, flow.session.status)) {
      onOpened();
    }
  }, [flow.session.status, onOpened]);

  useEffect(() => {
    if (!onShiftChange || !registerId) {
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

  const openForm = {
    registers: choices,
    selectedRegisterId: registerId ?? "",
    onRegisterChange: onSelectRegister,
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    errorMessage:
      flow.session.inputError ??
      (flow.session.message &&
      flow.session.message !== "Select a register and open a shift before taking payment." &&
      flow.session.message !== "Opening the register."
        ? flow.session.message
        : undefined),
    onSubmit: registerId
      ? (input: { openingFloatMinor: number }) => {
          void flow.controller?.open(input.openingFloatMinor);
        }
      : undefined,
  };

  if (!registerId) {
    return <RegisterScreen openForm={openForm} session={idleShiftWorkspace()} inFlight={false} />;
  }

  if (!flow.ready || !flow.controller) {
    return <p className="muted">Loading register…</p>;
  }
  return (
    <>
      <RegisterScreen
        openForm={openForm}
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
        closePresentation={visibleClosePresentation}
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
          Counted cash has been recorded. A manager still needs to review this shift.
          Do not submit the close again.
        </p>
      ) : null}
    </>
  );
}

export function createProductionRegisterRuntime(input: {
  readonly registerId: string;
  readonly deviceId: string;
  readonly fetchImpl?: typeof fetch;
  readonly currency?: string;
}): {
  readonly register: RegisterPort;
  readonly registerId: string;
  readonly deviceId: string;
  readonly currency: string;
} {
  return {
    register: createBrowserRegisterPort({ fetchImpl: input.fetchImpl }),
    registerId: input.registerId,
    deviceId: input.deviceId,
    currency: input.currency ?? "GHS",
  };
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  RegisterScreen,
  createRegisterController,
  type DeviceChoice,
  type RegisterChoice,
  type RegisterController,
  type RegisterWorkspacePorts,
} from "../features/register";
import { idleShiftWorkspace, shouldAnnounceRegisterOpened, type ShiftWorkspaceView } from "../features/register/shiftView";
import { readLocalDeviceId, rememberLocalDeviceId } from "../core/identity/local-device";
import type { RegisterPort } from "../../../../docs/contracts/ports";
import type { ApiErrorCode, Shift } from "../../../../docs/contracts/domain.generated";
import { createBrowserRegisterPort } from "./checkout-client";

type DeviceLoadState = "idle" | "loading" | "ready" | "error";

type RegisterDevicesResponse =
  | {
      readonly ok: true;
      readonly data: readonly DeviceChoice[];
      readonly correlationId: string;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: ApiErrorCode;
        readonly message: string;
      };
      readonly correlationId: string;
    };

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

  const [devices, setDevices] = useState<readonly DeviceChoice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [deviceState, setDeviceState] = useState<DeviceLoadState>("idle");
  const [deviceError, setDeviceError] = useState<string | undefined>();

  useEffect(() => {
    if (!registerId) {
      setDevices([]);
      setSelectedDeviceId("");
      setDeviceState("idle");
      setDeviceError(undefined);
      return;
    }

    const requestedRegisterId = registerId;
    let cancelled = false;
    setDeviceState("loading");
    setDeviceError(undefined);

    void fetchRegisterDevices(requestedRegisterId)
      .then((result) => {
        if (cancelled || requestedRegisterId !== registerId) return;
        if (!result.ok) {
          setDevices([]);
          setSelectedDeviceId("");
          setDeviceState("error");
          setDeviceError("Available POS devices could not be confirmed. Try again.");
          return;
        }

        const activeDevices = result.data;
        const preferred = readLocalDeviceId();
        const preferredIsAvailable = preferred
          ? activeDevices.some((device) => device.id === preferred)
          : false;
        const nextDeviceId = preferredIsAvailable
          ? preferred!
          : activeDevices.length === 1
            ? activeDevices[0]!.id
            : "";

        setDevices(activeDevices);
        setSelectedDeviceId(nextDeviceId);
        setDeviceState("ready");

        if (nextDeviceId) {
          rememberLocalDeviceId(nextDeviceId);
        }

        if (activeDevices.length === 0) {
          setDeviceError("No active POS device is assigned to this location. Ask a manager to configure one.");
        } else if (activeDevices.length > 1 && !nextDeviceId) {
          setDeviceError("Select the POS device you are using before opening the register.");
        } else {
          setDeviceError(undefined);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setDevices([]);
        setSelectedDeviceId("");
        setDeviceState("error");
        setDeviceError("Available POS devices could not be confirmed. Try again.");
      });

    return () => {
      cancelled = true;
    };
  }, [registerId]);

  const ports = useMemo(
    () =>
      registerId && selectedDeviceId
        ? { register, registerId, deviceId: selectedDeviceId, currency }
        : undefined,
    [register, registerId, selectedDeviceId, currency],
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
    devices,
    selectedDeviceId,
    onDeviceChange: (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      if (deviceId) {
        rememberLocalDeviceId(deviceId);
        setDeviceError(undefined);
      }
    },
    devicesLoading: deviceState === "loading",
    deviceErrorMessage: deviceError,
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    errorMessage:
      flow.session.inputError ??
      (flow.session.message &&
      flow.session.message !== "Select a register and open a shift before taking payment." &&
      flow.session.message !== "Opening the register."
        ? flow.session.message
        : undefined),
    onSubmit:
      registerId && selectedDeviceId
        ? (input: { openingFloatMinor: number }) => {
            void flow.controller?.open(input.openingFloatMinor);
          }
        : undefined,
  };

  if (!registerId || !selectedDeviceId || deviceState !== "ready") {
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

async function fetchRegisterDevices(registerId: string): Promise<RegisterDevicesResponse> {
  const response = await fetch(
    `/api/pos/v1/registers/${encodeURIComponent(registerId)}/devices`,
    {
      credentials: "include",
      headers: {
        accept: "application/json",
        "x-correlation-id": crypto.randomUUID(),
      },
    },
  );
  return await response.json() as RegisterDevicesResponse;
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

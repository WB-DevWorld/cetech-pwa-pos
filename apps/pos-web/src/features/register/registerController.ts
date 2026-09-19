import type {
  ApiFailure,
  CommandContext,
  Shift,
  ShiftReport,
} from "../../../../../docs/contracts/domain.generated";
import type { ApiResult, RegisterPort } from "../../../../../docs/contracts/ports";
import { cashierErrorMessage } from "../../ui/cashier-language";
import { parseDecimalToMinorUnits } from "./parseDecimalToMinorUnits";
import {
  idleShiftWorkspace,
  type ShiftStatusView,
  type ShiftWorkspaceView,
} from "./shiftView";

export type RegisterWorkspacePorts = {
  readonly register: RegisterPort;
  readonly registerId: string;
  readonly deviceId: string;
  readonly currency: string;
  readonly createUuid?: () => string;
};

type UnknownOutcome = { readonly kind: "unknown"; readonly message: string };
type KnownOutcome<T> = { readonly kind: "result"; readonly value: ApiResult<T> };
type Settled<T> = UnknownOutcome | KnownOutcome<T>;

function defaultUuid(): string {
  return crypto.randomUUID();
}

async function settle<T>(run: () => Promise<ApiResult<T>>): Promise<Settled<T>> {
  try {
    return { kind: "result", value: await run() };
  } catch (error) {
    return {
      kind: "unknown",
      message: cashierErrorMessage(
        { message: error instanceof Error ? error.message : undefined },
        "register",
      ),
    };
  }
}

function shouldResolveFailure(failure: ApiFailure): boolean {
  return failure.error.nextAction === "resolve";
}

function statusFromShift(shift: Shift | null): ShiftStatusView {
  if (!shift) {
    return "no_open_shift";
  }
  if (shift.status === "closed") return "closed";
  if (shift.status === "closing") return "closing";
  if (shift.status === "requires_attention") return "requires_attention";
  return "open";
}

function viewFromShift(shift: Shift | null, extras: Partial<ShiftWorkspaceView> = {}): ShiftWorkspaceView {
  if (!shift) {
    return { ...idleShiftWorkspace(), ...extras, status: extras.status ?? "no_open_shift", closeSucceeded: false };
  }
  const status = extras.status ?? statusFromShift(shift);
  return {
    status,
    shiftId: shift.id,
    registerId: shift.registerId,
    openingFloat: shift.openingFloat,
    countedCash: shift.countedCash,
    expectedCash: shift.expectedCash,
    variance: shift.variance,
    closedAt: shift.closedAt,
    report: extras.report,
    message: extras.message ?? (status === "requires_attention"
      ? "This shift needs manager review. It is not closed."
      : status === "closed"
        ? "Shift closed successfully."
        : "Shift is open."),
    inputError: extras.inputError,
    closeSucceeded: status === "closed",
  };
}

export function createRegisterController(ports: RegisterWorkspacePorts) {
  const createUuid = ports.createUuid ?? defaultUuid;
  let session: ShiftWorkspaceView = idleShiftWorkspace();
  let commandLock = false;
  let openContext: CommandContext | null = null;
  let closeContext: CommandContext | null = null;
  let closeBinding: { shiftId: string; countedMinor: number; approvalId?: string } | null = null;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function setSession(next: ShiftWorkspaceView): void {
    session = next;
    notify();
  }

  function commandContext(): CommandContext {
    return { idempotencyKey: createUuid(), correlationId: createUuid() };
  }

  function closeContextFor(shiftId: string, countedMinor: number, approvalId?: string): CommandContext {
    if (
      closeContext &&
      closeBinding &&
      closeBinding.shiftId === shiftId &&
      closeBinding.countedMinor === countedMinor &&
      closeBinding.approvalId === approvalId
    ) {
      return closeContext;
    }
    closeContext = commandContext();
    closeBinding = { shiftId, countedMinor, approvalId };
    return closeContext;
  }

  async function loadUnlocked(): Promise<void> {
    const active = await settle(() => ports.register.activeShift(ports.registerId));
    if (active.kind === "unknown") {
      setSession({
        ...session,
        message: active.message,
      });
      return;
    }
    if (!active.value.ok) {
      setSession({
        ...session,
        message: cashierErrorMessage(active.value.error, "register"),
      });
      return;
    }
    setSession(viewFromShift(active.value.data));
  }

  return {
    getSession(): ShiftWorkspaceView {
      return session;
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isLocked(): boolean {
      return commandLock;
    },
    async load(): Promise<void> {
      if (commandLock) {
        return;
      }
      commandLock = true;
      try {
        await loadUnlocked();
      } finally {
        commandLock = false;
        notify();
      }
    },
    async open(openingFloatMinor: number): Promise<void> {
      if (commandLock) {
        return;
      }
      if (!Number.isInteger(openingFloatMinor) || openingFloatMinor < 0) {
        setSession({ ...session, inputError: "Enter a valid opening amount.", status: "no_open_shift", closeSucceeded: false });
        return;
      }
      commandLock = true;
      const context = openContext ?? commandContext();
      openContext = context;
      setSession({
        ...session,
        status: "opening",
        inputError: undefined,
        closeSucceeded: false,
        message: "Starting your shift.",
      });
      try {
        const outcome = await settle(() =>
          ports.register.open(
            {
              registerId: ports.registerId,
              deviceId: ports.deviceId,
              openingFloat: { minor: openingFloatMinor, currency: ports.currency },
            },
            context,
          ),
        );
        if (outcome.kind === "unknown" || (outcome.kind === "result" && !outcome.value.ok && shouldResolveFailure(outcome.value))) {
          await loadUnlocked();
          return;
        }
        if (outcome.kind === "result" && outcome.value.ok) {
          openContext = null;
          setSession(viewFromShift(outcome.value.data, { message: "Shift is open." }));
          return;
        }
        if (outcome.kind === "result" && !outcome.value.ok) {
          setSession({
            ...idleShiftWorkspace(),
            message: cashierErrorMessage(outcome.value.error, "register"),
            closeSucceeded: false,
          });
        }
      } finally {
        commandLock = false;
        notify();
      }
    },
    async close(countedCashText: string, approvalId?: string): Promise<void> {
      if (commandLock) {
        return;
      }
      if (!session.shiftId || session.status === "closed") {
        return;
      }
      const parsed = parseDecimalToMinorUnits(countedCashText, { emptyMessage: "Enter the counted cash." });
      if (!parsed.ok) {
        setSession({ ...session, inputError: parsed.message });
        return;
      }
      commandLock = true;
      const context = closeContextFor(session.shiftId, parsed.minor, approvalId);
      setSession({
        ...session,
        status: "closing",
        inputError: undefined,
        expectedCash: undefined,
        variance: undefined,
        closeSucceeded: false,
        countedCash: { minor: parsed.minor, currency: ports.currency },
        message: "Submitting counted cash.",
      });
      try {
        const outcome = await settle(() =>
          ports.register.close(
            {
              shiftId: session.shiftId!,
              countedCash: { minor: parsed.minor, currency: ports.currency },
              approvalId,
            },
            context,
          ),
        );
        if (outcome.kind === "unknown" || (outcome.kind === "result" && !outcome.value.ok && shouldResolveFailure(outcome.value))) {
          await loadUnlocked();
          return;
        }
        if (outcome.kind === "result" && outcome.value.ok) {
          const shift = outcome.value.data;
          setSession(
            viewFromShift(shift, {
              message:
                shift.status === "closed"
                  ? "Shift closed successfully."
                  : shift.status === "requires_attention"
                    ? "This close needs manager review. It is not closed."
                    : "Shift close is not finished.",
            }),
          );
          return;
        }
        if (outcome.kind === "result" && !outcome.value.ok) {
          setSession({
            ...session,
            status: session.status === "closing" ? "open" : session.status,
            closeSucceeded: false,
            expectedCash: undefined,
            variance: undefined,
            message: cashierErrorMessage(outcome.value.error, "register"),
          });
        }
      } finally {
        commandLock = false;
        notify();
      }
    },
    async report(kind: "X" | "Z"): Promise<void> {
      if (commandLock || !session.shiftId) {
        return;
      }
      commandLock = true;
      try {
        const outcome = await settle(() => ports.register.report(session.shiftId!, kind));
        if (outcome.kind === "result" && outcome.value.ok) {
          const report: ShiftReport = outcome.value.data;
          setSession({
            ...session,
            countedCash: session.status === "closed" ? report.countedCash ?? session.countedCash : session.countedCash,
            variance: session.status === "closed" ? report.variance ?? session.variance : session.variance,
            expectedCash: session.status === "closed" ? report.expectedCash : session.expectedCash,
            report: {
              id: report.id,
              kind: report.kind,
              expectedCash: report.expectedCash,
              countedCash: report.countedCash,
              variance: report.variance,
              createdAt: report.createdAt,
            },
            message: kind === "Z" ? "Z report loaded from the register service." : "X report loaded from the register service.",
          });
          return;
        }
        if (outcome.kind === "unknown") {
          setSession({ ...session, message: outcome.message });
          return;
        }
        if (outcome.kind === "result" && !outcome.value.ok) {
          setSession({ ...session, message: cashierErrorMessage(outcome.value.error, "register") });
        }
      } finally {
        commandLock = false;
        notify();
      }
    },
  };
}

export type RegisterController = ReturnType<typeof createRegisterController>;

import type { ApiResult, RegisterPort } from "../../../../../docs/contracts/ports";
import type { Register, Session, Shift } from "../../../../../docs/contracts/domain.generated";
import type { StaffAuthProvider, StaffSignInRequest } from "./staff-auth-provider";
import { StaffAuthError } from "./staff-auth-provider";
import type { StaffSessionBffGateway } from "./bff-staff-session-gateway";
import type { StaffSessionContext } from "./staff-session-context";
import type { OfflineStaffPresentationStore } from "./offline-staff-presentation";
import {
  createLocalSelectedRegisterStore,
  resolveSelectedRegisterId,
  type SelectedRegisterStore,
} from "./selected-register-preference";

export type StaffRuntimeStatus =
  | "restoring"
  | "signed_out"
  | "expired"
  | "unauthorized"
  | "unavailable"
  | "ready";

export type StaffRuntimeAuthority = {
  readonly status: StaffRuntimeStatus;
  readonly session: Session | null;
  readonly assignedLocationIds: readonly string[];
  readonly assignedRegisterIds: readonly string[];
  readonly assignedRegisters: readonly Register[];
  readonly selectedRegisterId: string | null;
  readonly register: Register | null;
  readonly shift: Shift | null;
  readonly shiftOpen: boolean;
  readonly errorMessage?: string;
  readonly presentationOnly?: boolean;
};

export type StaffRuntimeController = {
  getState(): StaffRuntimeAuthority;
  subscribe(listener: () => void): () => void;
  restore(): Promise<void>;
  signIn(request?: StaffSignInRequest): Promise<void>;
  signOut(): Promise<void>;
  refreshRegister(): Promise<void>;
  selectRegister(registerId: string): Promise<boolean>;
  applyShift(shift: Shift | null): void;
};

const idle: StaffRuntimeAuthority = {
  status: "restoring",
  session: null,
  assignedLocationIds: [],
  assignedRegisterIds: [],
  assignedRegisters: [],
  selectedRegisterId: null,
  register: null,
  shift: null,
  shiftOpen: false,
};

function shiftIsOpen(shift: Shift | null): boolean {
  return shift?.status === "open";
}

function noticeFromFailure(result: ApiResult<unknown>): StaffRuntimeStatus {
  if (!result.ok && result.error.code === "AUTH_REQUIRED") {
    const message = result.error.message.toLowerCase();
    if (message.includes("expired") || message.includes("revoked")) {
      return "expired";
    }
    return "signed_out";
  }
  if (!result.ok && result.error.code === "FORBIDDEN") {
    return "unauthorized";
  }
  return "unavailable";
}

function isAuthClosed(status: StaffRuntimeStatus): boolean {
  return status === "signed_out" || status === "expired" || status === "unauthorized";
}

function authClosedAuthority(
  status: StaffRuntimeStatus,
  errorMessage: string | undefined,
): StaffRuntimeAuthority {
  return {
    ...idle,
    status,
    errorMessage,
  };
}

function isRetryableRegisterFailure(result: ApiResult<unknown>): boolean {
  if (result.ok) {
    return false;
  }
  if (result.error.code === "AUTH_REQUIRED" || result.error.code === "FORBIDDEN") {
    return false;
  }
  if (result.error.code === "NOT_FOUND") {
    return false;
  }
  return result.error.code === "INTEGRATION_UNAVAILABLE" || result.error.retryable === true;
}

function canPreserveRegister(
  previous: StaffRuntimeAuthority,
  context: StaffSessionContext,
  selectedRegisterId: string,
): boolean {
  return (
    previous.status === "ready" &&
    previous.session?.actorId === context.session.actorId &&
    previous.session?.organizationId === context.session.organizationId &&
    previous.register?.id === selectedRegisterId &&
    previous.selectedRegisterId === selectedRegisterId &&
    context.assignedRegisterIds.includes(selectedRegisterId)
  );
}

function readyWithoutRegister(
  context: StaffSessionContext,
  assignedRegisters: readonly Register[],
  selectedRegisterId: string | null,
  errorMessage?: string,
): StaffRuntimeAuthority {
  return {
    status: "ready",
    session: context.session,
    assignedLocationIds: context.assignedLocationIds,
    assignedRegisterIds: context.assignedRegisterIds,
    assignedRegisters,
    selectedRegisterId,
    register: null,
    shift: null,
    shiftOpen: false,
    errorMessage,
  };
}

export function createStaffRuntimeController(input: {
  readonly gateway: StaffSessionBffGateway;
  readonly auth: StaffAuthProvider;
  readonly registers: RegisterPort;
  readonly selectedRegisterStore?: SelectedRegisterStore;
  readonly offlinePresentationStore?: OfflineStaffPresentationStore;
  readonly isOnline?: () => boolean;
  readonly now?: () => Date;
}): StaffRuntimeController {
  let state: StaffRuntimeAuthority = idle;
  const listeners = new Set<() => void>();
  const selectedRegisterStore = input.selectedRegisterStore ?? createLocalSelectedRegisterStore();
  const offlinePresentationStore = input.offlinePresentationStore;
  const isOnline = input.isOnline ?? (() => true);
  const now = input.now ?? (() => new Date());

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function setState(next: StaffRuntimeAuthority): void {
    state = next;
    notify();
  }

  async function loadAssignedRegisters(ids: readonly string[]): Promise<Register[]> {
    const loaded = await Promise.all(ids.map((id) => input.registers.get(id)));
    const registers: Register[] = [];
    loaded.forEach((result, index) => {
      if (result.ok && result.data.id === ids[index]) {
        registers.push(result.data);
      }
    });
    return registers;
  }

  async function hydrateSelectedRegister(
    context: StaffSessionContext,
    previous: StaffRuntimeAuthority,
    selectedRegisterId: string,
    assignedRegisters: readonly Register[],
    mode: "restore" | "explicit_switch" = "restore",
  ): Promise<StaffRuntimeAuthority> {
    const registerResult = await input.registers.get(selectedRegisterId);
    if (!registerResult.ok) {
      if (registerResult.error.code === "FORBIDDEN") {
        const message = "This register is not permitted for the current staff session. Choose another assigned register.";
        if (mode === "explicit_switch" && previous.status === "ready" && previous.session) {
          return { ...previous, errorMessage: message };
        }
        selectedRegisterStore.clear(context.session.organizationId, context.session.actorId);
        return readyWithoutRegister(context, assignedRegisters, null, message);
      }
      const notice = noticeFromFailure(registerResult);
      if (isAuthClosed(notice)) {
        return authClosedAuthority(notice, registerResult.error.message);
      }
      if (registerResult.error.code === "NOT_FOUND") {
        selectedRegisterStore.clear(context.session.organizationId, context.session.actorId);
        return readyWithoutRegister(context, assignedRegisters, null, registerResult.error.message);
      }
      if (isRetryableRegisterFailure(registerResult) && canPreserveRegister(previous, context, selectedRegisterId)) {
        return {
          status: "ready",
          session: context.session,
          assignedLocationIds: context.assignedLocationIds,
          assignedRegisterIds: context.assignedRegisterIds,
          assignedRegisters,
          selectedRegisterId,
          register: previous.register,
          shift: previous.shift,
          shiftOpen: previous.shiftOpen,
          errorMessage: registerResult.error.message,
        };
      }
      return readyWithoutRegister(context, assignedRegisters, selectedRegisterId, registerResult.error.message);
    }
    const shiftResult = await input.registers.activeShift(selectedRegisterId);
    if (!shiftResult.ok) {
      if (shiftResult.error.code === "FORBIDDEN") {
        const message = "This register is not permitted for the current staff session. Choose another assigned register.";
        if (mode === "explicit_switch" && previous.status === "ready" && previous.session) {
          return { ...previous, errorMessage: message };
        }
        selectedRegisterStore.clear(context.session.organizationId, context.session.actorId);
        return readyWithoutRegister(context, assignedRegisters, null, message);
      }
      const notice = noticeFromFailure(shiftResult);
      if (isAuthClosed(notice)) {
        return authClosedAuthority(notice, shiftResult.error.message);
      }
      const sameRegister = previous.register?.id === registerResult.data.id;
      const preserveShift =
        isRetryableRegisterFailure(shiftResult) &&
        sameRegister &&
        previous.shift !== null &&
        previous.shift.registerId === selectedRegisterId &&
        previous.session?.actorId === context.session.actorId;
      return {
        status: "ready",
        session: context.session,
        assignedLocationIds: context.assignedLocationIds,
        assignedRegisterIds: context.assignedRegisterIds,
        assignedRegisters,
        selectedRegisterId,
        register: registerResult.data,
        shift: preserveShift ? previous.shift : null,
        shiftOpen: preserveShift ? previous.shiftOpen : false,
        errorMessage: shiftResult.error.message,
      };
    }
    const shift =
      shiftResult.data && shiftResult.data.registerId !== selectedRegisterId ? null : shiftResult.data;
    return {
      status: "ready",
      session: context.session,
      assignedLocationIds: context.assignedLocationIds,
      assignedRegisterIds: context.assignedRegisterIds,
      assignedRegisters,
      selectedRegisterId,
      register: registerResult.data,
      shift,
      shiftOpen: shiftIsOpen(shift),
    };
  }

  async function loadRegister(
    context: StaffSessionContext,
    previous: StaffRuntimeAuthority,
  ): Promise<StaffRuntimeAuthority> {
    const assignedRegisters = await loadAssignedRegisters(context.assignedRegisterIds);
    const selectedRegisterId = resolveSelectedRegisterId({
      assignedRegisterIds: context.assignedRegisterIds,
      organizationId: context.session.organizationId,
      actorId: context.session.actorId,
      store: selectedRegisterStore,
    });
    if (!selectedRegisterId) {
      return readyWithoutRegister(context, assignedRegisters, null);
    }
    return hydrateSelectedRegister(context, previous, selectedRegisterId, assignedRegisters);
  }

  async function applyContext(result: ApiResult<StaffSessionContext>): Promise<void> {
    if (!result.ok) {
      if (result.error.code === "INTEGRATION_UNAVAILABLE") {
        const cached = offlinePresentationStore?.read(now()) ?? null;
        if (cached) {
          setState(
            isOnline()
              ? {
                  ...cached,
                  errorMessage:
                    "Connection unavailable. Showing the last verified cashier and register. Selling and register changes stay blocked until service recovers.",
                }
              : cached,
          );
          return;
        }
      }
      setState({
        ...idle,
        status: noticeFromFailure(result),
        errorMessage: result.error.message,
      });
      return;
    }
    const next = await loadRegister(result.data, state);
    setState(next);
    if (next.status === "ready" && next.session && !next.presentationOnly) {
      offlinePresentationStore?.write(next, now());
    }
  }

  return {
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async restore() {
      setState({ ...idle, status: "restoring" });
      await applyContext(await input.gateway.readContext());
    },
    async signIn(request) {
      setState({ ...state, status: "restoring", errorMessage: undefined });
      try {
        const signedIn = await input.auth.signIn(request);
        const established = await input.gateway.establish(signedIn.accessToken);
        await applyContext(established);
      } catch (error) {
        setState({
          ...idle,
          status: "signed_out",
          errorMessage: error instanceof StaffAuthError || error instanceof Error
            ? error.message
            : "staff identity could not be verified",
        });
      }
    },
    async signOut() {
      await input.gateway.clear();
      await input.auth.signOut();
      offlinePresentationStore?.clear();
      setState({
        ...idle,
        status: "signed_out",
      });
    },
    async refreshRegister() {
      if (!state.session || state.presentationOnly) {
        await applyContext(await input.gateway.readContext());
        return;
      }
      const current = state.session;
      setState(
        await loadRegister(
          {
            session: current,
            assignedLocationIds: state.assignedLocationIds,
            assignedRegisterIds: state.assignedRegisterIds,
          },
          state,
        ),
      );
    },
    async selectRegister(registerId) {
      if (!state.session || state.presentationOnly) {
        return false;
      }
      if (!state.assignedRegisterIds.includes(registerId)) {
        return false;
      }
      const context: StaffSessionContext = {
        session: state.session,
        assignedLocationIds: state.assignedLocationIds,
        assignedRegisterIds: state.assignedRegisterIds,
      };
      const next = await hydrateSelectedRegister(
        context,
        state,
        registerId,
        state.assignedRegisters,
        "explicit_switch",
      );
      if (next.register?.id === registerId && next.selectedRegisterId === registerId) {
        selectedRegisterStore.write(state.session.organizationId, state.session.actorId, registerId);
      }
      setState(next);
      return next.selectedRegisterId === registerId && next.register?.id === registerId;
    },
    applyShift(shift) {
      if (!state.session || !state.register || state.presentationOnly) {
        return;
      }
      if (shift && shift.registerId !== state.register.id) {
        return;
      }
      const shiftOpen = shiftIsOpen(shift);
      if (state.shift?.id === shift?.id && state.shift?.status === shift?.status && state.shiftOpen === shiftOpen) {
        return;
      }
      setState({
        ...state,
        shift,
        shiftOpen,
        errorMessage: undefined,
      });
    },
  };
}

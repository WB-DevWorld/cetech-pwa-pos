import type { ApiResult, RegisterPort } from "../../../../../docs/contracts/ports";
import type { Register, Session, Shift } from "../../../../../docs/contracts/domain.generated";
import type { StaffAuthProvider, StaffSignInRequest } from "./staff-auth-provider";
import { StaffAuthError } from "./staff-auth-provider";
import type { StaffSessionBffGateway } from "./bff-staff-session-gateway";
import type { StaffSessionContext } from "./staff-session-context";

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
  readonly register: Register | null;
  readonly shift: Shift | null;
  readonly shiftOpen: boolean;
  readonly errorMessage?: string;
};

export type StaffRuntimeController = {
  getState(): StaffRuntimeAuthority;
  subscribe(listener: () => void): () => void;
  restore(): Promise<void>;
  signIn(request?: StaffSignInRequest): Promise<void>;
  signOut(): Promise<void>;
  refreshRegister(): Promise<void>;
  applyShift(shift: Shift | null): void;
};

const idle: StaffRuntimeAuthority = {
  status: "restoring",
  session: null,
  assignedLocationIds: [],
  assignedRegisterIds: [],
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
  registerId: string,
): boolean {
  return (
    previous.status === "ready" &&
    previous.session?.actorId === context.session.actorId &&
    previous.session?.organizationId === context.session.organizationId &&
    previous.register?.id === registerId &&
    previous.assignedRegisterIds[0] === registerId &&
    context.assignedRegisterIds[0] === registerId
  );
}

export function createStaffRuntimeController(input: {
  readonly gateway: StaffSessionBffGateway;
  readonly auth: StaffAuthProvider;
  readonly registers: RegisterPort;
}): StaffRuntimeController {
  let state: StaffRuntimeAuthority = idle;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function setState(next: StaffRuntimeAuthority): void {
    state = next;
    notify();
  }

  async function loadRegister(
    context: StaffSessionContext,
    previous: StaffRuntimeAuthority,
  ): Promise<StaffRuntimeAuthority> {
    const registerId = context.assignedRegisterIds[0];
    if (!registerId) {
      return {
        status: "ready",
        session: context.session,
        assignedLocationIds: context.assignedLocationIds,
        assignedRegisterIds: context.assignedRegisterIds,
        register: null,
        shift: null,
        shiftOpen: false,
      };
    }
    const registerResult = await input.registers.get(registerId);
    if (!registerResult.ok) {
      const notice = noticeFromFailure(registerResult);
      if (isAuthClosed(notice)) {
        return authClosedAuthority(notice, registerResult.error.message);
      }
      if (registerResult.error.code === "NOT_FOUND") {
        return {
          status: "ready",
          session: context.session,
          assignedLocationIds: context.assignedLocationIds,
          assignedRegisterIds: context.assignedRegisterIds,
          register: null,
          shift: null,
          shiftOpen: false,
          errorMessage: registerResult.error.message,
        };
      }
      if (isRetryableRegisterFailure(registerResult) && canPreserveRegister(previous, context, registerId)) {
        return {
          status: "ready",
          session: context.session,
          assignedLocationIds: context.assignedLocationIds,
          assignedRegisterIds: context.assignedRegisterIds,
          register: previous.register,
          shift: previous.shift,
          shiftOpen: previous.shiftOpen,
          errorMessage: registerResult.error.message,
        };
      }
      return {
        status: "ready",
        session: context.session,
        assignedLocationIds: context.assignedLocationIds,
        assignedRegisterIds: context.assignedRegisterIds,
        register: null,
        shift: null,
        shiftOpen: false,
        errorMessage: registerResult.error.message,
      };
    }
    const shiftResult = await input.registers.activeShift(registerId);
    if (!shiftResult.ok) {
      const notice = noticeFromFailure(shiftResult);
      if (isAuthClosed(notice)) {
        return authClosedAuthority(notice, shiftResult.error.message);
      }
      const preserveShift =
        isRetryableRegisterFailure(shiftResult) &&
        previous.register?.id === registerResult.data.id &&
        previous.shift !== null &&
        previous.session?.actorId === context.session.actorId;
      return {
        status: "ready",
        session: context.session,
        assignedLocationIds: context.assignedLocationIds,
        assignedRegisterIds: context.assignedRegisterIds,
        register: registerResult.data,
        shift: preserveShift ? previous.shift : null,
        shiftOpen: preserveShift ? previous.shiftOpen : false,
        errorMessage: shiftResult.error.message,
      };
    }
    return {
      status: "ready",
      session: context.session,
      assignedLocationIds: context.assignedLocationIds,
      assignedRegisterIds: context.assignedRegisterIds,
      register: registerResult.data,
      shift: shiftResult.data,
      shiftOpen: shiftIsOpen(shiftResult.data),
    };
  }

  async function applyContext(result: ApiResult<StaffSessionContext>): Promise<void> {
    if (!result.ok) {
      setState({
        ...idle,
        status: noticeFromFailure(result),
        errorMessage: result.error.message,
      });
      return;
    }
    setState(await loadRegister(result.data, state));
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
      setState({
        ...idle,
        status: "signed_out",
      });
    },
    async refreshRegister() {
      if (!state.session) {
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
    applyShift(shift) {
      if (!state.session) {
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

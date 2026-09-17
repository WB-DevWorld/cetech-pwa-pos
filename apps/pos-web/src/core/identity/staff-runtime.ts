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

  async function loadRegister(context: StaffSessionContext): Promise<StaffRuntimeAuthority> {
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
      return {
        status: noticeFromFailure(registerResult) === "signed_out" || noticeFromFailure(registerResult) === "expired"
          ? noticeFromFailure(registerResult)
          : "ready",
        session: context.session,
        assignedLocationIds: context.assignedLocationIds,
        assignedRegisterIds: context.assignedRegisterIds,
        register: null,
        shift: null,
        shiftOpen: false,
        errorMessage: registerResult.ok ? undefined : registerResult.error.message,
      };
    }
    const shiftResult = await input.registers.activeShift(registerId);
    const shift = shiftResult.ok ? shiftResult.data : null;
    return {
      status: "ready",
      session: context.session,
      assignedLocationIds: context.assignedLocationIds,
      assignedRegisterIds: context.assignedRegisterIds,
      register: registerResult.data,
      shift,
      shiftOpen: shiftIsOpen(shift),
      errorMessage: shiftResult.ok ? undefined : shiftResult.error.message,
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
    setState(await loadRegister(result.data));
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
        await loadRegister({
          session: current,
          assignedLocationIds: state.assignedLocationIds,
          assignedRegisterIds: state.assignedRegisterIds,
        }),
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
      });
    },
  };
}

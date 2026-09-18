import { describe, expect, test } from "vitest";
import type { ApiResult, RegisterPort } from "../../../../../docs/contracts/ports";
import type { Register, Session, Shift } from "../../../../../docs/contracts/domain.generated";
import { createBffStaffSessionGateway } from "./bff-staff-session-gateway";
import { createStaffRuntimeController } from "./staff-runtime";

const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION: Session = {
  actorId: "cashier_a",
  displayName: "Cashier A",
  organizationId: "org_a",
  locationIds: ["loc_a1"],
  capabilities: ["ui.hint.only"],
  expiresAt: "2099-01-01T00:00:00.000Z",
};
const REGISTER: Register = {
  id: "reg_a",
  name: "Front Counter",
  locationId: "loc_a1",
  currency: "GHS",
  status: "active",
};
const OPEN_SHIFT: Shift = {
  id: "60a60173-ce30-4ab7-9461-697ee625ceb3",
  registerId: "reg_a",
  deviceId: "00000000-0000-4000-8000-0000000000a1",
  cashierId: "cashier_a",
  status: "open",
  openingFloat: { minor: 50000, currency: "GHS" },
  openedAt: "2026-09-18T08:00:00.000Z",
};

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data, correlationId: CORRELATION };
}

function fail(code: "INTEGRATION_UNAVAILABLE" | "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND", message: string): ApiResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      retryable: code === "INTEGRATION_UNAVAILABLE",
      nextAction: code === "AUTH_REQUIRED" ? "reauthenticate" : "resolve",
    },
    correlationId: CORRELATION,
  };
}

function sessionFetch(): typeof fetch {
  return (async () =>
    new Response(
      JSON.stringify({
        ok: true,
        correlationId: CORRELATION,
        data: {
          session: SESSION,
          assignedLocationIds: ["loc_a1"],
          assignedRegisterIds: ["reg_a"],
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;
}

function authStub() {
  return {
    async signIn() {
      return { accessToken: "staff-access-token" };
    },
    async signOut() {
      return;
    },
  };
}

function controller(registers: RegisterPort) {
  return createStaffRuntimeController({
    gateway: createBffStaffSessionGateway({ fetchImpl: sessionFetch(), correlationId: () => CORRELATION }),
    auth: authStub(),
    registers,
  });
}

describe("STG-06 staff runtime register authority", () => {
  test("successful register and open shift become ready authority", async () => {
    const runtime = controller(stubRegisters({ get: ok(REGISTER), shift: ok(OPEN_SHIFT) }));
    await runtime.restore();
    expect(runtime.getState()).toMatchObject({
      status: "ready",
      register: { id: "reg_a" },
      shiftOpen: true,
      shift: { id: OPEN_SHIFT.id },
    });
  });

  test("transient register GET failure preserves previously verified authority", async () => {
    const registers = stubRegisters({ get: ok(REGISTER), shift: ok(OPEN_SHIFT) });
    const runtime = controller(registers);
    await runtime.restore();
    registers.getImpl = async () => fail("INTEGRATION_UNAVAILABLE", "register lookup timed out");
    await runtime.refreshRegister();
    const state = runtime.getState();
    expect(state.status).toBe("ready");
    expect(state.register?.id).toBe("reg_a");
    expect(state.shift?.id).toBe(OPEN_SHIFT.id);
    expect(state.shiftOpen).toBe(true);
    expect(state.errorMessage).toContain("timed out");
  });

  test("transient activeShift failure preserves previous shift", async () => {
    const registers = stubRegisters({ get: ok(REGISTER), shift: ok(OPEN_SHIFT) });
    const runtime = controller(registers);
    await runtime.restore();
    registers.shiftImpl = async () => fail("INTEGRATION_UNAVAILABLE", "active shift lookup timed out");
    await runtime.refreshRegister();
    const state = runtime.getState();
    expect(state.register?.id).toBe("reg_a");
    expect(state.shift?.id).toBe(OPEN_SHIFT.id);
    expect(state.shiftOpen).toBe(true);
    expect(state.errorMessage).toContain("timed out");
  });

  test("authoritative null active shift clears shift", async () => {
    const registers = stubRegisters({ get: ok(REGISTER), shift: ok(OPEN_SHIFT) });
    const runtime = controller(registers);
    await runtime.restore();
    registers.shiftImpl = async () => ok(null);
    await runtime.refreshRegister();
    expect(runtime.getState().shift).toBeNull();
    expect(runtime.getState().shiftOpen).toBe(false);
    expect(runtime.getState().register?.id).toBe("reg_a");
  });

  test("expired session on register GET fails closed and clears authority", async () => {
    const registers = stubRegisters({ get: ok(REGISTER), shift: ok(OPEN_SHIFT) });
    const runtime = controller(registers);
    await runtime.restore();
    registers.getImpl = async () => fail("AUTH_REQUIRED", "staff session is expired or revoked");
    await runtime.refreshRegister();
    expect(runtime.getState()).toMatchObject({
      status: "expired",
      session: null,
      register: null,
      shift: null,
      shiftOpen: false,
    });
  });

  test("forbidden register GET fails closed", async () => {
    const registers = stubRegisters({ get: ok(REGISTER), shift: ok(OPEN_SHIFT) });
    const runtime = controller(registers);
    await runtime.restore();
    registers.getImpl = async () => fail("FORBIDDEN", "register is out of staff scope");
    await runtime.refreshRegister();
    expect(runtime.getState().status).toBe("unauthorized");
    expect(runtime.getState().register).toBeNull();
    expect(runtime.getState().shiftOpen).toBe(false);
  });

  test("explicit sign-out clears state", async () => {
    const runtime = controller(stubRegisters({ get: ok(REGISTER), shift: ok(OPEN_SHIFT) }));
    await runtime.restore();
    await runtime.signOut();
    expect(runtime.getState()).toMatchObject({
      status: "signed_out",
      session: null,
      register: null,
      shift: null,
      shiftOpen: false,
    });
  });
});

function stubRegisters(initial: {
  readonly get: ApiResult<Register>;
  readonly shift: ApiResult<Shift | null>;
}): RegisterPort & {
  getImpl: () => Promise<ApiResult<Register>>;
  shiftImpl: () => Promise<ApiResult<Shift | null>>;
} {
  const port = {
    getImpl: async () => initial.get,
    shiftImpl: async () => initial.shift,
    async get() {
      return port.getImpl();
    },
    async activeShift() {
      return port.shiftImpl();
    },
    open: async () => ok(OPEN_SHIFT),
    cashMovement: async () => fail("INTEGRATION_UNAVAILABLE", "unused"),
    close: async () => ok(OPEN_SHIFT),
    report: async () => fail("INTEGRATION_UNAVAILABLE", "unused"),
  };
  return port;
}

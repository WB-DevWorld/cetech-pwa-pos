import { describe, expect, test } from "vitest";
import type { ApiResult, RegisterPort } from "../../../../../docs/contracts/ports";
import type { Register, Session, Shift } from "../../../../../docs/contracts/domain.generated";
import { createBffStaffSessionGateway } from "./bff-staff-session-gateway";
import { checkoutScopeFromStaffAuthority } from "./checkout-scope";
import { createMemorySelectedRegisterStore, selectedRegisterStorageKey } from "./selected-register-preference";
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
const REGISTER_A: Register = {
  id: "reg_a",
  name: "Front Counter",
  locationId: "loc_a1",
  currency: "GHS",
  status: "active",
};
const REGISTER_B: Register = {
  id: "reg_b",
  name: "Back Counter",
  locationId: "loc_a1",
  currency: "GHS",
  status: "active",
};
const SHIFT_A: Shift = {
  id: "60a60173-ce30-4ab7-9461-697ee625ceb3",
  registerId: "reg_a",
  deviceId: "00000000-0000-4000-8000-0000000000a1",
  cashierId: "cashier_a",
  status: "open",
  openingFloat: { minor: 50000, currency: "GHS" },
  openedAt: "2026-09-18T08:00:00.000Z",
};
const SHIFT_B: Shift = {
  id: "70b70173-ce30-4ab7-9461-697ee625ceb4",
  registerId: "reg_b",
  deviceId: "00000000-0000-4000-8000-0000000000b1",
  cashierId: "cashier_a",
  status: "open",
  openingFloat: { minor: 25000, currency: "GHS" },
  openedAt: "2026-09-18T09:00:00.000Z",
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

function sessionFetch(assignedRegisterIds: () => readonly string[]): typeof fetch {
  return (async () =>
    new Response(
      JSON.stringify({
        ok: true,
        correlationId: CORRELATION,
        data: {
          session: SESSION,
          assignedLocationIds: ["loc_a1"],
          assignedRegisterIds: assignedRegisterIds(),
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

function controller(
  registers: RegisterPort,
  assigned: readonly string[] | (() => readonly string[]) = ["reg_a"],
  store = createMemorySelectedRegisterStore(),
) {
  const assignedFn = typeof assigned === "function" ? assigned : () => assigned;
  return {
    store,
    runtime: createStaffRuntimeController({
      gateway: createBffStaffSessionGateway({ fetchImpl: sessionFetch(assignedFn), correlationId: () => CORRELATION }),
      auth: authStub(),
      registers,
      selectedRegisterStore: store,
    }),
  };
}

describe("STG-06 staff runtime register authority", () => {
  test("successful register and open shift become ready authority", async () => {
    const { runtime } = controller(stubRegisters());
    await runtime.restore();
    expect(runtime.getState()).toMatchObject({
      status: "ready",
      register: { id: "reg_a" },
      selectedRegisterId: "reg_a",
      shiftOpen: true,
      shift: { id: SHIFT_A.id },
    });
  });

  test("transient register GET failure preserves previously verified authority", async () => {
    const registers = stubRegisters();
    const { runtime } = controller(registers);
    await runtime.restore();
    registers.getImpl = async () => fail("INTEGRATION_UNAVAILABLE", "register lookup timed out");
    await runtime.refreshRegister();
    const state = runtime.getState();
    expect(state.status).toBe("ready");
    expect(state.register?.id).toBe("reg_a");
    expect(state.shift?.id).toBe(SHIFT_A.id);
    expect(state.shiftOpen).toBe(true);
    expect(state.errorMessage).toContain("timed out");
  });

  test("transient activeShift failure preserves previous shift", async () => {
    const registers = stubRegisters();
    const { runtime } = controller(registers);
    await runtime.restore();
    registers.shiftImpl = async () => fail("INTEGRATION_UNAVAILABLE", "active shift lookup timed out");
    await runtime.refreshRegister();
    const state = runtime.getState();
    expect(state.register?.id).toBe("reg_a");
    expect(state.shift?.id).toBe(SHIFT_A.id);
    expect(state.shiftOpen).toBe(true);
    expect(state.errorMessage).toContain("timed out");
  });

  test("authoritative null active shift clears shift", async () => {
    const registers = stubRegisters();
    const { runtime } = controller(registers);
    await runtime.restore();
    registers.shiftImpl = async () => ok(null);
    await runtime.refreshRegister();
    expect(runtime.getState().shift).toBeNull();
    expect(runtime.getState().shiftOpen).toBe(false);
    expect(runtime.getState().register?.id).toBe("reg_a");
  });

  test("expired session on register GET fails closed and clears authority", async () => {
    const registers = stubRegisters();
    const { runtime } = controller(registers);
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
    const registers = stubRegisters();
    const { runtime } = controller(registers);
    await runtime.restore();
    registers.getImpl = async () => fail("FORBIDDEN", "register is out of staff scope");
    await runtime.refreshRegister();
    expect(runtime.getState().status).toBe("unauthorized");
    expect(runtime.getState().register).toBeNull();
    expect(runtime.getState().shiftOpen).toBe(false);
  });

  test("explicit sign-out clears state", async () => {
    const { runtime } = controller(stubRegisters());
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

describe("assigned register selection", () => {
  test("A. one assignment auto-selects A and loads A plus active shift A", async () => {
    const registers = stubRegisters();
    const { runtime } = controller(registers, ["reg_a"]);
    await runtime.restore();
    expect(registers.got).toContain("reg_a");
    expect(registers.shifted).toContain("reg_a");
    expect(runtime.getState()).toMatchObject({
      selectedRegisterId: "reg_a",
      register: { id: "reg_a" },
      shift: { id: SHIFT_A.id, registerId: "reg_a" },
      shiftOpen: true,
    });
  });

  test("B. two assignments with no stored choice do not auto-select the first register", async () => {
    const registers = stubRegisters();
    const { runtime, store } = controller(registers, ["reg_a", "reg_b"]);
    await runtime.restore();
    const state = runtime.getState();
    expect(state.selectedRegisterId).toBeNull();
    expect(state.register).toBeNull();
    expect(state.shift).toBeNull();
    expect(state.shiftOpen).toBe(false);
    expect(store.read("org_a", "cashier_a")).toBeNull();
    expect(registers.shifted).toEqual([]);
  });

  test("C. explicit select B loads B, activeShift(B), and persists B", async () => {
    const registers = stubRegisters();
    const { runtime, store } = controller(registers, ["reg_a", "reg_b"]);
    await runtime.restore();
    const accepted = await runtime.selectRegister("reg_b");
    expect(accepted).toBe(true);
    expect(runtime.getState()).toMatchObject({
      selectedRegisterId: "reg_b",
      register: { id: "reg_b", name: "Back Counter" },
      shift: { id: SHIFT_B.id, registerId: "reg_b" },
      shiftOpen: true,
    });
    expect(store.read("org_a", "cashier_a")).toBe("reg_b");
    expect(registers.shifted).toContain("reg_b");
  });

  test("D. refresh restores stored B with authoritative B register and shift", async () => {
    const store = createMemorySelectedRegisterStore({
      [selectedRegisterStorageKey("org_a", "cashier_a")]: "reg_b",
    });
    const registers = stubRegisters();
    const { runtime } = controller(registers, ["reg_a", "reg_b"], store);
    await runtime.restore();
    expect(runtime.getState().selectedRegisterId).toBe("reg_b");
    expect(runtime.getState().register?.id).toBe("reg_b");
    expect(runtime.getState().shift?.id).toBe(SHIFT_B.id);
    await runtime.refreshRegister();
    expect(runtime.getState().selectedRegisterId).toBe("reg_b");
    expect(runtime.getState().register?.id).toBe("reg_b");
    expect(runtime.getState().shift?.id).toBe(SHIFT_B.id);
  });

  test("E. deassignment clears stored B and does not keep B's shift", async () => {
    const store = createMemorySelectedRegisterStore({
      [selectedRegisterStorageKey("org_a", "cashier_a")]: "reg_b",
    });
    let assigned: readonly string[] = ["reg_a", "reg_b"];
    const registers = stubRegisters();
    const { runtime } = controller(registers, () => assigned, store);
    await runtime.restore();
    expect(runtime.getState().shift?.id).toBe(SHIFT_B.id);
    assigned = ["reg_a"];
    await runtime.restore();
    expect(runtime.getState().selectedRegisterId).toBe("reg_a");
    expect(runtime.getState().register?.id).toBe("reg_a");
    expect(runtime.getState().shift?.id).toBe(SHIFT_A.id);
    expect(runtime.getState().shift?.registerId).toBe("reg_a");
    expect(store.read("org_a", "cashier_a")).toBe("reg_a");
  });

  test("F. unauthorized select C is rejected without mutation or persistence", async () => {
    const registers = stubRegisters();
    const { runtime, store } = controller(registers, ["reg_a", "reg_b"]);
    await runtime.restore();
    const before = runtime.getState();
    const accepted = await runtime.selectRegister("reg_c");
    expect(accepted).toBe(false);
    expect(runtime.getState()).toEqual(before);
    expect(store.read("org_a", "cashier_a")).toBeNull();
  });

  test("G. checkout scope uses selected B / shift B, not A", async () => {
    const { runtime } = controller(stubRegisters(), ["reg_a", "reg_b"]);
    await runtime.restore();
    await runtime.selectRegister("reg_b");
    const scope = checkoutScopeFromStaffAuthority(runtime.getState(), "fallback-device");
    expect(scope).toEqual({
      registerId: "reg_b",
      shiftId: SHIFT_B.id,
      deviceId: SHIFT_B.deviceId,
    });
    expect(scope?.registerId).not.toBe("reg_a");
    expect(scope?.shiftId).not.toBe(SHIFT_A.id);
  });

  test("checkout stays fail-closed until a register is selected", () => {
    expect(
      checkoutScopeFromStaffAuthority(
        {
          status: "ready",
          session: SESSION,
          assignedLocationIds: ["loc_a1"],
          assignedRegisterIds: ["reg_a", "reg_b"],
          assignedRegisters: [REGISTER_A, REGISTER_B],
          selectedRegisterId: null,
          register: null,
          shift: null,
          shiftOpen: false,
        },
        "fallback-device",
      ),
    ).toBeUndefined();
  });

  test("a shift belonging to another register is not reusable as checkout scope", () => {
    expect(
      checkoutScopeFromStaffAuthority(
        {
          status: "ready",
          session: SESSION,
          assignedLocationIds: ["loc_a1"],
          assignedRegisterIds: ["reg_a", "reg_b"],
          assignedRegisters: [REGISTER_A, REGISTER_B],
          selectedRegisterId: "reg_b",
          register: REGISTER_B,
          shift: SHIFT_A,
          shiftOpen: true,
        },
        "fallback-device",
      ),
    ).toBeUndefined();
  });
});

function stubRegisters(): RegisterPort & {
  got: string[];
  shifted: string[];
  getImpl: (id: string) => Promise<ApiResult<Register>>;
  shiftImpl: (id: string) => Promise<ApiResult<Shift | null>>;
} {
  const byId: Record<string, Register> = { reg_a: REGISTER_A, reg_b: REGISTER_B };
  const shiftById: Record<string, Shift> = { reg_a: SHIFT_A, reg_b: SHIFT_B };
  const port = {
    got: [] as string[],
    shifted: [] as string[],
    getImpl: async (id: string): Promise<ApiResult<Register>> => {
      const register = byId[id];
      return register ? ok(register) : fail("NOT_FOUND", "register was not found");
    },
    shiftImpl: async (id: string): Promise<ApiResult<Shift | null>> => ok(shiftById[id] ?? null),
    async get(id: string) {
      port.got.push(id);
      return port.getImpl(id);
    },
    async activeShift(id: string) {
      port.shifted.push(id);
      return port.shiftImpl(id);
    },
    open: async () => ok(SHIFT_A),
    cashMovement: async () => fail("INTEGRATION_UNAVAILABLE", "unused"),
    close: async () => ok(SHIFT_A),
    report: async () => fail("INTEGRATION_UNAVAILABLE", "unused"),
  };
  return port;
}

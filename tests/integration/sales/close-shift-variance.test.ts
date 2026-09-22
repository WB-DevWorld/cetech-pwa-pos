import { describe, expect, test } from "vitest";
import { createInMemoryCheckoutStore } from "../../../apps/pos-web/src/core/checkout/in-memory-store";
import { handleCloseShift } from "../../../apps/pos-web/src/server/sales/handle-close-shift";
import {
  createMemoryOperationalPolicyStore,
  type OperationalPolicyStore,
} from "../../../apps/pos-web/src/server/admin/operational-policy-store";
import type { ShiftClosePolicyOverride } from "../../../apps/pos-web/src/server/auth/policy";
import {
  commandBase,
  ghs,
  openRegister,
  seedRegister,
  staffCookies,
} from "../returns/helpers";

const ZERO_KEY = "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const ZERO_WITH_APPROVAL_KEY = "aaaaaaa6-aaaa-4aaa-8aaa-aaaaaaaaaaa6";
const VARIANCE_KEY = "aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const INVENTED_KEY = "aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const ARBITRARY_KEY = "aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4";
const IDEMPOTENT_KEY = "aaaaaaa5-aaaa-4aaa-8aaa-aaaaaaaaaaa5";
const INVENTED_APPROVAL = "77777777-7777-4777-8777-777777777777";
const ARBITRARY_APPROVAL = "88888888-8888-4888-8888-888888888888";

async function createOpenShiftRuntime() {
  const checkoutStore = createInMemoryCheckoutStore();
  await seedRegister(checkoutStore);
  const shiftId = await openRegister(checkoutStore);
  const manager = await staffCookies({ actorId: "manager_a", displayName: "Manager A" });
  const cashier = await staffCookies();
  const policies = createMemoryOperationalPolicyStore();
  return { checkoutStore, shiftId, manager, cashier, policies };
}

async function close(
  runtime: Awaited<ReturnType<typeof createOpenShiftRuntime>>,
  countedMinor: number,
  key: string,
  approvalId?: string,
  options?: {
    readonly actor?: "manager" | "cashier";
    readonly policies?: OperationalPolicyStore;
  },
) {
  const staff = options?.actor === "cashier" ? runtime.cashier : runtime.manager;
  return handleCloseShift({
    ...commandBase(staff.cookieHeader),
    sessionStore: staff.store,
    checkoutStore: runtime.checkoutStore,
    policies: options?.policies ?? runtime.policies,
    idempotencyKeyHeader: key,
    body: {
      shiftId: runtime.shiftId,
      countedCash: ghs(countedMinor),
      ...(approvalId ? { approvalId } : {}),
    },
  });
}

async function policiesWith(
  override: ShiftClosePolicyOverride,
): Promise<OperationalPolicyStore> {
  const store = createMemoryOperationalPolicyStore();
  await store.writeOverride({
    scope: { organizationId: "org_a", locationId: "loc_a1", registerId: "reg_a1" },
    override,
    actorId: "admin_a",
    correlationId: CORRELATION,
  });
  return store;
}

describe("R8-02 shift variance is fail-closed", () => {
  test("zero variance closes and records closedAt", async () => {
    const runtime = await createOpenShiftRuntime();
    const result = await close(runtime, 10000, ZERO_KEY);
    expect(result.body.ok).toBe(true);
    if (!result.body.ok) {
      return;
    }
    expect(result.body.data.status).toBe("closed");
    expect(result.body.data.closedAt).toBeTruthy();
    expect(result.body.data.variance?.minor).toBe(0);
  });

  test("zero variance still closes because variance is zero, not because of approvalId", async () => {
    const runtime = await createOpenShiftRuntime();
    const result = await close(runtime, 10000, ZERO_WITH_APPROVAL_KEY, INVENTED_APPROVAL);
    expect(result.body.ok).toBe(true);
    if (!result.body.ok) {
      return;
    }
    expect(result.body.data.status).toBe("closed");
    expect(result.body.data.closedAt).toBeTruthy();
    expect(result.body.data.variance?.minor).toBe(0);
  });

  test("non-zero variance without approval stays requires_attention", async () => {
    const runtime = await createOpenShiftRuntime();
    const result = await close(runtime, 9900, VARIANCE_KEY);
    expect(result.body.ok).toBe(true);
    if (!result.body.ok) {
      return;
    }
    expect(result.body.data.status).toBe("requires_attention");
    expect(result.body.data.closedAt).toBeUndefined();
    expect(result.body.data.countedCash).toEqual(ghs(9900));
    expect(result.body.data.expectedCash).toEqual(ghs(10000));
    expect(result.body.data.variance?.minor).toBe(-100);
  });

  test("invented approval UUID cannot close a non-zero variance", async () => {
    const runtime = await createOpenShiftRuntime();
    const result = await close(runtime, 9900, INVENTED_KEY, INVENTED_APPROVAL);
    expect(result.body.ok).toBe(true);
    if (!result.body.ok) {
      return;
    }
    expect(result.body.data.status).toBe("requires_attention");
    expect(result.body.data.closedAt).toBeUndefined();
  });

  test("a different arbitrary UUID still has zero close authority", async () => {
    const runtime = await createOpenShiftRuntime();
    const result = await close(runtime, 9900, ARBITRARY_KEY, ARBITRARY_APPROVAL);
    expect(result.body.ok).toBe(true);
    if (!result.body.ok) {
      return;
    }
    expect(result.body.data.status).toBe("requires_attention");
    expect(result.body.data.closedAt).toBeUndefined();
  });

  test("default compatibility policy still denies cashier shift close", async () => {
    const runtime = await createOpenShiftRuntime();
    const result = await close(runtime, 10000, "aaaaaaa7-aaaa-4aaa-8aaa-aaaaaaaaaaa7", undefined, {
      actor: "cashier",
    });
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("FORBIDDEN");
    }
    expect((await runtime.checkoutStore.getShift(runtime.shiftId))?.status).toBe("open");
  });

  test("configured policy allows cashier to close their own zero-variance shift", async () => {
    const runtime = await createOpenShiftRuntime();
    const policies = await policiesWith({ cashierCanCloseShift: true });
    const result = await close(runtime, 10000, "aaaaaaa8-aaaa-4aaa-8aaa-aaaaaaaaaaa8", undefined, {
      actor: "cashier",
      policies,
    });
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.data.status).toBe("closed");
      expect(result.body.data.variance?.minor).toBe(0);
    }
  });

  test("cashier non-zero variance is denied when policy requires manager review", async () => {
    const runtime = await createOpenShiftRuntime();
    const policies = await policiesWith({
      cashierCanCloseShift: true,
      nonZeroVarianceRequiresManager: true,
      varianceToleranceMinor: 0,
      varianceCurrency: "GHS",
    });
    const result = await close(runtime, 9900, "aaaaaaa9-aaaa-4aaa-8aaa-aaaaaaaaaaa9", undefined, {
      actor: "cashier",
      policies,
    });
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("FORBIDDEN");
      expect(result.body.error.message).toMatch(/variance requires manager/i);
    }
    expect((await runtime.checkoutStore.getShift(runtime.shiftId))?.status).toBe("open");
  });

  test("policy can allow cashier to submit non-zero count while close effect remains fail-closed", async () => {
    const runtime = await createOpenShiftRuntime();
    const policies = await policiesWith({
      cashierCanCloseShift: true,
      nonZeroVarianceRequiresManager: false,
    });
    const result = await close(runtime, 9900, "aaaaaa10-aaaa-4aaa-8aaa-aaaaaaaaaa10", undefined, {
      actor: "cashier",
      policies,
    });
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.data.status).toBe("requires_attention");
      expect(result.body.data.closedAt).toBeUndefined();
    }
  });

  test("manager close authority can be disabled by policy", async () => {
    const runtime = await createOpenShiftRuntime();
    const policies = await policiesWith({ managerCanCloseShift: false });
    const result = await close(runtime, 10000, "aaaaaa11-aaaa-4aaa-8aaa-aaaaaaaaaa11", undefined, {
      policies,
    });
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("FORBIDDEN");
    }
    expect((await runtime.checkoutStore.getShift(runtime.shiftId))?.status).toBe("open");
  });

  test("manager close-other authority is independently configurable", async () => {
    const runtime = await createOpenShiftRuntime();
    const policies = await policiesWith({ managerCanCloseOthersShift: false });
    const result = await close(runtime, 10000, "aaaaaa12-aaaa-4aaa-8aaa-aaaaaaaaaa12", undefined, {
      policies,
    });
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("FORBIDDEN");
      expect(result.body.error.message).toMatch(/another staff member/i);
    }
  });

  test("idempotent replay does not duplicate close or escalate status", async () => {
    const runtime = await createOpenShiftRuntime();
    const first = await close(runtime, 9900, IDEMPOTENT_KEY, INVENTED_APPROVAL);
    const replay = await close(runtime, 9900, IDEMPOTENT_KEY, INVENTED_APPROVAL);
    expect(first.body.ok).toBe(true);
    expect(replay.body.ok).toBe(true);
    if (!first.body.ok || !replay.body.ok) {
      return;
    }
    expect(first.body.data.status).toBe("requires_attention");
    expect(replay.body.data.status).toBe("requires_attention");
    expect(replay.body.data.closedAt).toBeUndefined();
    expect(replay.body.data).toEqual(first.body.data);

    const conflict = await close(runtime, 10000, IDEMPOTENT_KEY);
    expect(conflict.body.ok).toBe(false);
    if (conflict.body.ok) {
      return;
    }
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
    const stored = await runtime.checkoutStore.getShift(runtime.shiftId);
    expect(stored?.status).toBe("requires_attention");
    expect(stored?.closedAt).toBeUndefined();
  });
});

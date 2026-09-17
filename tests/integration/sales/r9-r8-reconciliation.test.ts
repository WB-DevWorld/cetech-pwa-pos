import { describe, expect, test } from "vitest";
import { handleCloseShift } from "../../../apps/pos-web/src/server/sales/handle-close-shift";
import { handleGetShiftReport } from "../../../apps/pos-web/src/server/sales/handle-get-shift-report";
import { durableZReportId } from "../../../apps/pos-web/src/server/sales/close-shift";
import {
  commandBase,
  ghs,
  openRegister,
  seedRegister,
  staffCookies,
} from "../returns/helpers";
import { createInMemoryCheckoutStore } from "../../../apps/pos-web/src/core/checkout/in-memory-store";

const ZERO_KEY = "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const ZERO_REPLAY_KEY = "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const ZERO_CONFLICT_KEY = "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const VARIANCE_KEY = "bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const INVENTED_KEY = "bbbbbbb3-bbbb-4bbb-8bbb-bbbbbbbbbbb3";
const RECOUNT_KEY = "bbbbbbb4-bbbb-4bbb-8bbb-bbbbbbbbbbb4";
const INVENTED_APPROVAL = "77777777-7777-4777-8777-777777777777";

async function createOpenShiftRuntime() {
  const checkoutStore = createInMemoryCheckoutStore();
  await seedRegister(checkoutStore);
  const shiftId = await openRegister(checkoutStore);
  const manager = await staffCookies({ actorId: "manager_a", displayName: "Manager A" });
  return { checkoutStore, shiftId, manager };
}

async function close(
  runtime: Awaited<ReturnType<typeof createOpenShiftRuntime>>,
  countedMinor: number,
  key: string,
  approvalId?: string,
) {
  return handleCloseShift({
    ...commandBase(runtime.manager.cookieHeader),
    sessionStore: runtime.manager.store,
    checkoutStore: runtime.checkoutStore,
    idempotencyKeyHeader: key,
    body: {
      shiftId: runtime.shiftId,
      countedCash: ghs(countedMinor),
      ...(approvalId ? { approvalId } : {}),
    },
  });
}

async function report(
  runtime: Awaited<ReturnType<typeof createOpenShiftRuntime>>,
  kind: "X" | "Z",
) {
  return handleGetShiftReport({
    ...commandBase(runtime.manager.cookieHeader),
    sessionStore: runtime.manager.store,
    checkoutStore: runtime.checkoutStore,
    shiftId: runtime.shiftId,
    kind,
  });
}

describe("R9-on-R8 operational close reconciliation", () => {
  test("zero variance closes, mints exactly one durable Z, and the report endpoint returns that Z", async () => {
    const runtime = await createOpenShiftRuntime();
    const result = await close(runtime, 10000, ZERO_KEY);
    expect(result.body.ok).toBe(true);
    if (!result.body.ok) {
      return;
    }
    expect(result.body.data.status).toBe("closed");
    expect(result.body.data.closedAt).toBeTruthy();
    expect(result.body.data.zReportId).toBe(durableZReportId(runtime.shiftId));
    expect(result.body.data).not.toHaveProperty("report");

    const firstZ = await report(runtime, "Z");
    expect(firstZ.body.ok).toBe(true);
    if (!firstZ.body.ok) {
      return;
    }
    expect(firstZ.body.data.id).toBe(durableZReportId(runtime.shiftId));
    expect(firstZ.body.data.kind).toBe("Z");
    expect(firstZ.body.data.expectedCash).toEqual(ghs(10000));
    expect(firstZ.body.data.countedCash).toEqual(ghs(10000));
    expect(firstZ.body.data.variance?.minor).toBe(0);

    const replay = await close(runtime, 10000, ZERO_REPLAY_KEY);
    expect(replay.body.ok).toBe(true);
    if (!replay.body.ok) {
      return;
    }
    expect(replay.body.data.zReportId).toBe(result.body.data.zReportId);
    const secondZ = await report(runtime, "Z");
    expect(secondZ.body.ok).toBe(true);
    if (!secondZ.body.ok) {
      return;
    }
    expect(secondZ.body.data.id).toBe(firstZ.body.data.id);
    expect(await runtime.checkoutStore.getShiftReport(runtime.shiftId, "Z")).toEqual(firstZ.body.data);

    const conflict = await close(runtime, 9900, ZERO_CONFLICT_KEY);
    expect(conflict.body.ok).toBe(false);
    if (conflict.body.ok) {
      return;
    }
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  test("non-zero variance stays requires_attention with no Z, including invented approval UUID", async () => {
    const runtime = await createOpenShiftRuntime();
    const result = await close(runtime, 9900, VARIANCE_KEY);
    expect(result.body.ok).toBe(true);
    if (!result.body.ok) {
      return;
    }
    expect(result.body.data.status).toBe("requires_attention");
    expect(result.body.data.closedAt).toBeUndefined();
    expect(result.body.data.zReportId).toBeUndefined();
    expect(await runtime.checkoutStore.getShiftReport(runtime.shiftId, "Z")).toBeUndefined();

    const z = await report(runtime, "Z");
    expect(z.body.ok).toBe(false);
    if (z.body.ok) {
      return;
    }
    expect(z.body.error.code).toBe("VALIDATION_ERROR");

    const invented = await close(runtime, 9800, INVENTED_KEY, INVENTED_APPROVAL);
    expect(invented.body.ok).toBe(true);
    if (!invented.body.ok) {
      return;
    }
    expect(invented.body.data.status).toBe("requires_attention");
    expect(invented.body.data.closedAt).toBeUndefined();
    expect(await runtime.checkoutStore.getShiftReport(runtime.shiftId, "Z")).toBeUndefined();
  });

  test("a later corrected recount with a new key may close and then expose the durable Z", async () => {
    const runtime = await createOpenShiftRuntime();
    const attention = await close(runtime, 9900, VARIANCE_KEY);
    expect(attention.body.ok).toBe(true);
    if (attention.body.ok) {
      expect(attention.body.data.status).toBe("requires_attention");
    }
    const corrected = await close(runtime, 10000, RECOUNT_KEY);
    expect(corrected.body.ok).toBe(true);
    if (!corrected.body.ok) {
      return;
    }
    expect(corrected.body.data.status).toBe("closed");
    expect(corrected.body.data.zReportId).toBe(durableZReportId(runtime.shiftId));
    const z = await report(runtime, "Z");
    expect(z.body.ok).toBe(true);
    if (!z.body.ok) {
      return;
    }
    expect(z.body.data.id).toBe(corrected.body.data.zReportId);
  });
});

import { describe, expect, test } from "vitest";
import type { Shift, ShiftReport } from "../../../../../docs/contracts/domain.generated";
import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import type { StoredShift } from "../../core/checkout/types";
import type { PosRestFetch } from "../http/server-fetch";
import { closeShift } from "../sales/close-shift";
import {
  createSupabaseOperationalCloseStore,
  type OperationalCloseStore,
} from "./operational-close-store";

const SHIFT_ID = "11111111-1111-4111-8111-111111111111";
const DEVICE_ID = "22222222-2222-4222-8222-222222222222";
const IDEMPOTENCY_KEY = "33333333-3333-4333-8333-333333333333";
const CORRELATION_ID = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-09-15T22:00:00.000Z");

function storedShift(overrides: Partial<StoredShift> = {}): StoredShift {
  return {
    id: SHIFT_ID,
    organizationId: "org_a",
    locationId: "loc_a1",
    registerId: "reg_a",
    deviceId: DEVICE_ID,
    cashierId: "cashier_a",
    status: "open",
    openingFloat: { minor: 5000, currency: "GHS" },
    expectedCash: { minor: 7500, currency: "GHS" },
    openedAt: "2026-09-15T20:00:00.000Z",
    ...overrides,
  };
}

function closedOutcome(): { shift: Shift; report: ShiftReport } {
  return {
    shift: {
      id: SHIFT_ID,
      registerId: "reg_a",
      deviceId: DEVICE_ID,
      cashierId: "cashier_a",
      status: "closed",
      openingFloat: { minor: 5000, currency: "GHS" },
      expectedCash: { minor: 7500, currency: "GHS" },
      countedCash: { minor: 7500, currency: "GHS" },
      variance: { minor: 0, currency: "GHS" },
      openedAt: "2026-09-15T20:00:00.000Z",
      closedAt: "2026-09-15T22:00:00.000Z",
      zReportId: `Z:${SHIFT_ID}`,
    },
    report: {
      id: `Z:${SHIFT_ID}`,
      shiftId: SHIFT_ID,
      kind: "Z",
      expectedCash: { minor: 7500, currency: "GHS" },
      countedCash: { minor: 7500, currency: "GHS" },
      variance: { minor: 0, currency: "GHS" },
      createdAt: "2026-09-15T22:00:00.000Z",
    },
  };
}

const actor = {
  actorId: "cashier_a",
  displayName: "Cashier A",
  organizationId: "org_a",
  locationIds: ["loc_a1"],
} as const;

describe("CORE-07 closeShift behind the R8 BFF", () => {
  test("atomic close returns only Shift and keeps the durable Z off the wire contract", async () => {
    const store = createInMemoryCheckoutStore();
    await store.insertOpenShift(storedShift());
    const seen: Array<Parameters<OperationalCloseStore["close"]>[0]> = [];
    const closeStore: OperationalCloseStore = {
      async close(input) {
        seen.push(input);
        return { kind: "closed", ...closedOutcome() };
      },
    };

    const result = await closeShift({
      store,
      closeStore,
      actor,
      request: { shiftId: SHIFT_ID, countedCash: { minor: 7500, currency: "GHS" } },
      context: { idempotencyKey: IDEMPOTENCY_KEY, correlationId: CORRELATION_ID },
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("closed");
      expect(result.data.zReportId).toBe(`Z:${SHIFT_ID}`);
      expect(result.data).not.toHaveProperty("report");
    }
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      organizationId: "org_a",
      shiftId: SHIFT_ID,
      countedCash: { minor: 7500, currency: "GHS" },
    });
    expect(Object.keys(seen[0] ?? {})).not.toContain("expectedCash");
  });

  test("atomic non-zero variance returns requires_attention without a Z", async () => {
    const store = createInMemoryCheckoutStore();
    await store.insertOpenShift(storedShift());
    const closeStore: OperationalCloseStore = {
      async close() {
        return {
          kind: "requires_attention",
          shift: {
            id: SHIFT_ID,
            registerId: "reg_a",
            deviceId: DEVICE_ID,
            cashierId: "cashier_a",
            status: "requires_attention",
            openingFloat: { minor: 5000, currency: "GHS" },
            expectedCash: { minor: 7500, currency: "GHS" },
            countedCash: { minor: 7300, currency: "GHS" },
            variance: { minor: -200, currency: "GHS" },
            openedAt: "2026-09-15T20:00:00.000Z",
          },
        };
      },
    };

    const result = await closeShift({
      store,
      closeStore,
      actor,
      request: { shiftId: SHIFT_ID, countedCash: { minor: 7300, currency: "GHS" } },
      context: { idempotencyKey: IDEMPOTENCY_KEY, correlationId: CORRELATION_ID },
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("requires_attention");
      expect(result.data.closedAt).toBeUndefined();
      expect(result.data.zReportId).toBeUndefined();
    }
  });

  test("refuses a shift outside the actor location without touching the close effect", async () => {
    const store = createInMemoryCheckoutStore();
    await store.insertOpenShift(storedShift({ locationId: "loc_a2" }));
    let calls = 0;
    const closeStore: OperationalCloseStore = {
      async close() {
        calls += 1;
        return { kind: "closed", ...closedOutcome() };
      },
    };

    const result = await closeShift({
      store,
      closeStore,
      actor,
      request: { shiftId: SHIFT_ID, countedCash: { minor: 7500, currency: "GHS" } },
      context: { idempotencyKey: IDEMPOTENCY_KEY, correlationId: CORRELATION_ID },
      now: NOW,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
    expect(calls).toBe(0);
  });

  test("fails closed when the returned Z report does not belong to the closed shift", async () => {
    const store = createInMemoryCheckoutStore();
    await store.insertOpenShift(storedShift());
    const closeStore: OperationalCloseStore = {
      async close() {
        const outcome = closedOutcome();
        return {
          kind: "closed",
          shift: outcome.shift,
          report: { ...outcome.report, shiftId: "55555555-5555-4555-8555-555555555555" },
        };
      },
    };

    const result = await closeShift({
      store,
      closeStore,
      actor,
      request: { shiftId: SHIFT_ID, countedCash: { minor: 7500, currency: "GHS" } },
      context: { idempotencyKey: IDEMPOTENCY_KEY, correlationId: CORRELATION_ID },
      now: NOW,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTEGRATION_UNAVAILABLE");
    }
  });
});

describe("CORE-07 Supabase operational close adapter", () => {
  test("passes separate idempotency and correlation identities and maps a zero-variance RPC snapshot", async () => {
    const calls: Array<{ url: string; body?: string }> = [];
    const fetchImpl: PosRestFetch = async (url, init) => {
      calls.push({ url, body: init.body });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          shift: {
            id: SHIFT_ID,
            register_id: "reg_a",
            device_id: DEVICE_ID,
            cashier_id: "cashier_a",
            status: "closed",
            opening_float_minor: 5000,
            opening_float_currency: "GHS",
            expected_cash_minor: 7500,
            expected_cash_currency: "GHS",
            counted_cash_minor: 7500,
            counted_cash_currency: "GHS",
            variance_minor: 0,
            variance_currency: "GHS",
            opened_at: "2026-09-15T20:00:00+00:00",
            closed_at: "2026-09-15T22:00:00+00:00",
            z_report_id: `Z:${SHIFT_ID}`,
          },
          report: {
            id: `Z:${SHIFT_ID}`,
            shift_id: SHIFT_ID,
            kind: "Z",
            expected_cash_minor: 7500,
            counted_cash_minor: 7500,
            variance_minor: 0,
            currency: "GHS",
            created_at: "2026-09-15T22:00:00+00:00",
          },
        }),
      };
    };
    const adapter = createSupabaseOperationalCloseStore({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-test-key",
      fetchImpl,
    });

    const result = await adapter.close({
      organizationId: "org_a",
      shiftId: SHIFT_ID,
      countedCash: { minor: 7500, currency: "GHS" },
      context: { idempotencyKey: IDEMPOTENCY_KEY, correlationId: CORRELATION_ID },
      requestHash: "a".repeat(64),
    });

    expect(result.kind).toBe("closed");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://example.supabase.co/rest/v1/rpc/pos_close_shift_blind");
    expect(JSON.parse(calls[0]?.body ?? "{}") as unknown).toEqual({
      p_organization_id: "org_a",
      p_shift_id: SHIFT_ID,
      p_counted_cash_minor: 7500,
      p_currency: "GHS",
      p_idempotency_key: IDEMPOTENCY_KEY,
      p_correlation_id: CORRELATION_ID,
      p_request_hash: "a".repeat(64),
    });
    if (result.kind === "closed") {
      expect(result.shift.closedAt).toBe("2026-09-15T22:00:00.000Z");
      expect(result.report.variance?.minor).toBe(0);
    }
  });

  test("maps a non-zero variance RPC snapshot to requires_attention without a report", async () => {
    const fetchImpl: PosRestFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        shift: {
          id: SHIFT_ID,
          register_id: "reg_a",
          device_id: DEVICE_ID,
          cashier_id: "cashier_a",
          status: "requires_attention",
          opening_float_minor: 5000,
          opening_float_currency: "GHS",
          expected_cash_minor: 7500,
          expected_cash_currency: "GHS",
          counted_cash_minor: 7300,
          counted_cash_currency: "GHS",
          variance_minor: -200,
          variance_currency: "GHS",
          opened_at: "2026-09-15T20:00:00+00:00",
          closed_at: null,
          z_report_id: null,
        },
        report: null,
      }),
    });
    const adapter = createSupabaseOperationalCloseStore({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-test-key",
      fetchImpl,
    });
    const result = await adapter.close({
      organizationId: "org_a",
      shiftId: SHIFT_ID,
      countedCash: { minor: 7300, currency: "GHS" },
      context: { idempotencyKey: IDEMPOTENCY_KEY, correlationId: CORRELATION_ID },
      requestHash: "c".repeat(64),
    });
    expect(result.kind).toBe("requires_attention");
    if (result.kind === "requires_attention") {
      expect(result.shift.closedAt).toBeUndefined();
      expect(result.shift.zReportId).toBeUndefined();
    }
  });
});

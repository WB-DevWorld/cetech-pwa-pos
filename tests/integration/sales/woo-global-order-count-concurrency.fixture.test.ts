/**
 * Lane B reproduction + RACE-FIX-ORDER-COUNT-01 candidate model.
 *
 * Old predicate: global COUNT(*) delta must equal 1 after prepare.
 * New predicate: operation-local POS identity remains unique (recovery/tx).
 *
 * Bridge implementation lives in class-woo-runtime.php / fake-woo-runtime.php;
 * this fixture documents the predicate change for connected POS tests.
 */

import { describe, expect, test } from "vitest";

type WooOrder = {
  id: string;
  pos: boolean;
  recoveryToken?: string;
  transactionId?: string;
  trashed?: boolean;
};

type PrepareOutcome =
  | { ok: true; posOrderId: string; posOrderCount: number; globalDelta: number }
  | {
      ok: false;
      code: "INTEGRATION_UNAVAILABLE";
      message: string;
      posOrderCount: number;
      globalDelta: number;
      orphanedReservedPosOrder: boolean;
    };

/** Historical production predicate (Lane B defect). */
function createPreparedOrderWithGlobalCountGuard(input: {
  orders: WooOrder[];
  duringPrepare?: (orders: WooOrder[]) => void;
  nextId: () => string;
}): PrepareOutcome {
  const before = input.orders.filter((o) => !o.trashed).length;
  const posOrderId = input.nextId();
  input.orders.push({ id: posOrderId, pos: true, recoveryToken: "tok-" + posOrderId });
  input.duringPrepare?.(input.orders);
  const after = input.orders.filter((o) => !o.trashed).length;
  const globalDelta = after - before;
  const posOrderCount = input.orders.filter((o) => o.pos && !o.trashed).length;
  if (globalDelta !== 1) {
    return {
      ok: false,
      code: "INTEGRATION_UNAVAILABLE",
      message: "Woo order count did not increase by exactly one during prepare.",
      posOrderCount,
      globalDelta,
      orphanedReservedPosOrder: true,
    };
  }
  return { ok: true, posOrderId, posOrderCount, globalDelta };
}

/** Candidate predicate: unique POS recovery identity; ignore global delta. */
function createPreparedOrderWithIdentityGuard(input: {
  orders: WooOrder[];
  duringPrepare?: (orders: WooOrder[]) => void;
  nextId: () => string;
  recoveryToken: string;
  transactionId: string;
}): PrepareOutcome {
  const before = input.orders.filter((o) => !o.trashed).length;
  const posOrderId = input.nextId();
  input.orders.push({
    id: posOrderId,
    pos: true,
    recoveryToken: input.recoveryToken,
    transactionId: input.transactionId,
  });
  input.duringPrepare?.(input.orders);
  const after = input.orders.filter((o) => !o.trashed).length;
  const globalDelta = after - before;
  const posOrderCount = input.orders.filter((o) => o.pos && !o.trashed).length;
  const byToken = input.orders.filter(
    (o) => !o.trashed && o.recoveryToken === input.recoveryToken,
  );
  const byTx = input.orders.filter(
    (o) => !o.trashed && o.transactionId === input.transactionId,
  );
  if (byToken.length !== 1 || byTx.length !== 1 || byToken[0]?.id !== posOrderId) {
    return {
      ok: false,
      code: "INTEGRATION_UNAVAILABLE",
      message: "Prepared order recovery identity is missing or not unique.",
      posOrderCount,
      globalDelta,
      orphanedReservedPosOrder: true,
    };
  }
  return { ok: true, posOrderId, posOrderCount, globalDelta };
}

describe("Woo global order-count concurrency (old vs identity predicate)", () => {
  test("OLD negative control: concurrent storefront fails despite one POS order", () => {
    const orders: WooOrder[] = [{ id: "existing-1", pos: false }];
    let n = 20;
    const result = createPreparedOrderWithGlobalCountGuard({
      orders,
      nextId: () => String(++n),
      duringPrepare: (live) => {
        live.push({ id: "storefront-race", pos: false });
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected global-count false negative");
    expect(result.code).toBe("INTEGRATION_UNAVAILABLE");
    expect(result.message).toBe(
      "Woo order count did not increase by exactly one during prepare.",
    );
    expect(result.posOrderCount).toBe(1);
    expect(result.globalDelta).toBe(2);
  });

  test("CANDIDATE: concurrent storefront keeps prepare OK when POS identity is unique", () => {
    const orders: WooOrder[] = [{ id: "existing-1", pos: false }];
    let n = 30;
    const result = createPreparedOrderWithIdentityGuard({
      orders,
      nextId: () => String(++n),
      recoveryToken: "tok-unique",
      transactionId: "tx-unique",
      duringPrepare: (live) => {
        live.push({ id: "storefront-race", pos: false });
      },
    });
    expect(result).toEqual({
      ok: true,
      posOrderId: "31",
      posOrderCount: 1,
      globalDelta: 2,
    });
  });

  test("CANDIDATE: unrelated deletion cannot disguise a second POS identity", () => {
    const orders: WooOrder[] = [];
    let n = 40;
    const result = createPreparedOrderWithIdentityGuard({
      orders,
      nextId: () => String(++n),
      recoveryToken: "tok-a",
      transactionId: "tx-a",
      duringPrepare: (live) => {
        live.push({ id: "storefront-2", pos: false });
        live.push({
          id: "pos-dup",
          pos: true,
          recoveryToken: "tok-a",
          transactionId: "tx-a",
        });
        for (let i = live.length - 1; i >= 0; i -= 1) {
          if (!live[i]?.pos) live.splice(i, 1);
        }
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected duplicate identity failure");
    expect(result.message).toBe(
      "Prepared order recovery identity is missing or not unique.",
    );
  });
});

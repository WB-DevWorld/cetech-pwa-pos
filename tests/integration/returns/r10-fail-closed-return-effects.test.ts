import { describe, expect, test } from "vitest";
import { handleExecuteReturn } from "../../../apps/pos-web/src/server/returns/handle-execute-return";
import {
  cashierAssignments,
  commandBase,
  createRt01Runtime,
  EXEC_KEY,
  preview,
} from "../returns/helpers";

describe("R10 fail-closed return effects", () => {
  test("approval-required return cannot reach refund/commercial/stock effects before approval", async () => {
    const runtime = await createRt01Runtime({ tender: "card" });
    const previewed = await preview(runtime, { requireApproval: true, condition: "resellable" });
    expect(previewed.body.ok).toBe(true);
    if (!previewed.body.ok) {
      return;
    }

    const executed = await handleExecuteReturn({
      ...commandBase(runtime.sessions.cookieHeader),
      sessionStore: runtime.sessions.store,
      checkoutStore: runtime.checkoutStore,
      returnStore: runtime.returnStore,
      provider: runtime.refundProvider,
      bridge: runtime.bridge,
      idempotencyKeyHeader: EXEC_KEY,
      body: {
        returnId: previewed.body.data.returnId,
        fingerprint: previewed.body.data.fingerprint,
      },
    });

    expect(executed.body.ok).toBe(false);
    expect(runtime.refundProvider.createCount).toBe(0);
    expect(runtime.refundProvider.resolveCount).toBe(0);
    expect(runtime.bridge.commercialApplyCount).toBe(0);
    expect(runtime.bridge.commercialResolveCount).toBe(0);
    expect(runtime.bridge.stockApplyCount).toBe(0);
    expect(runtime.bridge.stockResolveCount).toBe(0);
  });

  test("wrong register assignment is denied before any return effect is invoked", async () => {
    const runtime = await createRt01Runtime({ tender: "card" });
    const previewed = await preview(runtime, { condition: "resellable" });
    expect(previewed.body.ok).toBe(true);
    if (!previewed.body.ok) {
      return;
    }

    const executed = await handleExecuteReturn({
      ...commandBase(runtime.sessions.cookieHeader),
      assignments: cashierAssignments(["reg_other"]),
      sessionStore: runtime.sessions.store,
      checkoutStore: runtime.checkoutStore,
      returnStore: runtime.returnStore,
      provider: runtime.refundProvider,
      bridge: runtime.bridge,
      idempotencyKeyHeader: EXEC_KEY,
      body: {
        returnId: previewed.body.data.returnId,
        fingerprint: previewed.body.data.fingerprint,
      },
    });

    expect(executed.body.ok).toBe(false);
    if (!executed.body.ok) {
      expect(executed.body.error.code).toBe("FORBIDDEN");
    }
    expect(runtime.refundProvider.createCount).toBe(0);
    expect(runtime.refundProvider.resolveCount).toBe(0);
    expect(runtime.bridge.commercialApplyCount).toBe(0);
    expect(runtime.bridge.commercialResolveCount).toBe(0);
    expect(runtime.bridge.stockApplyCount).toBe(0);
    expect(runtime.bridge.stockResolveCount).toBe(0);
  });

  test("missing CSRF protection is denied before any return effect is invoked", async () => {
    const runtime = await createRt01Runtime({ tender: "card" });
    const previewed = await preview(runtime, { condition: "resellable" });
    expect(previewed.body.ok).toBe(true);
    if (!previewed.body.ok) {
      return;
    }

    const executed = await handleExecuteReturn({
      ...commandBase(runtime.sessions.cookieHeader),
      csrfHeader: null,
      sessionStore: runtime.sessions.store,
      checkoutStore: runtime.checkoutStore,
      returnStore: runtime.returnStore,
      provider: runtime.refundProvider,
      bridge: runtime.bridge,
      idempotencyKeyHeader: EXEC_KEY,
      body: {
        returnId: previewed.body.data.returnId,
        fingerprint: previewed.body.data.fingerprint,
      },
    });

    expect(executed.body.ok).toBe(false);
    if (!executed.body.ok) {
      expect(executed.body.error.code).toBe("FORBIDDEN");
    }
    expect(runtime.refundProvider.createCount).toBe(0);
    expect(runtime.refundProvider.resolveCount).toBe(0);
    expect(runtime.bridge.commercialApplyCount).toBe(0);
    expect(runtime.bridge.commercialResolveCount).toBe(0);
    expect(runtime.bridge.stockApplyCount).toBe(0);
    expect(runtime.bridge.stockResolveCount).toBe(0);
  });
});

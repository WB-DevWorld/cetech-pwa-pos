import { describe, expect, test } from "vitest";
import { createPaystackElectronicRefundProvider } from "../../../apps/pos-web/src/server/payments/paystack-refund";
import { allocateHistoricMinor, formatNonNegativeQuantity } from "../../../apps/pos-web/src/core/returns/quantities";
import { mapConditionDisposition, stockEffectRequired } from "../../../apps/pos-web/src/core/returns/disposition";
import {
  EXEC_KEY,
  EXEC_KEY_2,
  LINE_1,
  approve,
  cashierAssignments,
  commandBase,
  createRt01Runtime,
  execute,
  ghs,
  preview,
  resolveAggregate,
  resolveRefund,
  staffCookies,
} from "./helpers";
import { handleExecuteReturn } from "../../../apps/pos-web/src/server/returns/handle-execute-return";
import { handlePreviewReturn } from "../../../apps/pos-web/src/server/returns/handle-preview-return";

describe("RT-01 quantities and disposition", () => {
  test("historic allocation uses original totals and remainder on the last chunk", () => {
    expect(
      allocateHistoricMinor({
        historicalTotal: ghs(3000),
        originalSold: 2,
        previouslyReturned: 0,
        requested: 1,
      }),
    ).toBe(1500);
    expect(
      allocateHistoricMinor({
        historicalTotal: ghs(3000),
        originalSold: 2,
        previouslyReturned: 1,
        requested: 1,
      }),
    ).toBe(1500);
    expect(formatNonNegativeQuantity(0)).toBe("0");
  });

  test("conditions map conservatively without inventing tenant policy", () => {
    expect(mapConditionDisposition("resellable")).toEqual({
      intendedDisposition: "restock_sellable",
      dispositionPolicy: "automatic_sellable_restock",
    });
    for (const condition of ["damaged", "quarantine", "not_physically_returned"] as const) {
      expect(mapConditionDisposition(condition)).toEqual({
        intendedDisposition: "no_automatic_restock",
        dispositionPolicy: "mandatory_no_automatic_restock",
      });
    }
    expect(mapConditionDisposition("opened_resellable").intendedDisposition).toBe("no_automatic_restock");
    expect(mapConditionDisposition("defective").dispositionPolicy).toBe("tenant_policy_required");
    expect(stockEffectRequired([{ intendedDisposition: "no_automatic_restock" }])).toBe(false);
  });

  test("Paystack refund adapter never claims success", async () => {
    const provider = createPaystackElectronicRefundProvider();
    const created = await provider.createRefund({
      refundId: "44444444-4444-4444-8444-444444444401",
      paymentId: "22222222-2222-4222-8222-222222222401",
      amount: ghs(1500),
      currency: "GHS",
    });
    expect(created.kind).toBe("requires_attention");
    const resolved = await provider.resolveRefund({ refundId: "44444444-4444-4444-8444-444444444401" });
    expect(resolved.kind).toBe("requires_attention");
  });
});

describe("RT-01 preview", () => {
  test("historic sale preview succeeds and ignores a later catalog price", async () => {
    const runtime = await createRt01Runtime();
    await runtime.checkoutStore.saveQuote({
      id: "quote-current-price",
      fingerprint: "ffffffffffffffffffffffffffffffff",
      cartId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      cartRevision: 9,
      customer: { kind: "walkin" },
      locationId: "loc_a1",
      currency: "GHS",
      lines: [
        {
          lineId: LINE_1,
          productId: "p-hardener",
          quantity: "1",
          unitPrice: ghs(9999),
          subtotal: ghs(9999),
          discount: ghs(0),
          tax: ghs(0),
          total: ghs(9999),
          stockStatus: "in_stock",
          purchasable: true,
          problems: [],
        },
      ],
      subtotal: ghs(9999),
      discount: ghs(0),
      tax: ghs(0),
      total: ghs(9999),
      calculatedAt: "2026-09-15T16:00:00.000Z",
      expiresAt: "2099-01-01T00:00:00.000Z",
      purchasable: true,
    });
    const result = await preview(runtime, { quantity: "1" });
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (!result.body.ok) {
      return;
    }
    expect(result.body.data.refundTotal).toEqual(ghs(1500));
    expect(result.body.data.lines[0]?.intendedDisposition).toBe("restock_sellable");
    expect(result.body.data.fingerprint.length).toBe(64);
  });

  test("unknown sale is not found", async () => {
    const runtime = await createRt01Runtime();
    const result = await preview(runtime, { saleId: "woo-missing" });
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("NOT_FOUND");
    }
  });

  test("cross-tenant sale is not found", async () => {
    const runtime = await createRt01Runtime();
    const foreign = await staffCookies({ actorId: "cashier_b", organizationId: "org_b", locationIds: ["loc_b1"] });
    const result = await preview(runtime, {
      cookieHeader: foreign.cookieHeader,
      sessionStore: foreign.store,
    });
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("NOT_FOUND");
    }
  });

  test("expired preview cannot execute", async () => {
    const runtime = await createRt01Runtime();
    const previewed = await preview(runtime);
    expect(previewed.body.ok).toBe(true);
    if (!previewed.body.ok) {
      return;
    }
    const stored = await runtime.returnStore.getReturn(previewed.body.data.returnId);
    expect(stored).toBeTruthy();
    if (!stored) {
      return;
    }
    stored.previewExpiresAt = "2020-01-01T00:00:00.000Z";
    await runtime.returnStore.saveReturn(stored);
    const executed = await execute(
      runtime,
      { returnId: previewed.body.data.returnId, fingerprint: previewed.body.data.fingerprint },
      EXEC_KEY,
    );
    expect(executed.body.ok).toBe(false);
  });

  test("over-quantity is rejected and partial remaining works", async () => {
    const runtime = await createRt01Runtime();
    const over = await preview(runtime, { quantity: "3" });
    expect(over.body.ok).toBe(false);
    const first = await preview(runtime, { quantity: "1" });
    expect(first.body.ok).toBe(true);
    if (!first.body.ok) {
      return;
    }
    await execute(runtime, { returnId: first.body.data.returnId, fingerprint: first.body.data.fingerprint }, EXEC_KEY);
    const second = await preview(runtime, { quantity: "1" });
    expect(second.body.ok).toBe(true);
    if (second.body.ok) {
      expect(second.body.data.lines[0]?.remainingReturnableQuantity).toBe("1");
    }
    const third = await preview(runtime, { quantity: "2" });
    expect(third.body.ok).toBe(false);
  });

  test("mandatory conditions never restock sellable stock", async () => {
    const runtime = await createRt01Runtime();
    for (const condition of ["damaged", "quarantine", "not_physically_returned"] as const) {
      const result = await preview(runtime, { condition });
      expect(result.body.ok).toBe(true);
      if (result.body.ok) {
        expect(result.body.data.lines[0]?.intendedDisposition).toBe("no_automatic_restock");
      }
    }
  });

  test("client-invented refund fields are impossible", async () => {
    const runtime = await createRt01Runtime();
    const result = await preview(runtime, { extra: { refundTotal: ghs(1) } });
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("RT-01 server-owned approval lookup", () => {
  test("approved return executes the same fingerprint without a browser approval id", async () => {
    const runtime = await createRt01Runtime();
    const previewed = await preview(runtime, { requireApproval: true });
    expect(previewed.body.ok).toBe(true);
    if (!previewed.body.ok) return;

    const approval = await approve(runtime, previewed.body.data.returnId);
    expect(approval.ok).toBe(true);
    if (!approval.ok) return;

    const executed = await execute(
      runtime,
      {
        returnId: previewed.body.data.returnId,
        fingerprint: previewed.body.data.fingerprint,
      },
      "66666666-6666-4666-8666-666666666699",
    );
    expect(executed.body.ok).toBe(true);
    if (!executed.body.ok) return;
    expect(executed.body.data.status).toBe("completed");
  });
});

describe("RT-01 approval", () => {
  test("valid approval binding executes and mismatches fail closed", async () => {
    const runtime = await createRt01Runtime();
    const first = await preview(runtime, { requireApproval: true });
    expect(first.body.ok).toBe(true);
    if (!first.body.ok) {
      return;
    }
    const missing = await execute(
      runtime,
      { returnId: first.body.data.returnId, fingerprint: first.body.data.fingerprint },
      EXEC_KEY,
    );
    expect(missing.body.ok).toBe(false);
    const approval = await approve(runtime, first.body.data.returnId);
    expect(approval.ok).toBe(true);
    if (!approval.ok) {
      return;
    }
    const secondPreview = await preview(runtime, { requireApproval: true, quantity: "1", condition: "damaged" });
    expect(secondPreview.body.ok).toBe(true);
    if (!secondPreview.body.ok) {
      return;
    }
    const wrongReturn = await execute(
      runtime,
      {
        returnId: secondPreview.body.data.returnId,
        fingerprint: secondPreview.body.data.fingerprint,
        approvalId: approval.data.approvalId,
      },
      EXEC_KEY_2,
    );
    expect(wrongReturn.body.ok).toBe(false);
    const wrongFingerprint = await execute(
      runtime,
      {
        returnId: first.body.data.returnId,
        fingerprint: secondPreview.body.data.fingerprint,
        approvalId: approval.data.approvalId,
      },
      "66666666-6666-4666-8666-666666666603",
    );
    expect(wrongFingerprint.body.ok).toBe(false);
    const ok = await execute(
      runtime,
      {
        returnId: first.body.data.returnId,
        fingerprint: first.body.data.fingerprint,
        approvalId: approval.data.approvalId,
      },
      "66666666-6666-4666-8666-666666666604",
    );
    expect(ok.body.ok).toBe(true);
  });

  test("expired approval cannot execute", async () => {
    const runtime = await createRt01Runtime();
    const previewed = await preview(runtime, { requireApproval: true });
    expect(previewed.body.ok).toBe(true);
    if (!previewed.body.ok) {
      return;
    }
    const approval = await approve(runtime, previewed.body.data.returnId, -1);
    expect(approval.ok).toBe(true);
    if (!approval.ok) {
      return;
    }
    const executed = await execute(
      runtime,
      {
        returnId: previewed.body.data.returnId,
        fingerprint: previewed.body.data.fingerprint,
        approvalId: approval.data.approvalId,
      },
      EXEC_KEY,
    );
    expect(executed.body.ok).toBe(false);
  });
});

describe("RT-01 execute, cash, provider, bridge, restart, security", () => {
  test("identical retry replays and changed body conflicts", async () => {
    const runtime = await createRt01Runtime();
    const previewed = await preview(runtime);
    expect(previewed.body.ok).toBe(true);
    if (!previewed.body.ok) {
      return;
    }
    const body = { returnId: previewed.body.data.returnId, fingerprint: previewed.body.data.fingerprint };
    const first = await execute(runtime, body, EXEC_KEY);
    const second = await execute(runtime, body, EXEC_KEY);
    expect(first.body.ok).toBe(true);
    expect(second.body.ok).toBe(true);
    if (first.body.ok && second.body.ok) {
      expect(second.body.data.returnId).toBe(first.body.data.returnId);
      expect(second.body.data.cashRefund).toEqual(first.body.data.cashRefund);
    }
    const other = await preview(runtime);
    expect(other.body.ok).toBe(true);
    if (!other.body.ok) {
      return;
    }
    const conflict = await execute(
      runtime,
      { returnId: other.body.data.returnId, fingerprint: other.body.data.fingerprint },
      EXEC_KEY,
    );
    expect(conflict.body.ok).toBe(false);
    if (!conflict.body.ok) {
      expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
    }
  });

  test("concurrent last-unit execute accepts only one quantity effect", async () => {
    const runtime = await createRt01Runtime({ quantity: "1" });
    const a = await preview(runtime, { quantity: "1" });
    const b = await preview(runtime, { quantity: "1" });
    expect(a.body.ok && b.body.ok).toBe(true);
    if (!a.body.ok || !b.body.ok) {
      return;
    }
    const [left, right] = await Promise.all([
      execute(runtime, { returnId: a.body.data.returnId, fingerprint: a.body.data.fingerprint }, EXEC_KEY),
      execute(runtime, { returnId: b.body.data.returnId, fingerprint: b.body.data.fingerprint }, EXEC_KEY_2),
    ]);
    const successes = [left, right].filter((row) => row.body.ok);
    const failures = [left, right].filter((row) => !row.body.ok);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(await runtime.returnStore.acceptedReturnedQuantity("org_a", "woo-rt01", LINE_1)).toBe(1);
  });

  test("cash refund writes one ledger row and retries do not duplicate it", async () => {
    const runtime = await createRt01Runtime();
    const previewed = await preview(runtime);
    expect(previewed.body.ok).toBe(true);
    if (!previewed.body.ok) {
      return;
    }
    const body = { returnId: previewed.body.data.returnId, fingerprint: previewed.body.data.fingerprint };
    const first = await execute(runtime, body, EXEC_KEY);
    expect(first.body.ok).toBe(true);
    if (!first.body.ok || first.body.data.cashRefund.status === "not_required" || first.body.data.cashRefund.status === "not_started") {
      throw new Error("expected cash refund effect");
    }
    const refundId = first.body.data.cashRefund.effectId;
    await execute(runtime, body, EXEC_KEY);
    const rows = await runtime.checkoutStore.listCashRefunds(refundId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("cash_refund");
    expect(rows[0]?.signedAmount.minor).toBe(-1500);
  });

  test("wrong register assignment is denied", async () => {
    const runtime = await createRt01Runtime();
    const previewed = await preview(runtime);
    expect(previewed.body.ok).toBe(true);
    if (!previewed.body.ok) {
      return;
    }
    const denied = await handleExecuteWithAssignments(runtime, previewed.body.data, ["reg_other"]);
    expect(denied.body.ok).toBe(false);
    if (!denied.body.ok) {
      expect(denied.body.error.code).toBe("FORBIDDEN");
    }
  });

  test("two partial electronic refunds keep separate refundIds and resolve cannot mint another", async () => {
    const runtime = await createRt01Runtime({ tender: "card" });
    runtime.refundProvider.setDefaultCreate("completed");
    const firstPreview = await preview(runtime, { quantity: "1" });
    expect(firstPreview.body.ok).toBe(true);
    if (!firstPreview.body.ok) {
      return;
    }
    const first = await execute(
      runtime,
      { returnId: firstPreview.body.data.returnId, fingerprint: firstPreview.body.data.fingerprint },
      EXEC_KEY,
    );
    expect(first.body.ok).toBe(true);
    if (!first.body.ok || first.body.data.providerRefund.status === "not_required") {
      throw new Error("expected provider refund");
    }
    const r1 = first.body.data.providerRefund.effectId;
    const secondPreview = await preview(runtime, { quantity: "1" });
    expect(secondPreview.body.ok).toBe(true);
    if (!secondPreview.body.ok) {
      return;
    }
    const second = await execute(
      runtime,
      { returnId: secondPreview.body.data.returnId, fingerprint: secondPreview.body.data.fingerprint },
      EXEC_KEY_2,
    );
    expect(second.body.ok).toBe(true);
    if (!second.body.ok || second.body.data.providerRefund.status === "not_required") {
      throw new Error("expected second provider refund");
    }
    const r2 = second.body.data.providerRefund.effectId;
    expect(r1).not.toBe(r2);
    const resolved = await resolveRefund(runtime, r1);
    expect(resolved.body.ok).toBe(true);
    if (resolved.body.ok) {
      expect(resolved.body.data.refundId).toBe(r1);
    }
    expect(runtime.refundProvider.createdIds()).toEqual([r1, r2]);
    expect(await runtime.returnStore.acceptedRefundedMinor(runtime.paymentId)).toBe(3000);
  });

  test("lost provider response preserves refundId and pending does not re-refund", async () => {
    const runtime = await createRt01Runtime({ tender: "card" });
    const previewed = await preview(runtime);
    expect(previewed.body.ok).toBe(true);
    if (!previewed.body.ok) {
      return;
    }
    const pendingId = "will-replace";
    runtime.refundProvider.setDefaultCreate("lost_response");
    const executed = await execute(
      runtime,
      { returnId: previewed.body.data.returnId, fingerprint: previewed.body.data.fingerprint },
      EXEC_KEY,
    );
    expect(executed.body.ok).toBe(true);
    if (!executed.body.ok || executed.body.data.providerRefund.status === "not_required") {
      throw new Error("expected provider refund");
    }
    const refundId = executed.body.data.providerRefund.effectId;
    expect(executed.body.data.providerRefund.status).toBe("pending");
    expect(runtime.refundProvider.createCount).toBe(1);
    runtime.refundProvider.setResolveScript(refundId, "completed");
    const resolved = await resolveAggregate(runtime, previewed.body.data.returnId);
    expect(resolved.body.ok).toBe(true);
    if (resolved.body.ok && resolved.body.data.providerRefund.status !== "not_required") {
      expect(resolved.body.data.providerRefund.effectId).toBe(refundId);
      expect(resolved.body.data.providerRefund.status).toBe("completed");
    }
    expect(runtime.refundProvider.createCount).toBe(1);
    expect(pendingId).not.toBe(refundId);
    runtime.refundProvider.setResolveScript(refundId, "pending");
    const again = await resolveRefund(runtime, refundId);
    expect(again.body.ok).toBe(true);
    if (again.body.ok) {
      expect(again.body.data.status).toBe("verified");
    }
  });

  test("commercial and stock apply once; lost response resolves the same ids; damaged does not restock", async () => {
    const runtime = await createRt01Runtime();
    const restock = await preview(runtime, { condition: "resellable" });
    expect(restock.body.ok).toBe(true);
    if (!restock.body.ok) {
      return;
    }
    runtime.bridge.setDefaultCommercial("lost_response");
    runtime.bridge.setDefaultStock("lost_response");
    const executed = await execute(
      runtime,
      { returnId: restock.body.data.returnId, fingerprint: restock.body.data.fingerprint },
      EXEC_KEY,
    );
    expect(executed.body.ok).toBe(true);
    if (!executed.body.ok) {
      return;
    }
    expect(runtime.bridge.commercialApplyCount).toBe(1);
    expect(runtime.bridge.stockApplyCount).toBe(1);
    const commercialId =
      executed.body.data.commercialRefund.status === "not_required" ||
      executed.body.data.commercialRefund.status === "not_started"
        ? undefined
        : executed.body.data.commercialRefund.effectId;
    const stockId =
      executed.body.data.stockDisposition.status === "not_required" ||
      executed.body.data.stockDisposition.status === "not_started"
        ? undefined
        : executed.body.data.stockDisposition.effectId;
    runtime.bridge.setDefaultCommercial("completed");
    runtime.bridge.setDefaultStock("completed");
    const resolved = await resolveAggregate(runtime, restock.body.data.returnId);
    expect(resolved.body.ok).toBe(true);
    if (resolved.body.ok) {
      expect(resolved.body.data.status).toBe("completed");
      if (resolved.body.data.commercialRefund.status === "completed") {
        expect(resolved.body.data.commercialRefund.effectId).toBe(commercialId);
      }
      if (resolved.body.data.stockDisposition.status === "completed") {
        expect(resolved.body.data.stockDisposition.effectId).toBe(stockId);
      }
    }
    expect(runtime.bridge.commercialApplyCount).toBe(1);
    expect(runtime.bridge.stockApplyCount).toBe(1);

    const damagedRuntime = await createRt01Runtime();
    const damaged = await preview(damagedRuntime, { condition: "damaged" });
    expect(damaged.body.ok).toBe(true);
    if (!damaged.body.ok) {
      return;
    }
    const damagedExec = await execute(
      damagedRuntime,
      { returnId: damaged.body.data.returnId, fingerprint: damaged.body.data.fingerprint },
      EXEC_KEY,
    );
    expect(damagedExec.body.ok).toBe(true);
    if (damagedExec.body.ok) {
      expect(damagedExec.body.data.stockDisposition.status).toBe("not_required");
    }
    expect(damagedRuntime.bridge.stockApplyCount).toBe(0);
  });

  test("mixed outcomes stay truthful and completed requires every required effect", async () => {
    const pendingStock = await createRt01Runtime();
    const previewed = await preview(pendingStock);
    expect(previewed.body.ok).toBe(true);
    if (!previewed.body.ok) {
      return;
    }
    pendingStock.bridge.setDefaultStock("pending");
    const mixed = await execute(
      pendingStock,
      { returnId: previewed.body.data.returnId, fingerprint: previewed.body.data.fingerprint },
      EXEC_KEY,
    );
    expect(mixed.body.ok).toBe(true);
    if (mixed.body.ok) {
      expect(mixed.body.data.status).toBe("in_progress");
      expect(mixed.body.data.cashRefund.status === "completed" || mixed.body.data.cashRefund.status === "not_required").toBe(
        true,
      );
      if (mixed.body.data.stockDisposition.status !== "not_required") {
        expect(mixed.body.data.stockDisposition.status).toBe("pending");
      }
    }

    const attentionMoney = await createRt01Runtime({ tender: "card" });
    attentionMoney.refundProvider.setDefaultCreate("requires_attention");
    const moneyPreview = await preview(attentionMoney);
    expect(moneyPreview.body.ok).toBe(true);
    if (!moneyPreview.body.ok) {
      return;
    }
    const attention = await execute(
      attentionMoney,
      { returnId: moneyPreview.body.data.returnId, fingerprint: moneyPreview.body.data.fingerprint },
      EXEC_KEY,
    );
    expect(attention.body.ok).toBe(true);
    if (attention.body.ok) {
      expect(attention.body.data.status).toBe("requires_attention");
    }
  });

  test("durable recovery after a new orchestrator keeps effect ids", async () => {
    const runtime = await createRt01Runtime({ tender: "card" });
    runtime.refundProvider.setDefaultCreate("pending");
    const previewed = await preview(runtime);
    expect(previewed.body.ok).toBe(true);
    if (!previewed.body.ok) {
      return;
    }
    const executed = await execute(
      runtime,
      { returnId: previewed.body.data.returnId, fingerprint: previewed.body.data.fingerprint },
      EXEC_KEY,
    );
    expect(executed.body.ok).toBe(true);
    if (!executed.body.ok) {
      return;
    }
    const before = executed.body.data;
    runtime.refundProvider.setDefaultCreate("completed");
    runtime.refundProvider.setResolveScript(
      before.providerRefund.status === "not_required" || before.providerRefund.status === "not_started"
        ? "00000000-0000-4000-8000-000000000000"
        : before.providerRefund.effectId,
      "completed",
    );
    const recovered = await resolveAggregate(runtime, previewed.body.data.returnId);
    expect(recovered.body.ok).toBe(true);
    if (!recovered.body.ok) {
      return;
    }
    expect(recovered.body.data.returnId).toBe(before.returnId);
    if (before.providerRefund.status !== "not_required" && recovered.body.data.providerRefund.status !== "not_required") {
      expect(recovered.body.data.providerRefund.effectId).toBe(before.providerRefund.effectId);
    }
    if (before.commercialRefund.status !== "not_required" && recovered.body.data.commercialRefund.status !== "not_required") {
      expect(recovered.body.data.commercialRefund.effectId).toBe(before.commercialRefund.effectId);
    }
  });

  test("anonymous, forged identity, and cashier refund.resolve are denied", async () => {
    const runtime = await createRt01Runtime();
    const anon = await handlePreviewReturnAnon(runtime);
    expect([401, 403]).toContain(anon.status);
    const forged = await preview(runtime, { client: { actorId: "manager_a" } });
    expect(forged.body.ok).toBe(false);
    if (!forged.body.ok) {
      expect(forged.body.error.code).toBe("FORBIDDEN");
    }
    const previewed = await preview(runtime);
    expect(previewed.body.ok).toBe(true);
    if (!previewed.body.ok) {
      return;
    }
    const executed = await execute(
      runtime,
      { returnId: previewed.body.data.returnId, fingerprint: previewed.body.data.fingerprint },
      EXEC_KEY,
    );
    expect(executed.body.ok).toBe(true);
    if (!executed.body.ok || executed.body.data.cashRefund.status === "not_required") {
      return;
    }
    const cashierResolve = await resolveRefund(
      runtime,
      executed.body.data.cashRefund.effectId,
      runtime.sessions.cookieHeader,
      runtime.sessions.store,
    );
    expect(cashierResolve.body.ok).toBe(false);
  });
});

async function handleExecuteWithAssignments(
  runtime: Awaited<ReturnType<typeof createRt01Runtime>>,
  previewData: { readonly returnId: string; readonly fingerprint: string },
  registerIds: readonly string[],
) {
  return handleExecuteReturn({
    ...commandBase(runtime.sessions.cookieHeader),
    assignments: cashierAssignments(registerIds),
    sessionStore: runtime.sessions.store,
    checkoutStore: runtime.checkoutStore,
    returnStore: runtime.returnStore,
    provider: runtime.refundProvider,
    bridge: runtime.bridge,
    idempotencyKeyHeader: EXEC_KEY,
    body: { returnId: previewData.returnId, fingerprint: previewData.fingerprint },
  });
}

async function handlePreviewReturnAnon(runtime: Awaited<ReturnType<typeof createRt01Runtime>>) {
  return handlePreviewReturn({
    ...commandBase(""),
    cookieHeader: "",
    sessionStore: runtime.sessions.store,
    checkoutStore: runtime.checkoutStore,
    returnStore: runtime.returnStore,
    body: {
      saleId: "woo-rt01",
      lines: [{ orderLineId: LINE_1, quantity: "1", reason: "x", condition: "resellable" }],
    },
  });
}

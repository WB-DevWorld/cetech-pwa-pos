import { describe, expect, test, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  ApiResult,
  IndependentEffectSummary,
  ReturnPreview,
  ReturnResolution,
  SettledIndependentEffectSummary,
} from "../../docs/contracts/domain.generated";
import { createReturnController } from "../../apps/pos-web/src/features/returns/returnController";
import { ReturnFlow } from "../../apps/pos-web/src/features/returns/ReturnFlow";
import { presentsAutomaticSellableRestock } from "../../apps/pos-web/src/features/returns/returnView";
import type { HistoricReturnSaleView } from "../../apps/pos-web/src/features/returns/returnView";

const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RETURN_ID = "r1111111-1111-4111-8111-111111111111";
const FINGERPRINT = "fp-return-1";
const REFUND_1 = "rf111111-1111-4111-8111-111111111111";
const REFUND_2 = "rf222222-2222-4222-8222-222222222222";

function success<T>(data: T): ApiResult<T> {
  return { ok: true, data, correlationId: CORRELATION };
}

const sale: HistoricReturnSaleView = {
  saleId: "sale-hist-1",
  orderReference: "POS-2001",
  currency: "GHS",
  lines: [
    { orderLineId: "ol-1", name: "Epoxy Hardener", originalSoldQuantity: "2" },
    { orderLineId: "ol-2", name: "Gloves", originalSoldQuantity: "1" },
  ],
};

function preview(overrides: Partial<ReturnPreview> = {}): ReturnPreview {
  return {
    returnId: RETURN_ID,
    saleId: "sale-hist-1",
    economicsVersion: "eco-1",
    refundTotal: { minor: 1500, currency: "GHS" },
    approvalRequired: false,
    fingerprint: FINGERPRINT,
    expiresAt: "2099-01-01T00:00:00.000Z",
    lines: [
      {
        orderLineId: "ol-1",
        requestedQuantity: "1",
        remainingReturnableQuantity: "1",
        condition: "resellable",
        intendedDisposition: "restock_sellable",
        dispositionPolicy: "automatic_sellable_restock",
      },
    ],
    ...overrides,
  };
}

function settled(status: SettledIndependentEffectSummary["status"], effectId?: string): SettledIndependentEffectSummary {
  if (status === "completed") {
    return { effectId: effectId ?? "eff-1", status: "completed" };
  }
  return { status: "not_required" };
}

function openEffect(status: IndependentEffectSummary["status"], effectId?: string): IndependentEffectSummary {
  if (status === "not_started" || status === "not_required") {
    return { status };
  }
  return { effectId: effectId ?? "eff-open", status };
}

function completedResolution(): ReturnResolution {
  return {
    returnId: RETURN_ID,
    status: "completed",
    providerRefund: settled("completed", REFUND_1),
    cashRefund: settled("not_required"),
    commercialRefund: settled("completed", "cr-1"),
    stockDisposition: settled("completed", "sd-1"),
  };
}

function uuidSequence(values: string[]): () => string {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? values[0]!;
}

async function readyPreview(
  previewImpl: (input: unknown) => Promise<ApiResult<ReturnPreview>>,
) {
  const execute = vi.fn();
  const resolve = vi.fn();
  const controller = createReturnController({
    returns: { preview: previewImpl, execute, resolve },
    createUuid: uuidSequence(["k1", "c1", "k2", "c2"]),
  });
  controller.selectSale(sale);
  controller.updateLine("ol-1", { quantity: "1", reason: "Damaged in transit", condition: "damaged" });
  await controller.preview();
  return { controller, execute, resolve };
}

describe("FE-06 returns", () => {
  test("8 preview displays the authoritative refund total", async () => {
    const previewFn = vi.fn(async () => success(preview({ refundTotal: { minor: 2400, currency: "GHS" } })));
    const { controller } = await readyPreview(previewFn);
    expect(controller.getSession().refundTotal).toEqual({ minor: 2400, currency: "GHS" });
    const html = renderToStaticMarkup(
      createElement(ReturnFlow, {
        session: controller.getSession(),
        inFlight: false,
        onUpdateLine: () => undefined,
        onPreview: () => undefined,
        onExecute: () => undefined,
        onResolve: () => undefined,
      }),
    );
    expect(html).toContain('data-refund-total="2400"');
    expect(html).toContain("GHS 24.00");
  });

  test("9 preview displays authoritative remaining returnable quantity", async () => {
    const previewFn = vi.fn(async () =>
      success(
        preview({
          lines: [
            {
              orderLineId: "ol-1",
              requestedQuantity: "1",
              remainingReturnableQuantity: "3",
              condition: "damaged",
              intendedDisposition: "no_automatic_restock",
              dispositionPolicy: "mandatory_no_automatic_restock",
            },
          ],
        }),
      ),
    );
    const { controller } = await readyPreview(previewFn);
    expect(controller.getSession().previewLines[0]?.remainingReturnableQuantity).toBe("3");
    const html = renderToStaticMarkup(
      createElement(ReturnFlow, {
        session: controller.getSession(),
        inFlight: false,
        onUpdateLine: () => undefined,
        onPreview: () => undefined,
        onExecute: () => undefined,
        onResolve: () => undefined,
      }),
    );
    expect(html).toContain('data-remaining-qty="3"');
  });

  test("10 changing line quantity or condition invalidates a stale preview", async () => {
    const previewFn = vi.fn(async () => success(preview()));
    const { controller } = await readyPreview(previewFn);
    expect(controller.getSession().fingerprint).toBe(FINGERPRINT);
    controller.updateLine("ol-1", { quantity: "2" });
    expect(controller.getSession().fingerprint).toBeUndefined();
    expect(controller.getSession().refundTotal).toBeUndefined();
    expect(controller.getSession().stage).toBe("selecting");
    controller.updateLine("ol-1", { condition: "quarantine" });
    expect(controller.getSession().returnId).toBeUndefined();
  });

  test("11 approval-required does not fabricate approval", async () => {
    const previewFn = vi.fn(async () => success(preview({ approvalRequired: true })));
    const { controller } = await readyPreview(previewFn);
    expect(controller.getSession().approvalRequired).toBe(true);
    expect(controller.getSession().approvalId).toBeUndefined();
    expect(controller.getSession().stage).toBe("approval_required");
    await controller.execute();
    expect(controller.getSession().stage).toBe("approval_required");
    expect(controller.getSession().approvalId).toBeUndefined();
    const html = renderToStaticMarkup(
      createElement(ReturnFlow, {
        session: controller.getSession(),
        inFlight: false,
        onUpdateLine: () => undefined,
        onPreview: () => undefined,
        onExecute: () => undefined,
        onResolve: () => undefined,
      }),
    );
    expect(html).toContain("Do not invent an approval");
    expect(html).toContain('data-approval-id=""');
  });

  test("12 damaged never displays automatic sellable restock", async () => {
    expect(presentsAutomaticSellableRestock("damaged", "restock_sellable", "automatic_sellable_restock")).toBe(false);
    const previewFn = vi.fn(async () =>
      success(
        preview({
          lines: [
            {
              orderLineId: "ol-1",
              requestedQuantity: "1",
              remainingReturnableQuantity: "1",
              condition: "damaged",
              intendedDisposition: "restock_sellable",
              dispositionPolicy: "automatic_sellable_restock",
            },
          ],
        }),
      ),
    );
    const { controller } = await readyPreview(previewFn);
    expect(controller.getSession().previewLines[0]?.automaticSellableRestock).toBe(false);
    const html = renderToStaticMarkup(
      createElement(ReturnFlow, {
        session: controller.getSession(),
        inFlight: false,
        onUpdateLine: () => undefined,
        onPreview: () => undefined,
        onExecute: () => undefined,
        onResolve: () => undefined,
      }),
    );
    expect(html).toContain('data-automatic-sellable="false"');
    expect(html).toContain("never automatically restocked as sellable");
  });

  test("13 quarantine never displays automatic sellable restock", async () => {
    expect(presentsAutomaticSellableRestock("quarantine", "restock_sellable", "automatic_sellable_restock")).toBe(false);
    const previewFn = vi.fn(async () =>
      success(
        preview({
          lines: [
            {
              orderLineId: "ol-1",
              requestedQuantity: "1",
              remainingReturnableQuantity: "1",
              condition: "quarantine",
              intendedDisposition: "restock_sellable",
              dispositionPolicy: "automatic_sellable_restock",
            },
          ],
        }),
      ),
    );
    const { controller } = await readyPreview(previewFn);
    controller.updateLine("ol-1", { condition: "quarantine", quantity: "1", reason: "Hold" });
    await controller.preview();
    expect(controller.getSession().previewLines[0]?.automaticSellableRestock).toBe(false);
  });

  test("14 not-physically-returned never displays automatic sellable restock", async () => {
    expect(
      presentsAutomaticSellableRestock("not_physically_returned", "restock_sellable", "automatic_sellable_restock"),
    ).toBe(false);
  });

  test("15 opened_resellable and defective follow server disposition and policy", async () => {
    const previewFn = vi.fn(async () =>
      success(
        preview({
          lines: [
            {
              orderLineId: "ol-1",
              requestedQuantity: "1",
              remainingReturnableQuantity: "1",
              condition: "opened_resellable",
              intendedDisposition: "no_automatic_restock",
              dispositionPolicy: "tenant_policy_required",
            },
          ],
        }),
      ),
    );
    const { controller } = await readyPreview(previewFn);
    const line = controller.getSession().previewLines[0];
    expect(line?.intendedDisposition).toBe("no_automatic_restock");
    expect(line?.dispositionPolicy).toBe("tenant_policy_required");
    expect(line?.automaticSellableRestock).toBe(false);
    const html = renderToStaticMarkup(
      createElement(ReturnFlow, {
        session: controller.getSession(),
        inFlight: false,
        onUpdateLine: () => undefined,
        onPreview: () => undefined,
        onExecute: () => undefined,
        onResolve: () => undefined,
      }),
    );
    expect(html).toContain("No automatic restock");
    expect(html).toContain("Tenant policy required");
  });

  test("16 execute uses the accepted return identity and fingerprint", async () => {
    const previewFn = vi.fn(async () => success(preview()));
    const { controller, execute } = await readyPreview(previewFn);
    execute.mockResolvedValue(success(completedResolution()));
    await controller.execute();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[0]).toEqual({ returnId: RETURN_ID, fingerprint: FINGERPRINT, approvalId: undefined });
  });

  test("17 ambiguous execute resolves the same returnId", async () => {
    const previewFn = vi.fn(async () => success(preview()));
    const { controller, execute, resolve } = await readyPreview(previewFn);
    execute.mockRejectedValue(new Error("timeout"));
    resolve.mockResolvedValue(success(completedResolution()));
    await controller.execute();
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith(RETURN_ID);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(controller.getSession().returnId).toBe(RETURN_ID);
  });

  test("18 pending independent effects prevent complete presentation", async () => {
    const previewFn = vi.fn(async () => success(preview()));
    const { controller, execute } = await readyPreview(previewFn);
    execute.mockResolvedValue(
      success({
        returnId: RETURN_ID,
        status: "refund_pending",
        providerRefund: openEffect("pending", REFUND_1),
        cashRefund: openEffect("not_required"),
        commercialRefund: openEffect("completed", "cr-1"),
        stockDisposition: openEffect("completed", "sd-1"),
      }),
    );
    await controller.execute();
    expect(controller.getSession().complete).toBe(false);
    expect(controller.getSession().stage).toBe("refund_pending");
    const html = renderToStaticMarkup(
      createElement(ReturnFlow, {
        session: controller.getSession(),
        inFlight: false,
        onUpdateLine: () => undefined,
        onPreview: () => undefined,
        onExecute: () => undefined,
        onResolve: () => undefined,
      }),
    );
    expect(html).toContain('data-return-complete="false"');
    expect(html).not.toContain("data-return-complete-banner");
    expect(html).toContain("Unresolved");
    expect(html).toContain("provider refund");
  });

  test("19 completed aggregate is presented only from authoritative completed resolution", async () => {
    const previewFn = vi.fn(async () => success(preview()));
    const { controller, execute } = await readyPreview(previewFn);
    execute.mockResolvedValue(success(completedResolution()));
    await controller.execute();
    expect(controller.getSession().complete).toBe(true);
    expect(controller.getSession().stage).toBe("completed");
    const html = renderToStaticMarkup(
      createElement(ReturnFlow, {
        session: controller.getSession(),
        inFlight: false,
        onUpdateLine: () => undefined,
        onPreview: () => undefined,
        onExecute: () => undefined,
        onResolve: () => undefined,
      }),
    );
    expect(html).toContain('data-return-complete="true"');
    expect(html).toContain("Return complete.");
  });

  test("20 repeated or partial refund identities remain distinguishable", async () => {
    const previewFn = vi.fn(async () => success(preview()));
    const { controller, execute } = await readyPreview(previewFn);
    execute.mockResolvedValue(
      success({
        returnId: RETURN_ID,
        status: "in_progress",
        providerRefund: openEffect("pending", REFUND_1),
        cashRefund: openEffect("pending", REFUND_2),
        commercialRefund: openEffect("not_started"),
        stockDisposition: openEffect("not_started"),
      }),
    );
    await controller.execute();
    expect(controller.getSession().refundIdentities).toEqual([REFUND_1, REFUND_2]);
    const html = renderToStaticMarkup(
      createElement(ReturnFlow, {
        session: controller.getSession(),
        inFlight: false,
        onUpdateLine: () => undefined,
        onPreview: () => undefined,
        onExecute: () => undefined,
        onResolve: () => undefined,
      }),
    );
    expect(html).toContain(`data-refund-identity="${REFUND_1}"`);
    expect(html).toContain(`data-refund-identity="${REFUND_2}"`);
  });
});

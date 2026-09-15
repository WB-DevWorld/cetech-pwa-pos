import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type {
  BridgeCommercialRefundRequest,
  BridgeStockDispositionRequest,
  HistoricSaleLineEconomics,
  PendingOperation,
  ReturnPreviewRequest,
  ReturnResolution,
  StockDispositionCommandLine,
} from "../../docs/contracts/domain.generated";
import * as ports from "../../docs/contracts/ports";
import { validateCanonicalDef } from "../../apps/pos-web/src/server/quotes/canonical-schema";
import bridgeApi from "../../docs/contracts/bridge-api.openapi.json";
import posApi from "../../docs/contracts/pos-api.openapi.json";
import domainSchema from "../../docs/contracts/pos-domain.schema.json";

const FP = "0123456789abcdef0123456789abcdef";
const TX = "11111111-1111-4111-8111-111111111111";
const PAYMENT = "22222222-2222-4222-8222-222222222222";
const RETURN = "33333333-3333-4333-8333-333333333333";
const REFUND = "44444444-4444-4444-8444-444444444444";
const REFUND_B = "44444444-4444-4444-8444-444444444445";
const COMMERCIAL = "55555555-5555-4555-8555-555555555555";
const STOCK = "66666666-6666-4666-8666-666666666666";
const ACTOR = "cashier-a";
const TS = "2026-09-15T12:00:00.000Z";
const money = { minor: 1500, currency: "GHS" as const };
const zero = { minor: 0, currency: "GHS" as const };

const NO_RESTOCK_CONDITIONS = ["damaged", "quarantine", "not_physically_returned"] as const;

function remainingReturnableAllowed(
  original: string,
  previouslyReturned: string,
  requested: string,
): boolean {
  const cap = Number(original) - Number(previouslyReturned);
  return Number(requested) > 0 && Number(requested) <= cap + 1e-9;
}

const previewRequest: ReturnPreviewRequest = {
  saleId: "sale-1",
  lines: [{ orderLineId: "line-1", quantity: "1", reason: "customer return", condition: "resellable" }],
};

const commercialRequest: BridgeCommercialRefundRequest = {
  commercialRefundId: COMMERCIAL,
  returnId: RETURN,
  transactionId: TX,
  saleId: "sale-1",
  amount: money,
  economicsVersion: "hist-v1",
  fingerprint: FP,
  reason: "customer return",
  lineAllocations: [{ orderLineId: "line-1", quantity: "1", historicAmount: money }],
};

describe("RT-01 return/refund/stock contract freeze", () => {
  test("closed return request types reject client-invented economics and restock fields", () => {
    expect(validateCanonicalDef("ReturnPreviewRequest", previewRequest)).toBe(true);
    expect(validateCanonicalDef("ReturnPreviewRequest", { ...previewRequest, refundAmount: money })).toBe(false);
    expect(validateCanonicalDef("ReturnPreviewRequest", { ...previewRequest, refundTotal: money })).toBe(false);
    expect(validateCanonicalDef("ReturnPreviewRequest", { ...previewRequest, restockQuantity: "1" })).toBe(false);
    expect(validateCanonicalDef("ReturnPreviewRequest", { ...previewRequest, organizationId: "org_a" })).toBe(false);
    expect(
      validateCanonicalDef("ReturnExecuteRequest", {
        returnId: RETURN,
        fingerprint: FP,
        amount: money,
      }),
    ).toBe(false);
    expect(
      validateCanonicalDef("ReturnExecuteRequest", {
        returnId: RETURN,
        fingerprint: FP,
        locationId: "loc_a1",
      }),
    ).toBe(false);
  });

  test("partial return historic economics are representable and the quantity cap is enforceable at the implementation boundary", () => {
    const line: HistoricSaleLineEconomics = {
      orderLineId: "line-1",
      originalSoldQuantity: "2",
      previouslyReturnedQuantity: "1",
      remainingReturnableQuantity: "1",
      historicalSubtotal: money,
      historicalDiscount: zero,
      historicalTax: zero,
      historicalTotal: money,
    };
    expect(validateCanonicalDef("HistoricSaleLineEconomics", line)).toBe(true);
    expect(remainingReturnableAllowed(line.originalSoldQuantity, line.previouslyReturnedQuantity, "1")).toBe(true);
    expect(remainingReturnableAllowed(line.originalSoldQuantity, line.previouslyReturnedQuantity, "2")).toBe(false);
    expect(validateCanonicalDef("NonNegativeQuantity", "0")).toBe(true);
    expect(validateCanonicalDef("Quantity", "0")).toBe(false);
  });

  test("commercial refund has a stable effect identity, replay shape, conflict extras, and resolve state", () => {
    expect(validateCanonicalDef("BridgeCommercialRefundRequest", commercialRequest)).toBe(true);
    expect(commercialRequest.commercialRefundId).toMatch(/^[0-9a-f-]{36}$/);
    expect(
      validateCanonicalDef("BridgeCommercialRefundRequest", { ...commercialRequest, currentCatalogPrice: money }),
    ).toBe(false);
    expect(
      validateCanonicalDef("BridgeCommercialRefundState", {
        commercialRefundId: COMMERCIAL,
        returnId: RETURN,
        transactionId: TX,
        saleId: "sale-1",
        status: "pending",
        amount: money,
        economicsVersion: "hist-v1",
      }),
    ).toBe(true);
    expect(
      validateCanonicalDef("BridgeCommercialRefundState", {
        commercialRefundId: COMMERCIAL,
        returnId: RETURN,
        transactionId: TX,
        saleId: "sale-1",
        status: "completed",
        amount: money,
        economicsVersion: "hist-v1",
      }),
    ).toBe(true);
    expect(
      validateCanonicalDef("BridgeCommercialRefundState", {
        commercialRefundId: COMMERCIAL,
        returnId: RETURN,
        transactionId: TX,
        saleId: "sale-1",
        status: "not_found",
        amount: zero,
        economicsVersion: "hist-v1",
      }),
    ).toBe(true);
  });

  test("stock disposition identity is independent of commercial refund and no-restock is valid", () => {
    expect(COMMERCIAL).not.toBe(STOCK);
    const restock: BridgeStockDispositionRequest = {
      stockDispositionId: STOCK,
      returnId: RETURN,
      transactionId: TX,
      saleId: "sale-1",
      economicsVersion: "hist-v1",
      fingerprint: FP,
      lines: [{ orderLineId: "line-1", quantity: "1", condition: "resellable", disposition: "restock_sellable" }],
    };
    const hold: BridgeStockDispositionRequest = {
      ...restock,
      lines: [{ orderLineId: "line-1", quantity: "1", condition: "resellable", disposition: "no_automatic_restock" }],
    };
    expect(validateCanonicalDef("BridgeStockDispositionRequest", restock)).toBe(true);
    expect(validateCanonicalDef("BridgeStockDispositionRequest", hold)).toBe(true);
    expect(restock.stockDispositionId).not.toBe(commercialRequest.commercialRefundId);
  });

  test.each(NO_RESTOCK_CONDITIONS)("%s cannot request automatic sellable restock", (condition) => {
    const illegal = {
      orderLineId: "line-1",
      quantity: "1",
      condition,
      disposition: "restock_sellable",
    };
    const legal: StockDispositionCommandLine = {
      orderLineId: "line-1",
      quantity: "1",
      condition,
      disposition: "no_automatic_restock",
    };
    expect(validateCanonicalDef("StockDispositionCommandLine", illegal)).toBe(false);
    expect(validateCanonicalDef("StockDispositionCommandLine", legal)).toBe(true);
  });

  test("opened_resellable and defective stay tenant-policy-required rather than a guessed restock", () => {
    expect(
      (domainSchema as { $defs: { ReturnConditionStockPolicy: { enum: string[] } } }).$defs.ReturnConditionStockPolicy
        .enum,
    ).toContain("tenant_policy_required");
    const previewLine = {
      orderLineId: "line-1",
      requestedQuantity: "1",
      remainingReturnableQuantity: "1",
      condition: "defective",
      intendedDisposition: "no_automatic_restock",
      dispositionPolicy: "tenant_policy_required",
    };
    expect(validateCanonicalDef("ReturnPreviewLine", previewLine)).toBe(true);
  });

  test("money complete / stock pending and stock complete / money attention are representable", () => {
    const moneyDoneStockPending: ReturnResolution = {
      returnId: RETURN,
      status: "in_progress",
      providerRefund: { effectId: REFUND, status: "completed" },
      cashRefund: { status: "not_required" },
      commercialRefund: { effectId: COMMERCIAL, status: "completed" },
      stockDisposition: { effectId: STOCK, status: "pending" },
    };
    const stockDoneMoneyAttention: ReturnResolution = {
      returnId: RETURN,
      status: "requires_attention",
      providerRefund: { effectId: REFUND, status: "requires_attention" },
      cashRefund: { status: "not_required" },
      commercialRefund: { effectId: COMMERCIAL, status: "completed" },
      stockDisposition: { effectId: STOCK, status: "completed" },
    };
    expect(validateCanonicalDef("ReturnResolution", moneyDoneStockPending)).toBe(true);
    expect(validateCanonicalDef("ReturnResolution", stockDoneMoneyAttention)).toBe(true);
  });

  test("global completed cannot lie about unresolved required effects; no-restock does not block", () => {
    const lying = {
      returnId: RETURN,
      status: "completed",
      providerRefund: { effectId: REFUND, status: "completed" },
      cashRefund: { status: "not_required" },
      commercialRefund: { effectId: COMMERCIAL, status: "completed" },
      stockDisposition: { effectId: STOCK, status: "pending" },
    };
    const honestNoRestock: ReturnResolution = {
      returnId: RETURN,
      status: "completed",
      providerRefund: { effectId: REFUND, status: "completed" },
      cashRefund: { status: "not_required" },
      commercialRefund: { effectId: COMMERCIAL, status: "completed" },
      stockDisposition: { status: "not_required" },
    };
    const allCompleted: ReturnResolution = {
      returnId: RETURN,
      status: "completed",
      providerRefund: { effectId: REFUND, status: "completed" },
      cashRefund: { status: "not_required" },
      commercialRefund: { effectId: COMMERCIAL, status: "completed" },
      stockDisposition: { effectId: STOCK, status: "completed" },
    };
    expect(validateCanonicalDef("ReturnResolution", lying)).toBe(false);
    expect(validateCanonicalDef("ReturnResolution", honestNoRestock)).toBe(true);
    expect(validateCanonicalDef("ReturnResolution", allCompleted)).toBe(true);
  });

  test("authorization identity stays on the session, not return request fields", () => {
    expect(domainSchema.$defs.CommandContext.properties).toEqual({
      idempotencyKey: { $ref: "#/$defs/Uuid" },
      correlationId: { $ref: "#/$defs/Uuid" },
    });
    expect(domainSchema.$defs.ReturnPreviewRequest.additionalProperties).toBe(false);
    expect(domainSchema.$defs.ReturnExecuteRequest.additionalProperties).toBe(false);
    expect(domainSchema.$defs.Session.properties.organizationId).toBeDefined();
    expect(domainSchema.$defs.ReturnPreviewRequest.properties.organizationId).toBeUndefined();
    expect(domainSchema.$defs.ReturnPreviewRequest.properties.locationId).toBeUndefined();
  });

  test("journal operations distinguish return, provider refund, commercial refund, stock, and resolve", () => {
    const operations = domainSchema.$defs.PendingOperation.properties.operation.enum as PendingOperation["operation"][];
    expect(operations).toEqual(
      expect.arrayContaining([
        "return.execute",
        "return.resolve",
        "payment.refund",
        "refund.resolve",
        "bridge.commercial_refund",
        "bridge.stock_disposition",
        "sale.prepare",
        "sale.finalize",
        "payment.cash",
      ]),
    );
    expect(new Set(operations).size).toBe(operations.length);
  });

  test("bridge OpenAPI exposes trusted commercial-refund and stock-disposition execute/resolve wires", () => {
    const paths = bridgeApi.paths as Record<string, { post?: { operationId: string; parameters?: { name: string }[] }; get?: { operationId: string; parameters?: { name: string }[] } }>;
    expect(paths["/returns/preview"]?.post?.operationId).toBe("bridgeReturnPreview");
    expect(paths["/returns/commercial-refund"]?.post?.operationId).toBe("executeReturnCommercialRefund");
    expect(paths["/returns/commercial-refund/{commercialRefundId}"]?.get?.operationId).toBe(
      "resolveReturnCommercialRefund",
    );
    expect(paths["/returns/stock-disposition"]?.post?.operationId).toBe("executeReturnStockDisposition");
    expect(paths["/returns/stock-disposition/{stockDispositionId}"]?.get?.operationId).toBe(
      "resolveReturnStockDisposition",
    );
    const refundParams = new Set((paths["/returns/commercial-refund"]?.post?.parameters ?? []).map((p) => p.name));
    const stockParams = new Set((paths["/returns/stock-disposition"]?.post?.parameters ?? []).map((p) => p.name));
    expect(refundParams.has("X-Correlation-ID")).toBe(true);
    expect(refundParams.has("Idempotency-Key")).toBe(true);
    expect(stockParams.has("Idempotency-Key")).toBe(true);
    expect(paths["/returns/commercial-refund/{commercialRefundId}"]?.get?.parameters?.some((p) => p.name === "Idempotency-Key")).toBe(
      false,
    );
  });

  test("POS OpenAPI stays intent-oriented and does not expose bridge-only refund/stock commands", () => {
    const posPaths = Object.keys(posApi.paths);
    expect(posPaths).toEqual(expect.arrayContaining(["/returns/preview", "/returns/execute", "/returns/{returnId}"]));
    expect(posPaths.some((path) => path.includes("commercial-refund"))).toBe(false);
    expect(posPaths.some((path) => path.includes("stock-disposition"))).toBe(false);
    expect(JSON.stringify(posApi)).not.toContain("RefundLookup");
    expect(JSON.stringify(posApi)).not.toContain("resolveRefund");
    expect(JSON.stringify(bridgeApi)).not.toContain("RefundLookup");
    expect(JSON.stringify(bridgeApi)).not.toContain("resolveRefund");
    const executeBody = posApi.paths["/returns/execute"].post.requestBody.content["application/json"].schema.$ref;
    expect(executeBody).toBe("./pos-domain.schema.json#/$defs/ReturnExecuteRequest");
  });

  test("ports keep ReturnPort, PaymentPort.refund, PaymentPort.resolveRefund, and server-only BridgeReturnEffectsPort separate", () => {
    expect(typeof ports).toBe("object");
    const source = readFileSync(new URL("../../docs/contracts/ports.ts", import.meta.url), "utf8");
    expect(source).toContain("export interface ReturnPort");
    expect(source).toContain("export interface BridgeReturnEffectsPort");
    expect(source).toContain("applyCommercialRefund");
    expect(source).toContain("applyStockDisposition");
    expect(source).toMatch(
      /refund\(input: D\.RefundRequest, context: D\.CommandContext\): Promise<ApiResult<D\.RefundState>>/,
    );
    expect(source).toMatch(/resolveRefund\(input: D\.RefundLookup\): Promise<ApiResult<D\.RefundState>>/);
    expect(source).toMatch(/Journal: refund\.resolve/);
    expect(source).not.toMatch(/resolveRefund\([^)]*CommandContext/);
    expect(source).toMatch(/resolve\(input: D\.PaymentLookup\): Promise<ApiResult<D\.PaymentState>>/);
    expect(source).not.toMatch(/Paystack|Stripe|WooCommerce|MoMo/);
    expect(source).not.toContain("applyCommercialRefund(input: D.ReturnExecuteRequest");
    expect(source).not.toContain("PaystackRefundLookup");
    expect(source).not.toContain("WooRefundLookup");
  });

  test("cash and provider refund channels are distinct from commercial refund", () => {
    expect(
      validateCanonicalDef("RefundRequest", {
        refundId: REFUND,
        returnId: RETURN,
        paymentId: PAYMENT,
        transactionId: TX,
        channel: "cash_ledger",
        amount: money,
      }),
    ).toBe(true);
    expect(
      validateCanonicalDef("RefundRequest", {
        refundId: REFUND,
        returnId: RETURN,
        paymentId: PAYMENT,
        transactionId: TX,
        channel: "provider_electronic",
        amount: money,
      }),
    ).toBe(true);
    expect(validateCanonicalDef("RefundRequest", { refundId: REFUND, paymentId: PAYMENT, transactionId: TX, amount: money })).toBe(
      false,
    );
  });

  test("RefundLookup is closed refundId-only and does not collapse by paymentId", () => {
    expect(validateCanonicalDef("RefundLookup", { refundId: REFUND })).toBe(true);
    expect(validateCanonicalDef("RefundLookup", { refundId: REFUND_B })).toBe(true);
    expect(validateCanonicalDef("RefundLookup", { refundId: REFUND, amount: { minor: 500, currency: "GHS" } })).toBe(
      false,
    );
    expect(validateCanonicalDef("RefundLookup", { refundId: REFUND, currency: "GHS" })).toBe(false);
    expect(validateCanonicalDef("RefundLookup", { refundId: REFUND, paymentId: PAYMENT })).toBe(false);
    expect(validateCanonicalDef("RefundLookup", { refundId: REFUND, providerReference: "pay_ref_1" })).toBe(false);
    expect(validateCanonicalDef("RefundLookup", { refundId: REFUND, provider: "paystack" })).toBe(false);
    expect(validateCanonicalDef("RefundLookup", { refundId: REFUND, status: "verified" })).toBe(false);
    expect(validateCanonicalDef("RefundLookup", { refundId: REFUND, idempotencyKey: REFUND_B })).toBe(false);
    expect(validateCanonicalDef("RefundLookup", { refundId: REFUND, organizationId: "org_a" })).toBe(false);
    expect(validateCanonicalDef("RefundLookup", { refundId: REFUND, locationId: "loc_a1" })).toBe(false);
    expect(validateCanonicalDef("RefundLookup", { refundId: REFUND, newRefundId: REFUND_B })).toBe(false);
    expect(validateCanonicalDef("RefundLookup", { paymentId: PAYMENT })).toBe(false);
    expect(domainSchema.$defs.RefundLookup.required).toEqual(["refundId"]);
    expect(domainSchema.$defs.RefundLookup.additionalProperties).toBe(false);
    expect(Object.keys(domainSchema.$defs.RefundLookup.properties)).toEqual(["refundId"]);
  });

  test("two partial refunds on one payment keep distinct refundIds; lookup of R1 cannot mean R2", () => {
    const first = {
      refundId: REFUND,
      returnId: RETURN,
      paymentId: PAYMENT,
      transactionId: TX,
      channel: "provider_electronic" as const,
      amount: { minor: 500, currency: "GHS" as const },
    };
    const second = {
      refundId: REFUND_B,
      returnId: RETURN,
      paymentId: PAYMENT,
      transactionId: TX,
      channel: "provider_electronic" as const,
      amount: { minor: 300, currency: "GHS" as const },
    };
    expect(first.paymentId).toBe(second.paymentId);
    expect(first.transactionId).toBe(second.transactionId);
    expect(first.refundId).not.toBe(second.refundId);
    expect(validateCanonicalDef("RefundRequest", first)).toBe(true);
    expect(validateCanonicalDef("RefundRequest", second)).toBe(true);
    const stateR1 = {
      refundId: REFUND,
      returnId: RETURN,
      channel: "provider_electronic",
      status: "verified",
      amount: first.amount,
    };
    const stateR2 = {
      refundId: REFUND_B,
      returnId: RETURN,
      channel: "provider_electronic",
      status: "pending",
      amount: second.amount,
    };
    expect(validateCanonicalDef("RefundState", stateR1)).toBe(true);
    expect(validateCanonicalDef("RefundState", stateR2)).toBe(true);
    expect(validateCanonicalDef("RefundLookup", { refundId: REFUND })).toBe(true);
    expect(validateCanonicalDef("RefundLookup", { refundId: REFUND_B })).toBe(true);
    expect(stateR1.refundId).not.toBe(stateR2.refundId);
    expect(domainSchema.$defs.PaymentLookup.properties.paymentId).toBeDefined();
    expect(domainSchema.$defs.RefundLookup.properties.paymentId).toBeUndefined();
    expect(domainSchema.$defs.RefundLookup.properties.transactionId).toBeUndefined();
  });

  test("unknown payment.refund result resolves the same refundId and does not mint a replacement", () => {
    const source = readFileSync(new URL("../../docs/contracts/ports.ts", import.meta.url), "utf8");
    const operations = domainSchema.$defs.PendingOperation.properties.operation.enum as PendingOperation["operation"][];
    expect(operations).toContain("payment.refund");
    expect(operations).toContain("refund.resolve");
    expect(source).toMatch(/refund\(input: D\.RefundRequest, context: D\.CommandContext\)/);
    expect(source).toMatch(/resolveRefund\(input: D\.RefundLookup\): Promise<ApiResult<D\.RefundState>>/);
    expect(source).toMatch(/Journal: refund\.resolve/);
    expect(source).not.toMatch(/resolveRefund\([^)]*CommandContext/);
    expect(source).not.toMatch(/resolveRefund\([^)]*Idempotency/);
    expect(validateCanonicalDef("RefundLookup", { refundId: REFUND })).toBe(true);
    expect(validateCanonicalDef("RefundLookup", { refundId: REFUND, newRefundId: REFUND_B })).toBe(false);
    expect(
      validateCanonicalDef("PendingOperation", {
        id: "88888888-8888-4888-8888-888888888888",
        transactionId: TX,
        operation: "refund.resolve",
        idempotencyKey: "99999999-9999-4999-8999-999999999999",
        requestHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        payloadVersion: "1.0.0",
        status: "response_unknown",
        attempts: 1,
        createdAt: TS,
      }),
    ).toBe(true);
  });

  test("allocated independent effects require effectId; unallocated statuses may omit it", () => {
    expect(validateCanonicalDef("IndependentEffectSummary", { status: "not_required" })).toBe(true);
    expect(validateCanonicalDef("IndependentEffectSummary", { status: "not_started" })).toBe(true);
    expect(validateCanonicalDef("IndependentEffectSummary", { effectId: REFUND, status: "not_started" })).toBe(true);
    expect(validateCanonicalDef("IndependentEffectSummary", { status: "pending" })).toBe(false);
    expect(validateCanonicalDef("IndependentEffectSummary", { status: "not_found" })).toBe(false);
    expect(validateCanonicalDef("IndependentEffectSummary", { status: "completed" })).toBe(false);
    expect(validateCanonicalDef("IndependentEffectSummary", { status: "requires_attention" })).toBe(false);
    expect(validateCanonicalDef("IndependentEffectSummary", { effectId: REFUND, status: "pending" })).toBe(true);
    expect(validateCanonicalDef("IndependentEffectSummary", { effectId: REFUND, status: "not_found" })).toBe(true);
    expect(validateCanonicalDef("IndependentEffectSummary", { effectId: REFUND, status: "completed" })).toBe(true);
    expect(validateCanonicalDef("IndependentEffectSummary", { effectId: REFUND, status: "requires_attention" })).toBe(
      true,
    );
    expect(validateCanonicalDef("SettledIndependentEffectSummary", { status: "not_required" })).toBe(true);
    expect(validateCanonicalDef("SettledIndependentEffectSummary", { status: "completed" })).toBe(false);
    expect(validateCanonicalDef("SettledIndependentEffectSummary", { effectId: REFUND, status: "completed" })).toBe(
      true,
    );
    expect(validateCanonicalDef("SettledIndependentEffectSummary", { status: "pending" })).toBe(false);
  });

  test("completed ReturnResolution still requires settled effects and completed effectIds", () => {
    const completedMissingEffectId = {
      returnId: RETURN,
      status: "completed",
      providerRefund: { status: "completed" },
      cashRefund: { status: "not_required" },
      commercialRefund: { effectId: COMMERCIAL, status: "completed" },
      stockDisposition: { status: "not_required" },
    };
    const completedSettled = {
      returnId: RETURN,
      status: "completed",
      providerRefund: { effectId: REFUND, status: "completed" },
      cashRefund: { status: "not_required" },
      commercialRefund: { effectId: COMMERCIAL, status: "completed" },
      stockDisposition: { effectId: STOCK, status: "completed" },
    };
    const completedUnresolved = {
      returnId: RETURN,
      status: "completed",
      providerRefund: { effectId: REFUND, status: "completed" },
      cashRefund: { status: "not_required" },
      commercialRefund: { effectId: COMMERCIAL, status: "completed" },
      stockDisposition: { effectId: STOCK, status: "pending" },
    };
    expect(validateCanonicalDef("ReturnResolution", completedMissingEffectId)).toBe(false);
    expect(validateCanonicalDef("ReturnResolution", completedSettled)).toBe(true);
    expect(validateCanonicalDef("ReturnResolution", completedUnresolved)).toBe(false);
  });

  test("approval binding covers preview fingerprint, actor, and return identity", () => {
    expect(
      validateCanonicalDef("ReturnApprovalBinding", {
        approvalId: "77777777-7777-4777-8777-777777777777",
        returnId: RETURN,
        fingerprint: FP,
        actorId: ACTOR,
        expiresAt: TS,
      }),
    ).toBe(true);
    expect(
      validateCanonicalDef("ReturnApprovalBinding", {
        approvalId: "77777777-7777-4777-8777-777777777777",
        returnId: RETURN,
        fingerprint: FP,
        actorId: ACTOR,
        expiresAt: TS,
        organizationId: "org_a",
      }),
    ).toBe(false);
  });
});

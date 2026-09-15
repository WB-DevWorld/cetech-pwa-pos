import type { ApiResult, BridgeReturnEffectsPort } from "../../../../../docs/contracts/ports";
import type {
  BridgeCommercialRefundState,
  BridgeStockDispositionState,
  IndependentEffectStatus,
  ReturnPreview,
  Uuid,
} from "../../../../../docs/contracts/domain.generated";
import { apiFailure } from "../http/api-failure";

export type FakeBridgeEffectScript =
  | "completed"
  | "pending"
  | "not_found"
  | "requires_attention"
  | "timeout"
  | "lost_response";

export type FakeBridgeReturnEffects = BridgeReturnEffectsPort & {
  commercialApplyCount: number;
  commercialResolveCount: number;
  stockApplyCount: number;
  stockResolveCount: number;
  setCommercialScript(id: Uuid, script: FakeBridgeEffectScript): void;
  setStockScript(id: Uuid, script: FakeBridgeEffectScript): void;
  setDefaultCommercial(script: FakeBridgeEffectScript): void;
  setDefaultStock(script: FakeBridgeEffectScript): void;
};

export function createFakeBridgeReturnEffects(correlationId: Uuid): FakeBridgeReturnEffects {
  const commercial = new Map<Uuid, FakeBridgeEffectScript>();
  const stock = new Map<Uuid, FakeBridgeEffectScript>();
  const commercialSeen = new Map<Uuid, BridgeCommercialRefundState>();
  const stockSeen = new Map<Uuid, BridgeStockDispositionState>();
  let defaultCommercial: FakeBridgeEffectScript = "completed";
  let defaultStock: FakeBridgeEffectScript = "completed";

  const port: FakeBridgeReturnEffects = {
    commercialApplyCount: 0,
    commercialResolveCount: 0,
    stockApplyCount: 0,
    stockResolveCount: 0,
    setCommercialScript(id, script) {
      commercial.set(id, script);
    },
    setStockScript(id, script) {
      stock.set(id, script);
    },
    setDefaultCommercial(script) {
      defaultCommercial = script;
    },
    setDefaultStock(script) {
      defaultStock = script;
    },
    async preview(): Promise<ApiResult<ReturnPreview>> {
      return apiFailure("UNSUPPORTED_VERSION", "WS3 fake bridge does not preview returns", correlationId);
    },
    async applyCommercialRefund(input, context) {
      port.commercialApplyCount += 1;
      const existing = commercialSeen.get(input.commercialRefundId);
      if (existing) {
        return { ok: true, data: existing, correlationId: context.correlationId };
      }
      const script = commercial.get(input.commercialRefundId) ?? defaultCommercial;
      if (script === "timeout" || script === "lost_response") {
        return apiFailure(
          "INTEGRATION_UNAVAILABLE",
          "commercial refund result is unknown",
          context.correlationId,
        );
      }
      const state = commercialState(input, script);
      commercialSeen.set(input.commercialRefundId, state);
      return { ok: true, data: state, correlationId: context.correlationId };
    },
    async resolveCommercialRefund(commercialRefundId) {
      port.commercialResolveCount += 1;
      const existing = commercialSeen.get(commercialRefundId);
      const script = commercial.get(commercialRefundId) ?? defaultCommercial;
      if (script === "timeout") {
        return apiFailure("INTEGRATION_UNAVAILABLE", "commercial refund resolve timed out", correlationId);
      }
      if (existing && (script === "lost_response" || script === "completed" || script === "pending")) {
        const resolved =
          script === "pending"
            ? existing
            : { ...existing, status: "completed" as const };
        commercialSeen.set(commercialRefundId, resolved);
        return { ok: true, data: resolved, correlationId };
      }
      if (!existing && script === "not_found") {
        return apiFailure("NOT_FOUND", "commercial refund was not found", correlationId);
      }
      const state: BridgeCommercialRefundState = existing
        ? { ...existing, status: statusFor(script) }
        : {
            commercialRefundId,
            returnId: "00000000-0000-4000-8000-000000000000",
            transactionId: "00000000-0000-4000-8000-000000000000",
            saleId: "unknown",
            status: statusFor(script),
            amount: { minor: 0, currency: "GHS" },
            economicsVersion: "unknown",
          };
      commercialSeen.set(commercialRefundId, state);
      return { ok: true, data: state, correlationId };
    },
    async applyStockDisposition(input, context) {
      port.stockApplyCount += 1;
      const existing = stockSeen.get(input.stockDispositionId);
      if (existing) {
        return { ok: true, data: existing, correlationId: context.correlationId };
      }
      const script = stock.get(input.stockDispositionId) ?? defaultStock;
      if (script === "timeout" || script === "lost_response") {
        return apiFailure(
          "INTEGRATION_UNAVAILABLE",
          "stock disposition result is unknown",
          context.correlationId,
        );
      }
      const invalid = input.lines.some((line) => line.disposition === "restock_sellable" && line.condition !== "resellable");
      if (invalid) {
        return apiFailure("VALIDATION_ERROR", "mandatory conditions cannot restock sellable stock", context.correlationId);
      }
      const state = stockState(input, script);
      stockSeen.set(input.stockDispositionId, state);
      return { ok: true, data: state, correlationId: context.correlationId };
    },
    async resolveStockDisposition(stockDispositionId) {
      port.stockResolveCount += 1;
      const existing = stockSeen.get(stockDispositionId);
      const script = stock.get(stockDispositionId) ?? defaultStock;
      if (script === "timeout") {
        return apiFailure("INTEGRATION_UNAVAILABLE", "stock disposition resolve timed out", correlationId);
      }
      if (existing && (script === "lost_response" || script === "completed" || script === "pending")) {
        const resolved =
          script === "pending" ? existing : { ...existing, status: "completed" as const };
        stockSeen.set(stockDispositionId, resolved);
        return { ok: true, data: resolved, correlationId };
      }
      if (!existing && script === "not_found") {
        return apiFailure("NOT_FOUND", "stock disposition was not found", correlationId);
      }
      const state: BridgeStockDispositionState = existing
        ? { ...existing, status: statusFor(script) }
        : {
            stockDispositionId,
            returnId: "00000000-0000-4000-8000-000000000000",
            transactionId: "00000000-0000-4000-8000-000000000000",
            saleId: "unknown",
            status: statusFor(script),
            economicsVersion: "unknown",
          };
      stockSeen.set(stockDispositionId, state);
      return { ok: true, data: state, correlationId };
    },
  };
  return port;
}

function statusFor(script: FakeBridgeEffectScript): IndependentEffectStatus {
  if (script === "pending") {
    return "pending";
  }
  if (script === "not_found") {
    return "not_found";
  }
  if (script === "requires_attention") {
    return "requires_attention";
  }
  return "completed";
}

function commercialState(
  input: {
    readonly commercialRefundId: Uuid;
    readonly returnId: Uuid;
    readonly transactionId: Uuid;
    readonly saleId: string;
    readonly amount: { readonly minor: number; readonly currency: string };
    readonly economicsVersion: string;
  },
  script: FakeBridgeEffectScript,
): BridgeCommercialRefundState {
  return {
    commercialRefundId: input.commercialRefundId,
    returnId: input.returnId,
    transactionId: input.transactionId,
    saleId: input.saleId,
    status: statusFor(script),
    amount: input.amount,
    economicsVersion: input.economicsVersion,
  };
}

function stockState(
  input: {
    readonly stockDispositionId: Uuid;
    readonly returnId: Uuid;
    readonly transactionId: Uuid;
    readonly saleId: string;
    readonly economicsVersion: string;
  },
  script: FakeBridgeEffectScript,
): BridgeStockDispositionState {
  return {
    stockDispositionId: input.stockDispositionId,
    returnId: input.returnId,
    transactionId: input.transactionId,
    saleId: input.saleId,
    status: statusFor(script),
    economicsVersion: input.economicsVersion,
  };
}

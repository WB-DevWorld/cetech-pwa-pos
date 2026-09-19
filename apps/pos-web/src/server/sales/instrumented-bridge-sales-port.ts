import type { ApiResult, SalesPort } from "../../../../../docs/contracts/ports";
import type {
  BridgeFinalizeRequest,
  CancelSaleRequest,
  CommandContext,
  PreparedSale,
  PrepareSaleRequest,
  Quote,
  SaleResolution,
} from "../../../../../docs/contracts/domain.generated";
import { canonicalJson, sha256Hex } from "../../local/canonical";
import { apiFailure } from "../http/api-failure";
import { toIsoTimestamp } from "../auth/ids";

type PreparedRow = {
  readonly requestHash: string;
  readonly prepareKey: string;
  readonly prepared: PreparedSale;
};

/**
 * Contract-faithful commercial double for CORE-06 combined proof.
 * Counts Woo order creates, reservation, payment_complete and stock effects.
 * Does not copy WoodMart/B2BKing pricing; totals come from the stored quote snapshot.
 */
export type InstrumentedBridgeSalesPort = Pick<SalesPort, "prepare" | "resolve" | "confirmPayment" | "cancel"> & {
  wooOrderCount: number;
  stockReserveCount: number;
  paymentCompleteCount: number;
  stockEffectCount: number;
  cancelCount: number;
  dropNextPrepareResponse: boolean;
  dropNextFinalizeResponse: boolean;
  dropNextCancelResponse: boolean;
  readonly quotes: Map<string, Quote>;
  seedPrepared(sale: PreparedSale): void;
};

export function createInstrumentedBridgeSalesPort(
  quotes: ReadonlyArray<Quote> = [],
  now: Date = new Date("2026-09-15T12:00:00.000Z"),
): InstrumentedBridgeSalesPort {
  const quoteById = new Map(quotes.map((quote) => [quote.id, quote]));
  const prepared = new Map<string, PreparedRow>();
  const prepareByKey = new Map<string, PreparedRow>();
  const finalized = new Map<string, SaleResolution>();
  const finalizeByKey = new Map<string, { hash: string; resolution: SaleResolution }>();
  const cancelled = new Map<string, SaleResolution>();
  const cancelByKey = new Map<string, { hash: string; resolution: SaleResolution }>();

  const port: InstrumentedBridgeSalesPort = {
    wooOrderCount: 0,
    stockReserveCount: 0,
    paymentCompleteCount: 0,
    stockEffectCount: 0,
    cancelCount: 0,
    dropNextPrepareResponse: false,
    dropNextFinalizeResponse: false,
    dropNextCancelResponse: false,
    quotes: quoteById,
    seedPrepared(sale: PreparedSale) {
      prepared.set(sale.transactionId, {
        requestHash: "seeded-for-electronic-finalize",
        prepareKey: "seeded-for-electronic-finalize",
        prepared: sale,
      });
    },
    async prepare(input: PrepareSaleRequest, context: CommandContext): Promise<ApiResult<PreparedSale>> {
      const hash = await sha256Hex(canonicalJson(input));
      const keyed = prepareByKey.get(context.idempotencyKey);
      if (keyed && keyed.requestHash !== hash) {
        return apiFailure(
          "IDEMPOTENCY_CONFLICT",
          "Idempotency-Key was reused with a different PrepareSaleRequest",
          context.correlationId,
        );
      }
      if (keyed) {
        if (port.dropNextPrepareResponse) {
          port.dropNextPrepareResponse = false;
          throw new Error("injected lost prepare response");
        }
        return { ok: true, data: keyed.prepared, correlationId: context.correlationId };
      }
      const existingTx = prepared.get(input.transactionId);
      if (existingTx) {
        if (existingTx.requestHash !== hash) {
          return apiFailure(
            "REQUIRES_ATTENTION",
            "This transactionId is already claimed by another prepare command",
            context.correlationId,
          );
        }
        return { ok: true, data: existingTx.prepared, correlationId: context.correlationId };
      }
      const quote = quoteById.get(input.quoteId);
      if (!quote) {
        return apiFailure("NOT_FOUND", "Quote snapshot was not found", context.correlationId);
      }
      if (quote.fingerprint !== input.quoteFingerprint) {
        return apiFailure("QUOTE_CHANGED", "quoteFingerprint does not match the stored quote", context.correlationId);
      }
      port.wooOrderCount += 1;
      port.stockReserveCount += 1;
      const saleId = `woo-${port.wooOrderCount}`;
      const preparedSale: PreparedSale = {
        transactionId: input.transactionId,
        saleId,
        orderReference: saleId,
        quoteFingerprint: quote.fingerprint,
        total: quote.total,
        status: "prepared",
        stockCommitment: "reserved",
        preparedAt: toIsoTimestamp(now),
        expiresAt: quote.expiresAt,
      };
      const row: PreparedRow = { requestHash: hash, prepareKey: context.idempotencyKey, prepared: preparedSale };
      prepared.set(input.transactionId, row);
      prepareByKey.set(context.idempotencyKey, row);
      if (port.dropNextPrepareResponse) {
        port.dropNextPrepareResponse = false;
        throw new Error("injected lost prepare response");
      }
      return { ok: true, data: preparedSale, correlationId: context.correlationId };
    },
    async resolve(transactionId): Promise<ApiResult<SaleResolution>> {
      const correlationId = "00000000-0000-4000-8000-000000000000";
      const done = finalized.get(transactionId);
      if (done) {
        return { ok: true, data: done, correlationId };
      }
      const cancelledSale = cancelled.get(transactionId);
      if (cancelledSale) {
        return { ok: true, data: cancelledSale, correlationId };
      }
      const row = prepared.get(transactionId);
      if (row) {
        return {
          ok: true,
          data: {
            transactionId,
            status: "prepared",
            saleId: row.prepared.saleId,
            orderReference: row.prepared.orderReference,
          },
          correlationId,
        };
      }
      return { ok: true, data: { transactionId, status: "not_found" }, correlationId };
    },
    async confirmPayment(
      input: BridgeFinalizeRequest,
      context: CommandContext,
    ): Promise<ApiResult<SaleResolution>> {
      const hash = await sha256Hex(canonicalJson(input));
      const keyed = finalizeByKey.get(context.idempotencyKey);
      if (keyed && keyed.hash !== hash) {
        return apiFailure(
          "IDEMPOTENCY_CONFLICT",
          "Idempotency-Key was reused with a different finalize request",
          context.correlationId,
        );
      }
      if (keyed) {
        if (port.dropNextFinalizeResponse) {
          port.dropNextFinalizeResponse = false;
          throw new Error("injected lost finalize response");
        }
        return { ok: true, data: keyed.resolution, correlationId: context.correlationId };
      }
      const existing = finalized.get(input.transactionId);
      if (existing) {
        return { ok: true, data: existing, correlationId: context.correlationId };
      }
      const row = prepared.get(input.transactionId);
      if (!row) {
        return apiFailure("NOT_FOUND", "prepared sale was not found", context.correlationId);
      }
      if (input.payment.saleId !== row.prepared.saleId) {
        return apiFailure("PAYMENT_NOT_VERIFIED", "payment is not bound to this prepared sale", context.correlationId);
      }
      if (
        input.payment.amount.minor !== row.prepared.total.minor ||
        input.payment.amount.currency !== row.prepared.total.currency
      ) {
        return apiFailure("VALIDATION_ERROR", "verified payment amount does not match the prepared sale", context.correlationId);
      }
      port.paymentCompleteCount += 1;
      port.stockEffectCount += 1;
      const resolution: SaleResolution = {
        transactionId: input.transactionId,
        status: "completed",
        saleId: row.prepared.saleId,
        orderReference: row.prepared.orderReference,
        paymentId: input.payment.paymentId,
      };
      finalized.set(input.transactionId, resolution);
      finalizeByKey.set(context.idempotencyKey, { hash, resolution });
      if (port.dropNextFinalizeResponse) {
        port.dropNextFinalizeResponse = false;
        throw new Error("injected lost finalize response");
      }
      return { ok: true, data: resolution, correlationId: context.correlationId };
    },
    async cancel(input: CancelSaleRequest, context: CommandContext): Promise<ApiResult<SaleResolution>> {
      const hash = await sha256Hex(canonicalJson(input));
      const keyed = cancelByKey.get(context.idempotencyKey);
      if (keyed && keyed.hash !== hash) {
        return apiFailure(
          "IDEMPOTENCY_CONFLICT",
          "Idempotency-Key was reused with a different CancelSaleRequest",
          context.correlationId,
        );
      }
      if (keyed) {
        if (port.dropNextCancelResponse) {
          port.dropNextCancelResponse = false;
          throw new Error("injected lost cancel response");
        }
        return { ok: true, data: keyed.resolution, correlationId: context.correlationId };
      }
      const existingCancelled = cancelled.get(input.transactionId);
      if (existingCancelled) {
        return { ok: true, data: existingCancelled, correlationId: context.correlationId };
      }
      if (finalized.has(input.transactionId)) {
        return apiFailure("PAYMENT_PENDING", "A verified sale cannot be cancelled", context.correlationId);
      }
      const row = prepared.get(input.transactionId);
      if (!row) {
        return apiFailure("NOT_FOUND", "prepared sale was not found", context.correlationId);
      }
      port.cancelCount += 1;
      const resolution: SaleResolution = {
        transactionId: input.transactionId,
        status: "cancelled",
        saleId: row.prepared.saleId,
        orderReference: row.prepared.orderReference,
      };
      cancelled.set(input.transactionId, resolution);
      cancelByKey.set(context.idempotencyKey, { hash, resolution });
      prepared.delete(input.transactionId);
      if (port.dropNextCancelResponse) {
        port.dropNextCancelResponse = false;
        throw new Error("injected lost cancel response");
      }
      return { ok: true, data: resolution, correlationId: context.correlationId };
    },
  };
  return port;
}

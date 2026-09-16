import type {
  BridgeCommercialRefundRequest,
  BridgeStockDispositionRequest,
} from "../../../../../docs/contracts/domain.generated";
import { stockCommandLines } from "../../core/returns/disposition";
import type { StoredCommercialRefund, StoredReturnRecord, StoredStockDisposition } from "../../core/returns/types";

/**
 * Canonical WS3 → WS2 commercial-refund command. executeReturn must use this
 * builder so WS2 tests can consume the exact artifact WS3 produces.
 */
export function buildCommercialRefundCommand(input: {
  readonly stored: StoredReturnRecord;
  readonly commercial: StoredCommercialRefund;
}): BridgeCommercialRefundRequest {
  return {
    commercialRefundId: input.commercial.commercialRefundId,
    returnId: input.commercial.returnId,
    transactionId: input.commercial.transactionId,
    saleId: input.commercial.saleId,
    amount: input.commercial.amount,
    economicsVersion: input.commercial.economicsVersion,
    fingerprint: input.stored.fingerprint,
    reason: input.stored.requestedLines[0]?.reason ?? "return",
    lineAllocations: input.stored.requestedLines.map((line) => ({
      orderLineId: line.orderLineId,
      quantity: line.quantity,
      historicAmount: line.allocatedHistoricAmount,
    })),
  };
}

/**
 * Canonical WS3 → WS2 stock-disposition command. executeReturn must use this
 * builder. resellable lines may restock sellable; damaged/quarantine/not-physical never do.
 */
export function buildStockDispositionCommand(input: {
  readonly stored: StoredReturnRecord;
  readonly stock: StoredStockDisposition;
}): BridgeStockDispositionRequest {
  return {
    stockDispositionId: input.stock.stockDispositionId,
    returnId: input.stock.returnId,
    transactionId: input.stock.transactionId,
    saleId: input.stock.saleId,
    economicsVersion: input.stock.economicsVersion,
    fingerprint: input.stored.fingerprint,
    lines: stockCommandLines({
      locationId: input.stored.locationId,
      lines: input.stored.requestedLines,
    }),
  };
}

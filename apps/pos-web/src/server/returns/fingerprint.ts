import type {
  HistoricSaleEconomicsSnapshot,
  ReturnPreview,
} from "../../../../../docs/contracts/domain.generated";
import { canonicalJson, sha256Hex } from "../../local/canonical";

export async function economicsVersionFor(snapshot: Omit<HistoricSaleEconomicsSnapshot, "economicsVersion">): Promise<string> {
  return sha256Hex(
    canonicalJson({
      saleId: snapshot.saleId,
      transactionId: snapshot.transactionId,
      currency: snapshot.currency,
      lines: snapshot.lines.map((line) => ({
        orderLineId: line.orderLineId,
        originalSoldQuantity: line.originalSoldQuantity,
        historicalSubtotal: line.historicalSubtotal,
        historicalDiscount: line.historicalDiscount,
        historicalTax: line.historicalTax,
        historicalTotal: line.historicalTotal,
      })),
      tenders: snapshot.tenders.map((tender) => ({
        paymentId: tender.paymentId,
        tender: tender.tender,
        originalAmount: tender.originalAmount,
      })),
    }),
  );
}

export async function returnFingerprintFor(preview: Omit<ReturnPreview, "fingerprint" | "expiresAt">): Promise<string> {
  return sha256Hex(
    canonicalJson({
      returnId: preview.returnId,
      saleId: preview.saleId,
      economicsVersion: preview.economicsVersion,
      refundTotal: preview.refundTotal,
      approvalRequired: preview.approvalRequired,
      lines: preview.lines.map((line) => ({
        orderLineId: line.orderLineId,
        requestedQuantity: line.requestedQuantity,
        remainingReturnableQuantity: line.remainingReturnableQuantity,
        condition: line.condition,
        intendedDisposition: line.intendedDisposition,
        dispositionPolicy: line.dispositionPolicy,
      })),
    }),
  );
}

import type { ReturnPreview } from "../../../../../docs/contracts/domain.generated";
import { canonicalJson, sha256Hex } from "../../local/canonical";

/**
 * Shared WS3/WS2 economics version token for R8.
 * This is PreparedSale.quoteFingerprint: the immutable prepared-sale commercial
 * generation the return is bound to. It is not a hash of historic refund math
 * and is not permission to price a refund from current catalog quotes.
 */
export function economicsVersionFromPreparedSale(quoteFingerprint: string): string {
  return quoteFingerprint;
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

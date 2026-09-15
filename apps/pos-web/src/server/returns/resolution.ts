import type { ReturnResolution } from "../../../../../docs/contracts/domain.generated";
import { computeReturnResolution, refundToIndependent } from "../../core/returns/aggregate";
import type { StoredReturnRecord } from "../../core/returns/types";

export function resolutionFromRecord(record: StoredReturnRecord): ReturnResolution {
  return computeReturnResolution({
    returnId: record.returnId,
    executed: Boolean(record.executeClaimedAt),
    approvalRequired: record.approvalRequired,
    providerRefund: record.providerRefund
      ? { effectId: record.providerRefund.refundId, status: refundToIndependent(record.providerRefund.status) }
      : { status: "not_required" },
    cashRefund: record.cashRefund
      ? { effectId: record.cashRefund.refundId, status: refundToIndependent(record.cashRefund.status) }
      : { status: "not_required" },
    commercialRefund: record.commercialRefund
      ? { effectId: record.commercialRefund.commercialRefundId, status: record.commercialRefund.status }
      : record.executeClaimedAt
        ? { status: "not_started" }
        : { status: "not_started" },
    stockDisposition: record.stockDisposition
      ? { effectId: record.stockDisposition.stockDispositionId, status: record.stockDisposition.status }
      : { status: "not_required" },
  });
}

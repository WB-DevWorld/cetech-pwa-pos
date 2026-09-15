import type {
  HistoricSaleLineEconomics,
  HistoricTenderEconomics,
  Id,
  IndependentEffectStatus,
  Money,
  PaymentTender,
  Quantity,
  RefundChannel,
  RefundState,
  ReturnApprovalBinding,
  ReturnCondition,
  ReturnConditionStockPolicy,
  ReturnPreviewLine,
  StockDisposition,
  Timestamp,
  Uuid,
} from "../../../../../docs/contracts/domain.generated";

export type StoredRequestedReturnLine = ReturnPreviewLine & {
  readonly quantity: Quantity;
  readonly reason: string;
  readonly condition: ReturnCondition;
};

export type StoredTenderRefund = RefundState & {
  readonly organizationId: Id;
  readonly locationId: Id;
  readonly paymentId: Uuid;
  readonly transactionId: Uuid;
  readonly cashMovementId?: Uuid;
  readonly provider?: string;
  readonly providerRefundReference?: string;
  readonly providerTransactionId?: string;
  readonly initializeStatus?: "pending_remote" | "initialized" | "lost_response";
  readonly attentionReason?: string;
};

export type StoredCommercialRefund = {
  readonly commercialRefundId: Uuid;
  readonly returnId: Uuid;
  readonly organizationId: Id;
  readonly locationId: Id;
  readonly transactionId: Uuid;
  readonly saleId: Id;
  readonly amount: Money;
  readonly economicsVersion: string;
  readonly fingerprint: string;
  readonly status: IndependentEffectStatus;
  readonly message?: string;
};

export type StoredStockDisposition = {
  readonly stockDispositionId: Uuid;
  readonly returnId: Uuid;
  readonly organizationId: Id;
  readonly locationId: Id;
  readonly transactionId: Uuid;
  readonly saleId: Id;
  readonly economicsVersion: string;
  readonly fingerprint: string;
  readonly status: IndependentEffectStatus;
  readonly message?: string;
};

export type StoredReturnAudit = {
  readonly id: Uuid;
  readonly returnId: Uuid;
  readonly organizationId: Id;
  readonly eventType: string;
  readonly payload: Readonly<Record<string, string>>;
  readonly createdAt: Timestamp;
};

export type StoredReturnRecord = {
  readonly returnId: Uuid;
  readonly organizationId: Id;
  readonly locationId: Id;
  readonly registerId: Id;
  readonly shiftId?: Uuid;
  readonly actorId: Id;
  readonly transactionId: Uuid;
  readonly saleId: Id;
  readonly economicsVersion: string;
  readonly fingerprint: string;
  readonly previewExpiresAt: Timestamp;
  readonly approvalRequired: boolean;
  readonly refundTotal: Money;
  status: "previewed" | "approval_required" | "refund_pending" | "in_progress" | "completed" | "requires_attention";
  executeClaimedAt?: Timestamp;
  readonly historicLines: readonly HistoricSaleLineEconomics[];
  readonly historicTenders: readonly HistoricTenderEconomics[];
  readonly requestedLines: readonly StoredRequestedReturnLine[];
  cashRefund?: StoredTenderRefund;
  providerRefund?: StoredTenderRefund;
  commercialRefund?: StoredCommercialRefund;
  stockDisposition?: StoredStockDisposition;
};

export type StoredReturnApproval = ReturnApprovalBinding & {
  readonly organizationId: Id;
  readonly locationId: Id;
};

export type ReturnExecutionClaim = "claimed" | "already_claimed" | "quantity_exceeded" | "refund_exceeded" | "missing";

export interface ReturnStore {
  withLock<T>(key: string, fn: () => Promise<T>): Promise<T>;
  insertPreview(record: StoredReturnRecord): Promise<void>;
  getReturn(returnId: Uuid): Promise<StoredReturnRecord | undefined>;
  saveReturn(record: StoredReturnRecord): Promise<void>;
  claimExecution(returnId: Uuid, claimedAt: Timestamp): Promise<ReturnExecutionClaim>;
  acceptedReturnedQuantity(organizationId: Id, saleId: Id, orderLineId: Id): Promise<number>;
  acceptedRefundedMinor(paymentId: Uuid): Promise<number>;
  bindApproval(approval: StoredReturnApproval): Promise<void>;
  getApproval(approvalId: Uuid): Promise<StoredReturnApproval | undefined>;
  insertTenderRefund(row: StoredTenderRefund): Promise<"ok" | "duplicate">;
  getTenderRefund(refundId: Uuid): Promise<StoredTenderRefund | undefined>;
  saveTenderRefund(row: StoredTenderRefund): Promise<void>;
  insertCommercialRefund(row: StoredCommercialRefund): Promise<"ok" | "duplicate">;
  getCommercialRefund(commercialRefundId: Uuid): Promise<StoredCommercialRefund | undefined>;
  saveCommercialRefund(row: StoredCommercialRefund): Promise<void>;
  insertStockDisposition(row: StoredStockDisposition): Promise<"ok" | "duplicate">;
  getStockDisposition(stockDispositionId: Uuid): Promise<StoredStockDisposition | undefined>;
  saveStockDisposition(row: StoredStockDisposition): Promise<void>;
  appendAudit(event: StoredReturnAudit): Promise<void>;
  listAudit(returnId: Uuid): Promise<readonly StoredReturnAudit[]>;
}

export function cloneReturn(record: StoredReturnRecord): StoredReturnRecord {
  return {
    ...record,
    historicLines: record.historicLines.map((line) => ({ ...line })),
    historicTenders: record.historicTenders.map((tender) => ({ ...tender })),
    requestedLines: record.requestedLines.map((line) => ({ ...line })),
    cashRefund: record.cashRefund ? { ...record.cashRefund } : undefined,
    providerRefund: record.providerRefund ? { ...record.providerRefund } : undefined,
    commercialRefund: record.commercialRefund ? { ...record.commercialRefund } : undefined,
    stockDisposition: record.stockDisposition ? { ...record.stockDisposition } : undefined,
  };
}

export type { ReturnCondition, ReturnConditionStockPolicy, StockDisposition, RefundChannel, PaymentTender };

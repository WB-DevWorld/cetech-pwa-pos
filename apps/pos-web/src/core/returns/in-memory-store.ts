import type { Id, Uuid } from "../../../../../docs/contracts/domain.generated";
import type {
  ReturnExecutionClaim,
  ReturnStore,
  StoredCommercialRefund,
  StoredReturnApproval,
  StoredReturnAudit,
  StoredReturnRecord,
  StoredStockDisposition,
  StoredTenderRefund,
} from "./types";
import { cloneReturn } from "./types";
import { parseQuantity } from "./quantities";

type LineBalance = {
  originalSold: number;
  acceptedReturned: number;
};

type TenderBalance = {
  organizationId: Id;
  saleId: Id;
  originalMinor: number;
  acceptedMinor: number;
  currency: string;
};

function lockChains() {
  const chains = new Map<string, Promise<void>>();
  return async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = chains.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    chains.set(key, previous.then(() => gate));
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  };
}

export function createInMemoryReturnStore(): ReturnStore {
  const returns = new Map<Uuid, StoredReturnRecord>();
  const approvals = new Map<Uuid, StoredReturnApproval>();
  const tenderRefunds = new Map<Uuid, StoredTenderRefund>();
  const commercialRefunds = new Map<Uuid, StoredCommercialRefund>();
  const stockDispositions = new Map<Uuid, StoredStockDisposition>();
  const lineBalances = new Map<string, LineBalance>();
  const tenderBalances = new Map<Uuid, TenderBalance>();
  const audit: StoredReturnAudit[] = [];
  const withLock = lockChains();

  function lineKey(organizationId: Id, saleId: Id, orderLineId: Id): string {
    return `${organizationId}\0${saleId}\0${orderLineId}`;
  }

  const store: ReturnStore = {
    withLock,

    async insertPreview(record) {
      if (returns.has(record.returnId)) {
        throw new Error("return already exists");
      }
      returns.set(record.returnId, cloneReturn(record));
    },

    async getReturn(returnId) {
      const row = returns.get(returnId);
      return row ? cloneReturn(row) : undefined;
    },

    async saveReturn(record) {
      returns.set(record.returnId, cloneReturn(record));
    },

    async claimExecution(returnId, claimedAt) {
      const row = returns.get(returnId);
      if (!row) {
        return "missing";
      }
      if (row.executeClaimedAt) {
        return "already_claimed";
      }
      const snapshots = snapshotBalances(row, lineBalances, tenderBalances, lineKey);
      const claimed = applyClaims(row, lineBalances, tenderBalances, lineKey);
      if (claimed !== "claimed") {
        restoreBalances(snapshots, lineBalances, tenderBalances);
        return claimed;
      }
      row.executeClaimedAt = claimedAt;
      if (row.status === "previewed" || row.status === "approval_required") {
        row.status = "in_progress";
      }
      return "claimed";
    },

    async acceptedReturnedQuantity(organizationId, saleId, orderLineId) {
      return lineBalances.get(lineKey(organizationId, saleId, orderLineId))?.acceptedReturned ?? 0;
    },

    async acceptedRefundedMinor(paymentId) {
      return tenderBalances.get(paymentId)?.acceptedMinor ?? 0;
    },

    async bindApproval(approval) {
      approvals.set(approval.approvalId, { ...approval });
    },

    async getApproval(approvalId) {
      const row = approvals.get(approvalId);
      return row ? { ...row } : undefined;
    },

    async getApprovalForReturn(returnId, fingerprint) {
      return [...approvals.values()]
        .filter((row) => row.returnId === returnId && row.fingerprint === fingerprint)
        .sort((left, right) => Date.parse(right.expiresAt) - Date.parse(left.expiresAt))
        .map((row) => ({ ...row }))[0];
    },

    async insertTenderRefund(row) {
      if (tenderRefunds.has(row.refundId)) {
        return "duplicate";
      }
      const existingForReturn = [...tenderRefunds.values()].find((item) => item.returnId === row.returnId);
      if (existingForReturn && existingForReturn.refundId !== row.refundId) {
        return "duplicate";
      }
      tenderRefunds.set(row.refundId, { ...row });
      attachTender(returns.get(row.returnId), row);
      return "ok";
    },

    async getTenderRefund(refundId) {
      const row = tenderRefunds.get(refundId);
      return row ? { ...row } : undefined;
    },

    async saveTenderRefund(row) {
      const current = tenderRefunds.get(row.refundId);
      if (current?.status === "verified" && row.status !== "verified") {
        return;
      }
      tenderRefunds.set(row.refundId, { ...row });
      attachTender(returns.get(row.returnId), row);
    },

    async insertCommercialRefund(row) {
      if (commercialRefunds.has(row.commercialRefundId)) {
        return "duplicate";
      }
      const existing = [...commercialRefunds.values()].find((item) => item.returnId === row.returnId);
      if (existing) {
        return "duplicate";
      }
      commercialRefunds.set(row.commercialRefundId, { ...row });
      const parent = returns.get(row.returnId);
      if (parent) {
        parent.commercialRefund = { ...row };
      }
      return "ok";
    },

    async getCommercialRefund(commercialRefundId) {
      const row = commercialRefunds.get(commercialRefundId);
      return row ? { ...row } : undefined;
    },

    async saveCommercialRefund(row) {
      const current = commercialRefunds.get(row.commercialRefundId);
      if (current?.status === "completed" && row.status !== "completed") {
        return;
      }
      commercialRefunds.set(row.commercialRefundId, { ...row });
      const parent = returns.get(row.returnId);
      if (parent) {
        parent.commercialRefund = { ...row };
      }
    },

    async insertStockDisposition(row) {
      if (stockDispositions.has(row.stockDispositionId)) {
        return "duplicate";
      }
      const existing = [...stockDispositions.values()].find((item) => item.returnId === row.returnId);
      if (existing) {
        return "duplicate";
      }
      stockDispositions.set(row.stockDispositionId, { ...row });
      const parent = returns.get(row.returnId);
      if (parent) {
        parent.stockDisposition = { ...row };
      }
      return "ok";
    },

    async getStockDisposition(stockDispositionId) {
      const row = stockDispositions.get(stockDispositionId);
      return row ? { ...row } : undefined;
    },

    async saveStockDisposition(row) {
      const current = stockDispositions.get(row.stockDispositionId);
      if (current?.status === "completed" && row.status !== "completed") {
        return;
      }
      stockDispositions.set(row.stockDispositionId, { ...row });
      const parent = returns.get(row.returnId);
      if (parent) {
        parent.stockDisposition = { ...row };
      }
    },

    async appendAudit(event) {
      audit.push({ ...event, payload: { ...event.payload } });
    },

    async listAudit(returnId) {
      return audit.filter((row) => row.returnId === returnId).map((row) => ({ ...row, payload: { ...row.payload } }));
    },
  };

  return store;
}

function attachTender(parent: StoredReturnRecord | undefined, row: StoredTenderRefund): void {
  if (!parent) {
    return;
  }
  if (row.channel === "cash_ledger") {
    parent.cashRefund = { ...row };
  } else {
    parent.providerRefund = { ...row };
  }
}

function snapshotBalances(
  row: StoredReturnRecord,
  lineBalances: Map<string, LineBalance>,
  tenderBalances: Map<Uuid, TenderBalance>,
  lineKey: (organizationId: Id, saleId: Id, orderLineId: Id) => string,
) {
  const lines = row.requestedLines.map((line) => {
    const key = lineKey(row.organizationId, row.saleId, line.orderLineId);
    const current = lineBalances.get(key);
    return { key, value: current ? { ...current } : undefined };
  });
  const tenders = row.historicTenders.map((tender) => {
    const current = tenderBalances.get(tender.paymentId);
    return { paymentId: tender.paymentId, value: current ? { ...current } : undefined };
  });
  return { lines, tenders };
}

function restoreBalances(
  snapshots: ReturnType<typeof snapshotBalances>,
  lineBalances: Map<string, LineBalance>,
  tenderBalances: Map<Uuid, TenderBalance>,
): void {
  for (const line of snapshots.lines) {
    if (line.value) {
      lineBalances.set(line.key, line.value);
    } else {
      lineBalances.delete(line.key);
    }
  }
  for (const tender of snapshots.tenders) {
    if (tender.value) {
      tenderBalances.set(tender.paymentId, tender.value);
    } else {
      tenderBalances.delete(tender.paymentId);
    }
  }
}

function applyClaims(
  row: StoredReturnRecord,
  lineBalances: Map<string, LineBalance>,
  tenderBalances: Map<Uuid, TenderBalance>,
  lineKey: (organizationId: Id, saleId: Id, orderLineId: Id) => string,
): ReturnExecutionClaim {
  for (const requested of row.requestedLines) {
    const historic = row.historicLines.find((line) => line.orderLineId === requested.orderLineId);
    if (!historic) {
      return "quantity_exceeded";
    }
    const original = parseQuantity(historic.originalSoldQuantity);
    const qty = parseQuantity(requested.quantity);
    const key = lineKey(row.organizationId, row.saleId, requested.orderLineId);
    const current = lineBalances.get(key) ?? { originalSold: original, acceptedReturned: 0 };
    if (current.originalSold !== original || current.acceptedReturned + qty > current.originalSold) {
      return "quantity_exceeded";
    }
    lineBalances.set(key, {
      originalSold: current.originalSold,
      acceptedReturned: current.acceptedReturned + qty,
    });
  }
  if (row.refundTotal.minor > 0) {
    const tender = row.historicTenders[0];
    if (!tender) {
      return "refund_exceeded";
    }
    const current = tenderBalances.get(tender.paymentId) ?? {
      organizationId: row.organizationId,
      saleId: row.saleId,
      originalMinor: tender.originalAmount.minor,
      acceptedMinor: 0,
      currency: tender.originalAmount.currency,
    };
    if (
      current.currency !== row.refundTotal.currency ||
      current.originalMinor !== tender.originalAmount.minor ||
      current.acceptedMinor + row.refundTotal.minor > current.originalMinor
    ) {
      return "refund_exceeded";
    }
    tenderBalances.set(tender.paymentId, {
      ...current,
      acceptedMinor: current.acceptedMinor + row.refundTotal.minor,
    });
  }
  return "claimed";
}

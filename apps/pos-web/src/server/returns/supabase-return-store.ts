import type { Id, Uuid } from "../../../../../docs/contracts/domain.generated";
import type { PosRestFetch } from "../http/server-fetch";
import type {
  ReturnExecutionClaim,
  ReturnStore,
  StoredCommercialRefund,
  StoredRequestedReturnLine,
  StoredReturnApproval,
  StoredReturnAudit,
  StoredReturnRecord,
  StoredStockDisposition,
  StoredTenderRefund,
} from "../../core/returns/types";
import { cloneReturn } from "../../core/returns/types";

export type SupabaseReturnStoreOptions = {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 8_000;

export function createSupabaseReturnStore(options: SupabaseReturnStoreOptions): ReturnStore {
  const root = `${options.url.replace(/\/+$/, "")}/rest/v1`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers = {
    apikey: options.serviceRoleKey,
    Authorization: `Bearer ${options.serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  async function request(input: {
    readonly path: string;
    readonly method: string;
    readonly body?: unknown;
    readonly prefer?: string;
  }): Promise<{ readonly status: number; readonly body: unknown }> {
    const response = await options.fetchImpl(`${root}/${input.path}`, {
      method: input.method,
      headers: input.prefer ? { ...headers, Prefer: input.prefer } : headers,
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, body };
  }

  async function getRows(path: string): Promise<Record<string, unknown>[]> {
    const result = await request({ path, method: "GET" });
    if (!result.status || result.status >= 400 || !Array.isArray(result.body)) {
      throw new Error("durable return store is unavailable");
    }
    return result.body.filter((row): row is Record<string, unknown> => row !== null && typeof row === "object");
  }

  async function getOne(path: string): Promise<Record<string, unknown> | undefined> {
    return (await getRows(path))[0];
  }

  const store: ReturnStore = {
    async withLock(_key, fn) {
      return fn();
    },

    async insertPreview(record) {
      const result = await request({
        path: "pos_returns",
        method: "POST",
        prefer: "return=minimal",
        body: returnRow(record),
      });
      if (result.status !== 201 && result.status !== 200) {
        throw new Error("durable return store rejected preview");
      }
      await insertChildren(record, request);
    },

    async getReturn(returnId) {
      const row = await getOne(`pos_returns?return_id=eq.${encodeURIComponent(returnId)}`);
      if (!row) {
        return undefined;
      }
      return hydrate(row, getRows);
    },

    async saveReturn(record) {
      const result = await request({
        path: `pos_returns?return_id=eq.${encodeURIComponent(record.returnId)}`,
        method: "PATCH",
        prefer: "return=minimal",
        body: {
          status: record.status,
          execute_claimed_at: record.executeClaimedAt ?? null,
          updated_at: new Date().toISOString(),
        },
      });
      if (result.status >= 400) {
        throw new Error("durable return store rejected return update");
      }
    },

    async claimExecution(returnId) {
      const result = await request({
        path: "rpc/pos_claim_return_execution",
        method: "POST",
        body: { p_return_id: returnId },
      });
      if (typeof result.body === "string") {
        return asClaim(result.body);
      }
      if (result.status >= 400) {
        const message = JSON.stringify(result.body ?? "");
        if (message.includes("quantity_exceeded")) {
          return "quantity_exceeded";
        }
        if (message.includes("refund_exceeded")) {
          return "refund_exceeded";
        }
        return "missing";
      }
      return "missing";
    },

    async acceptedReturnedQuantity(organizationId, saleId, orderLineId) {
      const row = await getOne(
        `pos_sale_line_return_balances?organization_id=eq.${encodeURIComponent(organizationId)}&sale_id=eq.${encodeURIComponent(saleId)}&order_line_id=eq.${encodeURIComponent(orderLineId)}&select=accepted_returned_quantity`,
      );
      return typeof row?.accepted_returned_quantity === "number" ? row.accepted_returned_quantity : Number(row?.accepted_returned_quantity ?? 0);
    },

    async acceptedRefundedMinor(paymentId) {
      const row = await getOne(
        `pos_sale_tender_refund_balances?payment_id=eq.${encodeURIComponent(paymentId)}&select=accepted_refunded_minor`,
      );
      return typeof row?.accepted_refunded_minor === "number" ? row.accepted_refunded_minor : 0;
    },

    async bindApproval(approval) {
      const result = await request({
        path: "pos_return_approvals",
        method: "POST",
        prefer: "return=minimal",
        body: {
          approval_id: approval.approvalId,
          return_id: approval.returnId,
          fingerprint: approval.fingerprint,
          actor_id: approval.actorId,
          organization_id: approval.organizationId,
          location_id: approval.locationId,
          expires_at: approval.expiresAt,
        },
      });
      if (result.status !== 201 && result.status !== 200) {
        throw new Error("durable return store rejected approval");
      }
    },

    async getApproval(approvalId) {
      const row = await getOne(`pos_return_approvals?approval_id=eq.${encodeURIComponent(approvalId)}`);
      return row ? mapApproval(row) : undefined;
    },

    async getApprovalForReturn(returnId, fingerprint) {
      const row = await getOne(
        `pos_return_approvals?return_id=eq.${encodeURIComponent(returnId)}&fingerprint=eq.${encodeURIComponent(fingerprint)}&order=expires_at.desc,created_at.desc&limit=1`,
      );
      return row ? mapApproval(row) : undefined;
    },

    async insertTenderRefund(row) {
      const result = await request({
        path: "pos_tender_refunds",
        method: "POST",
        prefer: "return=minimal",
        body: tenderRow(row),
      });
      if (result.status === 409) {
        return "duplicate";
      }
      if (result.status !== 201 && result.status !== 200) {
        throw new Error("durable return store rejected tender refund");
      }
      return "ok";
    },

    async getTenderRefund(refundId) {
      const row = await getOne(`pos_tender_refunds?refund_id=eq.${encodeURIComponent(refundId)}`);
      return row ? mapTender(row) : undefined;
    },

    async saveTenderRefund(row) {
      await request({
        path: `pos_tender_refunds?refund_id=eq.${encodeURIComponent(row.refundId)}`,
        method: "PATCH",
        prefer: "return=minimal",
        body: {
          status: row.status,
          cash_movement_id: row.cashMovementId ?? null,
          provider: row.provider ?? null,
          provider_refund_reference: row.providerRefundReference ?? null,
          initialize_status: row.initializeStatus ?? null,
          attention_reason: row.attentionReason ?? null,
          updated_at: new Date().toISOString(),
        },
      });
    },

    async insertCommercialRefund(row) {
      const result = await request({
        path: "pos_commercial_refunds",
        method: "POST",
        prefer: "return=minimal",
        body: commercialRow(row),
      });
      return result.status === 409 ? "duplicate" : "ok";
    },

    async getCommercialRefund(commercialRefundId) {
      const row = await getOne(
        `pos_commercial_refunds?commercial_refund_id=eq.${encodeURIComponent(commercialRefundId)}`,
      );
      return row ? mapCommercial(row) : undefined;
    },

    async saveCommercialRefund(row) {
      await request({
        path: `pos_commercial_refunds?commercial_refund_id=eq.${encodeURIComponent(row.commercialRefundId)}`,
        method: "PATCH",
        prefer: "return=minimal",
        body: { status: row.status, message: row.message ?? null, updated_at: new Date().toISOString() },
      });
    },

    async insertStockDisposition(row) {
      const result = await request({
        path: "pos_stock_dispositions",
        method: "POST",
        prefer: "return=minimal",
        body: stockRow(row),
      });
      return result.status === 409 ? "duplicate" : "ok";
    },

    async getStockDisposition(stockDispositionId) {
      const row = await getOne(
        `pos_stock_dispositions?stock_disposition_id=eq.${encodeURIComponent(stockDispositionId)}`,
      );
      return row ? mapStock(row) : undefined;
    },

    async saveStockDisposition(row) {
      await request({
        path: `pos_stock_dispositions?stock_disposition_id=eq.${encodeURIComponent(row.stockDispositionId)}`,
        method: "PATCH",
        prefer: "return=minimal",
        body: { status: row.status, message: row.message ?? null, updated_at: new Date().toISOString() },
      });
    },

    async appendAudit(event) {
      await request({
        path: "pos_return_audit",
        method: "POST",
        prefer: "return=minimal",
        body: {
          id: event.id,
          return_id: event.returnId,
          organization_id: event.organizationId,
          event_type: event.eventType,
          payload: event.payload,
        },
      });
    },

    async listAudit(returnId) {
      const rows = await getRows(
        `pos_return_audit?return_id=eq.${encodeURIComponent(returnId)}&select=id,return_id,organization_id,event_type,payload,created_at`,
      );
      return rows.map(mapAudit).filter((row): row is StoredReturnAudit => row !== undefined);
    },
  };

  return store;
}

function asClaim(value: string): ReturnExecutionClaim {
  if (
    value === "claimed" ||
    value === "already_claimed" ||
    value === "quantity_exceeded" ||
    value === "refund_exceeded" ||
    value === "missing"
  ) {
    return value;
  }
  return "missing";
}

function returnRow(record: StoredReturnRecord) {
  return {
    return_id: record.returnId,
    organization_id: record.organizationId,
    location_id: record.locationId,
    register_id: record.registerId,
    shift_id: record.shiftId ?? null,
    actor_id: record.actorId,
    transaction_id: record.transactionId,
    sale_id: record.saleId,
    economics_version: record.economicsVersion,
    fingerprint: record.fingerprint,
    preview_expires_at: record.previewExpiresAt,
    approval_required: record.approvalRequired,
    refund_total_minor: record.refundTotal.minor,
    refund_currency: record.refundTotal.currency,
    status: record.status,
    execute_claimed_at: record.executeClaimedAt ?? null,
  };
}

async function insertChildren(
  record: StoredReturnRecord,
  request: (input: { path: string; method: string; body?: unknown; prefer?: string }) => Promise<{ status: number }>,
) {
  for (const line of record.historicLines) {
    await request({
      path: "pos_return_historic_lines",
      method: "POST",
      prefer: "return=minimal",
      body: {
        return_id: record.returnId,
        order_line_id: line.orderLineId,
        original_sold_quantity: Number(line.originalSoldQuantity),
        previously_returned_quantity: Number(line.previouslyReturnedQuantity),
        remaining_returnable_quantity: Number(line.remainingReturnableQuantity),
        historical_subtotal_minor: line.historicalSubtotal.minor,
        historical_discount_minor: line.historicalDiscount.minor,
        historical_tax_minor: line.historicalTax.minor,
        historical_total_minor: line.historicalTotal.minor,
        currency: line.historicalTotal.currency,
      },
    });
  }
  for (const tender of record.historicTenders) {
    await request({
      path: "pos_return_historic_tenders",
      method: "POST",
      prefer: "return=minimal",
      body: {
        return_id: record.returnId,
        payment_id: tender.paymentId,
        tender: tender.tender,
        original_amount_minor: tender.originalAmount.minor,
        already_refunded_minor: tender.alreadyRefundedAmount.minor,
        remaining_refundable_minor: tender.remainingRefundableAmount.minor,
        currency: tender.originalAmount.currency,
      },
    });
  }
  for (const line of record.requestedLines) {
    await request({
      path: "pos_return_requested_lines",
      method: "POST",
      prefer: "return=minimal",
      body: {
        return_id: record.returnId,
        order_line_id: line.orderLineId,
        quantity: Number(line.quantity),
        reason: line.reason,
        condition: line.condition,
        intended_disposition: line.intendedDisposition,
        disposition_policy: line.dispositionPolicy,
        remaining_returnable_quantity: Number(line.remainingReturnableQuantity),
        allocated_historic_amount_minor: line.allocatedHistoricAmount.minor,
        allocated_historic_currency: line.allocatedHistoricAmount.currency,
      },
    });
  }
}

async function hydrate(
  row: Record<string, unknown>,
  getRows: (path: string) => Promise<Record<string, unknown>[]>,
): Promise<StoredReturnRecord | undefined> {
  const returnId = String(row.return_id ?? "");
  const historicLines = (await getRows(`pos_return_historic_lines?return_id=eq.${encodeURIComponent(returnId)}`)).map(
    mapHistoricLine,
  );
  const historicTenders = (await getRows(`pos_return_historic_tenders?return_id=eq.${encodeURIComponent(returnId)}`)).map(
    mapHistoricTender,
  );
  const requestedLines = (await getRows(`pos_return_requested_lines?return_id=eq.${encodeURIComponent(returnId)}`)).map(
    mapRequested,
  );
  const tenders = (await getRows(`pos_tender_refunds?return_id=eq.${encodeURIComponent(returnId)}`)).map(mapTender);
  const commercial = (await getRows(`pos_commercial_refunds?return_id=eq.${encodeURIComponent(returnId)}`)).map(mapCommercial)[0];
  const stock = (await getRows(`pos_stock_dispositions?return_id=eq.${encodeURIComponent(returnId)}`)).map(mapStock)[0];
  const cash = tenders.find((item) => item.channel === "cash_ledger");
  const provider = tenders.find((item) => item.channel === "provider_electronic");
  return cloneReturn({
    returnId,
    organizationId: String(row.organization_id),
    locationId: String(row.location_id),
    registerId: String(row.register_id),
    shiftId: typeof row.shift_id === "string" ? row.shift_id : undefined,
    actorId: String(row.actor_id),
    transactionId: String(row.transaction_id),
    saleId: String(row.sale_id),
    economicsVersion: String(row.economics_version),
    fingerprint: String(row.fingerprint),
    previewExpiresAt: String(row.preview_expires_at),
    approvalRequired: Boolean(row.approval_required),
    refundTotal: { minor: Number(row.refund_total_minor), currency: String(row.refund_currency) },
    status: row.status as StoredReturnRecord["status"],
    executeClaimedAt: typeof row.execute_claimed_at === "string" ? row.execute_claimed_at : undefined,
    historicLines,
    historicTenders,
    requestedLines,
    cashRefund: cash,
    providerRefund: provider,
    commercialRefund: commercial,
    stockDisposition: stock,
  });
}

function mapHistoricLine(row: Record<string, unknown>) {
  const currency = String(row.currency);
  return {
    orderLineId: String(row.order_line_id) as Id,
    originalSoldQuantity: String(row.original_sold_quantity),
    previouslyReturnedQuantity: String(row.previously_returned_quantity),
    remainingReturnableQuantity: String(row.remaining_returnable_quantity),
    historicalSubtotal: { minor: Number(row.historical_subtotal_minor), currency },
    historicalDiscount: { minor: Number(row.historical_discount_minor), currency },
    historicalTax: { minor: Number(row.historical_tax_minor), currency },
    historicalTotal: { minor: Number(row.historical_total_minor), currency },
  };
}

function mapHistoricTender(row: Record<string, unknown>) {
  const currency = String(row.currency);
  return {
    paymentId: String(row.payment_id) as Uuid,
    tender: row.tender as StoredReturnRecord["historicTenders"][number]["tender"],
    originalAmount: { minor: Number(row.original_amount_minor), currency },
    alreadyRefundedAmount: { minor: Number(row.already_refunded_minor), currency },
    remainingRefundableAmount: { minor: Number(row.remaining_refundable_minor), currency },
  };
}

function mapRequested(row: Record<string, unknown>): StoredRequestedReturnLine {
  const allocatedCurrency = String(row.allocated_historic_currency ?? row.currency ?? "GHS");
  return {
    orderLineId: String(row.order_line_id),
    requestedQuantity: String(row.quantity),
    remainingReturnableQuantity: String(row.remaining_returnable_quantity ?? row.quantity),
    condition: row.condition as StoredRequestedReturnLine["condition"],
    intendedDisposition: row.intended_disposition as StoredRequestedReturnLine["intendedDisposition"],
    dispositionPolicy: row.disposition_policy as StoredRequestedReturnLine["dispositionPolicy"],
    quantity: String(row.quantity),
    reason: String(row.reason),
    allocatedHistoricAmount: {
      minor: Number(row.allocated_historic_amount_minor),
      currency: allocatedCurrency,
    },
  };
}

function tenderRow(row: StoredTenderRefund) {
  return {
    refund_id: row.refundId,
    return_id: row.returnId,
    organization_id: row.organizationId,
    location_id: row.locationId,
    payment_id: row.paymentId,
    transaction_id: row.transactionId,
    channel: row.channel,
    amount_minor: row.amount.minor,
    currency: row.amount.currency,
    status: row.status,
    cash_movement_id: row.cashMovementId ?? null,
    provider: row.provider ?? null,
    provider_refund_reference: row.providerRefundReference ?? null,
    initialize_status: row.initializeStatus ?? null,
    attention_reason: row.attentionReason ?? null,
  };
}

function mapTender(row: Record<string, unknown>): StoredTenderRefund {
  return {
    refundId: String(row.refund_id),
    returnId: String(row.return_id),
    channel: row.channel as StoredTenderRefund["channel"],
    status: row.status as StoredTenderRefund["status"],
    amount: { minor: Number(row.amount_minor), currency: String(row.currency) },
    organizationId: String(row.organization_id),
    locationId: String(row.location_id),
    paymentId: String(row.payment_id),
    transactionId: String(row.transaction_id),
    cashMovementId: typeof row.cash_movement_id === "string" ? row.cash_movement_id : undefined,
    provider: typeof row.provider === "string" ? row.provider : undefined,
    providerRefundReference: typeof row.provider_refund_reference === "string" ? row.provider_refund_reference : undefined,
    initializeStatus: row.initialize_status as StoredTenderRefund["initializeStatus"],
    attentionReason: typeof row.attention_reason === "string" ? row.attention_reason : undefined,
  };
}

function commercialRow(row: StoredCommercialRefund) {
  return {
    commercial_refund_id: row.commercialRefundId,
    return_id: row.returnId,
    organization_id: row.organizationId,
    location_id: row.locationId,
    transaction_id: row.transactionId,
    sale_id: row.saleId,
    amount_minor: row.amount.minor,
    currency: row.amount.currency,
    economics_version: row.economicsVersion,
    fingerprint: row.fingerprint,
    status: row.status,
    message: row.message ?? null,
  };
}

function mapCommercial(row: Record<string, unknown>): StoredCommercialRefund {
  return {
    commercialRefundId: String(row.commercial_refund_id),
    returnId: String(row.return_id),
    organizationId: String(row.organization_id),
    locationId: String(row.location_id),
    transactionId: String(row.transaction_id),
    saleId: String(row.sale_id),
    amount: { minor: Number(row.amount_minor), currency: String(row.currency) },
    economicsVersion: String(row.economics_version),
    fingerprint: String(row.fingerprint),
    status: row.status as StoredCommercialRefund["status"],
    message: typeof row.message === "string" ? row.message : undefined,
  };
}

function stockRow(row: StoredStockDisposition) {
  return {
    stock_disposition_id: row.stockDispositionId,
    return_id: row.returnId,
    organization_id: row.organizationId,
    location_id: row.locationId,
    transaction_id: row.transactionId,
    sale_id: row.saleId,
    economics_version: row.economicsVersion,
    fingerprint: row.fingerprint,
    status: row.status,
    message: row.message ?? null,
  };
}

function mapStock(row: Record<string, unknown>): StoredStockDisposition {
  return {
    stockDispositionId: String(row.stock_disposition_id),
    returnId: String(row.return_id),
    organizationId: String(row.organization_id),
    locationId: String(row.location_id),
    transactionId: String(row.transaction_id),
    saleId: String(row.sale_id),
    economicsVersion: String(row.economics_version),
    fingerprint: String(row.fingerprint),
    status: row.status as StoredStockDisposition["status"],
    message: typeof row.message === "string" ? row.message : undefined,
  };
}

function mapApproval(row: Record<string, unknown>): StoredReturnApproval {
  return {
    approvalId: String(row.approval_id),
    returnId: String(row.return_id),
    fingerprint: String(row.fingerprint),
    actorId: String(row.actor_id),
    expiresAt: String(row.expires_at),
    organizationId: String(row.organization_id),
    locationId: String(row.location_id),
  };
}

function mapAudit(row: Record<string, unknown>): StoredReturnAudit | undefined {
  if (typeof row.id !== "string" || typeof row.return_id !== "string") {
    return undefined;
  }
  return {
    id: row.id,
    returnId: row.return_id,
    organizationId: String(row.organization_id),
    eventType: String(row.event_type),
    payload: (row.payload ?? {}) as Record<string, string>,
    createdAt: String(row.created_at),
  };
}

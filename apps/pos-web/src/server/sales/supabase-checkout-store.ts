import type {
  Id,
  PendingOperation,
  Quote,
  ReceiptSnapshot,
  Uuid,
} from "../../../../../docs/contracts/domain.generated";
import type { PosRestFetch } from "../http/server-fetch";
import type {
  CheckoutStore,
  IdempotencyClaim,
  OutboxEvent,
  PosSaleRecord,
  SeedPreparedSaleInput,
  StoredCashMovement,
  StoredDevice,
  StoredPayment,
  StoredRegister,
  StoredShift,
} from "../../core/checkout/types";

export type SupabaseCheckoutStoreOptions = {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 8_000;
const CONTRACT_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;

type RestRow = Record<string, unknown>;

/** PostgREST timestamptz round-trips as +00:00; frozen v1 Timestamp requires Z. */
function toContractTimestamp(value: string): string | null {
  if (CONTRACT_TIMESTAMP.test(value)) {
    return value;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
}

/**
 * Durable CheckoutStore backed by POS operational tables.
 * Concurrency and idempotency use database uniqueness, not process Maps.
 * service_role is infrastructure access, not cashier authorization.
 */
export function createSupabaseCheckoutStore(options: SupabaseCheckoutStoreOptions): CheckoutStore {
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
    if (response.status === 401 || response.status === 403) {
      throw new Error("durable checkout store denied infrastructure access");
    }
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, body };
  }

  async function getRows(path: string): Promise<RestRow[]> {
    const result = await request({ path, method: "GET" });
    if (!result.status || result.status >= 400) {
      throw new Error("durable checkout store is unavailable");
    }
    if (!Array.isArray(result.body)) {
      throw new Error("durable checkout store is unavailable");
    }
    return result.body.filter((row): row is RestRow => row !== null && typeof row === "object");
  }

  async function getOne(path: string): Promise<RestRow | undefined> {
    const rows = await getRows(path);
    return rows[0];
  }

  return {
    async withLock(_key, fn) {
      return fn();
    },

    async seedRegister(register) {
      const result = await request({
        path: "pos_registers?on_conflict=id",
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: {
          id: register.id,
          organization_id: register.organizationId,
          location_id: register.locationId,
          name: register.name,
          currency: register.currency,
          status: register.status,
        },
      });
      if (result.status !== 201 && result.status !== 200) {
        throw new Error("durable checkout store rejected register seed");
      }
    },

    async seedDevice(device) {
      const result = await request({
        path: "pos_devices?on_conflict=id",
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: {
          id: device.id,
          organization_id: device.organizationId,
          location_id: device.locationId,
          label: "POS device",
          status: device.status,
        },
      });
      if (result.status !== 201 && result.status !== 200) {
        throw new Error("durable checkout store rejected device seed");
      }
    },

    async getRegister(id) {
      const row = await getOne(`pos_registers?id=eq.${encodeURIComponent(id)}&select=id,organization_id,location_id,name,currency,status`);
      return row ? mapRegister(row) : undefined;
    },

    async getDevice(id) {
      const row = await getOne(`pos_devices?id=eq.${encodeURIComponent(id)}&select=id,organization_id,location_id,status`);
      return row ? mapDevice(row) : undefined;
    },

    async getActiveShift(registerId) {
      const row = await getOne(
        `pos_shifts?register_id=eq.${encodeURIComponent(registerId)}&status=in.(open,closing)&select=id,organization_id,location_id,register_id,device_id,cashier_id,status,opening_float_minor,opening_float_currency,expected_cash_minor,expected_cash_currency,opened_at,closed_at,z_report_id`,
      );
      return row ? mapShift(row) : undefined;
    },

    async getShift(id) {
      const row = await getOne(
        `pos_shifts?id=eq.${encodeURIComponent(id)}&select=id,organization_id,location_id,register_id,device_id,cashier_id,status,opening_float_minor,opening_float_currency,expected_cash_minor,expected_cash_currency,opened_at,closed_at,z_report_id`,
      );
      return row ? mapShift(row) : undefined;
    },

    async insertOpenShift(shift) {
      const result = await request({
        path: "pos_shifts",
        method: "POST",
        prefer: "return=minimal",
        body: {
          id: shift.id,
          register_id: shift.registerId,
          device_id: shift.deviceId,
          cashier_id: shift.cashierId,
          status: "open",
          opening_float_minor: shift.openingFloat.minor,
          opening_float_currency: shift.openingFloat.currency,
          expected_cash_minor: shift.expectedCash?.minor ?? shift.openingFloat.minor,
          expected_cash_currency: shift.openingFloat.currency,
        },
      });
      if (result.status === 201 || result.status === 200) {
        return "ok";
      }
      if (result.status === 409 || constraintName(result.body).includes("pos_shifts_one_active")) {
        return "conflict";
      }
      throw new Error("durable checkout store rejected shift insert");
    },

    async appendCashMovement(movement) {
      if (movement.kind === "opening_float") {
        const existing = await getOne(
          `pos_cash_movements?shift_id=eq.${encodeURIComponent(movement.shiftId)}&kind=eq.opening_float&select=id`,
        );
        if (existing) {
          return "ok";
        }
      }
      const result = await request({
        path: "pos_cash_movements",
        method: "POST",
        prefer: "return=minimal",
        body: {
          id: movement.id,
          shift_id: movement.shiftId,
          kind: movement.kind,
          signed_amount_minor: movement.signedAmount.minor,
          currency: movement.signedAmount.currency,
          actor_id: movement.actorId,
          transaction_id: movement.transactionId ?? null,
          reason: movement.reason ?? null,
        },
      });
      if (result.status === 201 || result.status === 200) {
        return "ok";
      }
      const constraint = constraintName(result.body);
      const message = errorMessage(result.body);
      if (result.status === 409 || constraint.includes("pos_cash_one_sale_per_transaction")) {
        return "duplicate_sale";
      }
      if (constraint.includes("pos_cash_one_opening_float")) {
        return "ok";
      }
      if (message.includes("open shift") || message.includes("cash movements require")) {
        return "shift_required";
      }
      if (message.includes("negative")) {
        return "negative_expected";
      }
      throw new Error("durable checkout store rejected cash movement");
    },

    async listCashSales(transactionId) {
      const rows = await getRows(
        `pos_cash_movements?kind=eq.cash_sale&transaction_id=eq.${encodeURIComponent(transactionId)}&select=id,organization_id,shift_id,kind,signed_amount_minor,currency,actor_id,created_at,transaction_id,reason`,
      );
      return rows.map(mapCashMovement).filter((row): row is StoredCashMovement => row !== undefined);
    },

    async expectedCash(shiftId) {
      const shift = await this.getShift(shiftId);
      return shift?.expectedCash;
    },

    async saveQuote(quote) {
      const location = await getOne(
        `pos_locations?id=eq.${encodeURIComponent(quote.locationId)}&select=id,organization_id`,
      );
      if (!location || typeof location.organization_id !== "string") {
        throw new Error("durable checkout store rejected quote location");
      }
      const result = await request({
        path: "pos_quote_snapshots?on_conflict=id",
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: {
          id: quote.id,
          organization_id: location.organization_id,
          location_id: quote.locationId,
          snapshot: quote,
          updated_at: new Date().toISOString(),
        },
      });
      if (result.status !== 201 && result.status !== 200) {
        throw new Error("durable checkout store rejected quote snapshot");
      }
    },

    async getQuote(quoteId) {
      const row = await getOne(`pos_quote_snapshots?id=eq.${encodeURIComponent(quoteId)}&select=snapshot`);
      return row ? asQuote(row.snapshot) : undefined;
    },

    async seedPreparedSale(input) {
      const record = saleFromSeed(input);
      await upsertSale(record, request);
      return record;
    },

    async getSale(transactionId) {
      const row = await getOne(
        `pos_checkout_sales?transaction_id=eq.${encodeURIComponent(transactionId)}&select=record`,
      );
      return row ? asSale(row.record) : undefined;
    },

    async saveSale(sale) {
      await upsertSale(sale, request);
    },

    async getPayment(paymentId) {
      const row = await getOne(
        `pos_checkout_payments?payment_id=eq.${encodeURIComponent(paymentId)}&select=payment_id,transaction_id,sale_id,evidence_id,tender,status,amount_minor,amount_currency,cash_received_minor,cash_received_currency,verified_at,verification_source,actor_id`,
      );
      return row ? mapPayment(row) : undefined;
    },

    async getPaymentForTransaction(transactionId) {
      const row = await getOne(
        `pos_checkout_payments?transaction_id=eq.${encodeURIComponent(transactionId)}&select=payment_id,transaction_id,sale_id,evidence_id,tender,status,amount_minor,amount_currency,cash_received_minor,cash_received_currency,verified_at,verification_source,actor_id`,
      );
      return row ? mapPayment(row) : undefined;
    },

    async savePayment(payment) {
      const sale = await this.getSale(payment.transactionId);
      const result = await request({
        path: "pos_checkout_payments?on_conflict=payment_id",
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: {
          payment_id: payment.paymentId,
          organization_id: sale?.organizationId ?? "",
          location_id: sale?.locationId ?? "",
          transaction_id: payment.transactionId,
          sale_id: payment.saleId,
          evidence_id: payment.evidenceId,
          tender: payment.tender,
          status: payment.status,
          amount_minor: payment.amount.minor,
          amount_currency: payment.amount.currency,
          cash_received_minor: payment.cashReceived.minor,
          cash_received_currency: payment.cashReceived.currency,
          verified_at: payment.verifiedAt,
          verification_source: payment.verificationSource,
          actor_id: payment.actorId,
        },
      });
      if (result.status === 201 || result.status === 200) {
        return;
      }
      if (result.status === 409) {
        const existing = await this.getPaymentForTransaction(payment.transactionId);
        if (existing && existing.paymentId === payment.paymentId) {
          return;
        }
      }
      throw new Error("durable checkout store rejected payment");
    },

    async getReceipt(transactionId) {
      const row = await getOne(
        `pos_checkout_receipts?transaction_id=eq.${encodeURIComponent(transactionId)}&select=snapshot`,
      );
      return row ? asReceipt(row.snapshot) : undefined;
    },

    async saveReceipt(receipt) {
      const sale = await this.getSale(receipt.transactionId);
      const result = await request({
        path: "pos_checkout_receipts",
        method: "POST",
        prefer: "return=minimal",
        body: {
          id: receipt.id,
          organization_id: sale?.organizationId ?? "",
          location_id: sale?.locationId ?? "",
          transaction_id: receipt.transactionId,
          snapshot: receipt,
        },
      });
      if (result.status === 201 || result.status === 200) {
        return "ok";
      }
      if (result.status === 409) {
        const existing = await this.getReceipt(receipt.transactionId);
        if (existing && existing.id !== receipt.id) {
          return "duplicate";
        }
        return "ok";
      }
      throw new Error("durable checkout store rejected receipt");
    },

    async enqueueOutbox(event) {
      const result = await request({
        path: "pos_outbox_events",
        method: "POST",
        prefer: "return=minimal",
        body: {
          id: event.id,
          organization_id: event.organizationId,
          aggregate_type: event.aggregateType,
          aggregate_id: event.aggregateId,
          event_type: event.eventType,
          payload: event.payload,
          created_at: event.createdAt,
          published_at: event.publishedAt ?? null,
        },
      });
      if (result.status !== 201 && result.status !== 200) {
        throw new Error("durable checkout store rejected outbox event");
      }
    },

    async listOutbox(aggregateId) {
      const rows = await getRows(
        `pos_outbox_events?aggregate_id=eq.${encodeURIComponent(aggregateId)}&select=id,organization_id,aggregate_type,aggregate_id,event_type,payload,created_at,published_at`,
      );
      return rows.map(mapOutbox).filter((row): row is OutboxEvent => row !== undefined);
    },

    async claimIdempotency(organizationId, operation, idempotencyKey, requestHash, locationId) {
      const existing = await getPending(getRows, organizationId, operation, idempotencyKey);
      if (existing) {
        return claimFromRow(existing, requestHash);
      }
      if (!locationId) {
        throw new Error("durable idempotency claim requires a location");
      }
      const result = await request({
        path: "pos_pending_operations",
        method: "POST",
        prefer: "return=representation",
        body: {
          organization_id: organizationId,
          location_id: locationId,
          operation,
          idempotency_key: idempotencyKey,
          request_hash: requestHash,
          status: "pending",
        },
      });
      if (result.status === 201 || result.status === 200) {
        return { kind: "acquired" };
      }
      if (result.status === 409) {
        const raced = await getPending(getRows, organizationId, operation, idempotencyKey);
        if (!raced) {
          throw new Error("durable checkout store lost idempotency row after conflict");
        }
        return claimFromRow(raced, requestHash);
      }
      throw new Error("durable checkout store rejected idempotency claim");
    },

    async markIdempotencySent(organizationId, operation, idempotencyKey) {
      await patchPending(request, organizationId, operation, idempotencyKey, { status: "sent" });
    },

    async acknowledgeIdempotency(organizationId, operation, idempotencyKey, outcome) {
      await patchPending(request, organizationId, operation, idempotencyKey, {
        status: "acknowledged",
        outcome,
      });
    },

    async markIdempotencyRequiresAttention(organizationId, operation, idempotencyKey, outcome) {
      await patchPending(request, organizationId, operation, idempotencyKey, {
        status: "requires_attention",
        outcome,
      });
    },

    async releaseIdempotency(organizationId, operation, idempotencyKey) {
      const existing = await getPending(getRows, organizationId, operation, idempotencyKey);
      if (existing?.status === "sent") {
        await patchPending(request, organizationId, operation, idempotencyKey, { status: "pending" });
      }
    },

    async peekIdempotency(organizationId, operation, idempotencyKey) {
      const existing = await getPending(getRows, organizationId, operation, idempotencyKey);
      return asPendingStatus(existing?.status);
    },
  };
}

async function upsertSale(
  sale: PosSaleRecord,
  request: (input: {
    readonly path: string;
    readonly method: string;
    readonly body?: unknown;
    readonly prefer?: string;
  }) => Promise<{ readonly status: number; readonly body: unknown }>,
): Promise<void> {
  const body = {
    transaction_id: sale.prepared.transactionId,
    organization_id: sale.organizationId,
    location_id: sale.locationId,
    register_id: sale.registerId,
    shift_id: sale.shiftId,
    sale_id: sale.prepared.saleId,
    status: sale.status,
    assigned_payment_id: sale.assignedPaymentId ?? null,
    commercial_confirmed: sale.commercialConfirmed,
    record: sale,
    updated_at: new Date().toISOString(),
  };
  const result = await request({
    path: "pos_checkout_sales?on_conflict=transaction_id",
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body,
  });
  if (result.status !== 201 && result.status !== 200) {
    throw new Error("durable checkout store rejected sale");
  }
}

async function getPending(
  getRows: (path: string) => Promise<RestRow[]>,
  organizationId: Id,
  operation: PendingOperation["operation"],
  idempotencyKey: Uuid,
): Promise<RestRow | undefined> {
  const rows = await getRows(
    `pos_pending_operations?organization_id=eq.${encodeURIComponent(organizationId)}&operation=eq.${encodeURIComponent(operation)}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=request_hash,status,outcome`,
  );
  return rows[0];
}

async function patchPending(
  request: (input: {
    readonly path: string;
    readonly method: string;
    readonly body?: unknown;
    readonly prefer?: string;
  }) => Promise<{ readonly status: number; readonly body: unknown }>,
  organizationId: Id,
  operation: PendingOperation["operation"],
  idempotencyKey: Uuid,
  body: RestRow,
): Promise<void> {
  const result = await request({
    path: `pos_pending_operations?organization_id=eq.${encodeURIComponent(organizationId)}&operation=eq.${encodeURIComponent(operation)}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}`,
    method: "PATCH",
    prefer: "return=minimal",
    body,
  });
  if (result.status >= 400) {
    throw new Error("durable checkout store rejected idempotency update");
  }
}

function claimFromRow(row: RestRow, requestHash: string): IdempotencyClaim {
  if (typeof row.request_hash !== "string" || row.request_hash !== requestHash) {
    return { kind: "conflict" };
  }
  if (row.status === "sent") {
    return { kind: "in_progress" };
  }
  if (row.status === "acknowledged") {
    return { kind: "replay", outcome: row.outcome };
  }
  if (row.status === "requires_attention") {
    return { kind: "repair", outcome: row.outcome };
  }
  return { kind: "acquired" };
}

function saleFromSeed(input: SeedPreparedSaleInput): PosSaleRecord {
  return {
    ...input,
    status: "prepared",
    commercialConfirmed: false,
  };
}

function mapRegister(row: RestRow): StoredRegister | undefined {
  if (
    typeof row.id !== "string" ||
    typeof row.organization_id !== "string" ||
    typeof row.location_id !== "string" ||
    typeof row.name !== "string" ||
    typeof row.currency !== "string" ||
    (row.status !== "active" && row.status !== "disabled" && row.status !== "maintenance")
  ) {
    return undefined;
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    locationId: row.location_id,
    name: row.name,
    currency: row.currency as StoredRegister["currency"],
    status: row.status,
  };
}

function mapDevice(row: RestRow): StoredDevice | undefined {
  if (
    typeof row.id !== "string" ||
    typeof row.organization_id !== "string" ||
    typeof row.location_id !== "string" ||
    (row.status !== "active" && row.status !== "inactive")
  ) {
    return undefined;
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    locationId: row.location_id,
    status: row.status,
  };
}

function mapShift(row: RestRow): StoredShift | undefined {
  if (
    typeof row.id !== "string" ||
    typeof row.organization_id !== "string" ||
    typeof row.location_id !== "string" ||
    typeof row.register_id !== "string" ||
    typeof row.device_id !== "string" ||
    typeof row.cashier_id !== "string" ||
    typeof row.opening_float_minor !== "number" ||
    typeof row.opening_float_currency !== "string" ||
    typeof row.opened_at !== "string"
  ) {
    return undefined;
  }
  const status = row.status;
  if (status !== "open" && status !== "closing" && status !== "closed" && status !== "requires_attention") {
    return undefined;
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    locationId: row.location_id,
    registerId: row.register_id,
    deviceId: row.device_id,
    cashierId: row.cashier_id,
    status,
    openingFloat: { minor: row.opening_float_minor, currency: row.opening_float_currency as StoredShift["openingFloat"]["currency"] },
    expectedCash:
      typeof row.expected_cash_minor === "number" && typeof row.expected_cash_currency === "string"
        ? { minor: row.expected_cash_minor, currency: row.expected_cash_currency as StoredShift["openingFloat"]["currency"] }
        : undefined,
    openedAt: toContractTimestamp(row.opened_at) ?? row.opened_at,
    closedAt: typeof row.closed_at === "string" ? toContractTimestamp(row.closed_at) ?? row.closed_at : undefined,
    zReportId: typeof row.z_report_id === "string" ? row.z_report_id : undefined,
  };
}

function mapCashMovement(row: RestRow): StoredCashMovement | undefined {
  if (
    typeof row.id !== "string" ||
    typeof row.organization_id !== "string" ||
    typeof row.shift_id !== "string" ||
    typeof row.kind !== "string" ||
    typeof row.signed_amount_minor !== "number" ||
    typeof row.currency !== "string" ||
    typeof row.actor_id !== "string" ||
    typeof row.created_at !== "string"
  ) {
    return undefined;
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    shiftId: row.shift_id,
    kind: row.kind as StoredCashMovement["kind"],
    signedAmount: { minor: row.signed_amount_minor, currency: row.currency as StoredCashMovement["signedAmount"]["currency"] },
    actorId: row.actor_id,
    createdAt: toContractTimestamp(row.created_at) ?? row.created_at,
    transactionId: typeof row.transaction_id === "string" ? row.transaction_id : undefined,
    reason: typeof row.reason === "string" ? row.reason : undefined,
  };
}

function mapPayment(row: RestRow): StoredPayment | undefined {
  if (
    typeof row.payment_id !== "string" ||
    typeof row.transaction_id !== "string" ||
    typeof row.sale_id !== "string" ||
    typeof row.evidence_id !== "string" ||
    typeof row.amount_minor !== "number" ||
    typeof row.amount_currency !== "string" ||
    typeof row.cash_received_minor !== "number" ||
    typeof row.cash_received_currency !== "string" ||
    typeof row.verified_at !== "string" ||
    typeof row.actor_id !== "string"
  ) {
    return undefined;
  }
  const verifiedAt = toContractTimestamp(row.verified_at);
  if (!verifiedAt) {
    return undefined;
  }
  return {
    paymentId: row.payment_id,
    transactionId: row.transaction_id,
    saleId: row.sale_id,
    evidenceId: row.evidence_id,
    tender: "cash",
    status: "verified",
    amount: { minor: row.amount_minor, currency: row.amount_currency as StoredPayment["amount"]["currency"] },
    cashReceived: {
      minor: row.cash_received_minor,
      currency: row.cash_received_currency as StoredPayment["amount"]["currency"],
    },
    verifiedAt,
    verificationSource: "cash_ledger",
    actorId: row.actor_id,
  };
}

function mapOutbox(row: RestRow): OutboxEvent | undefined {
  if (
    typeof row.id !== "string" ||
    typeof row.organization_id !== "string" ||
    typeof row.aggregate_type !== "string" ||
    typeof row.aggregate_id !== "string" ||
    typeof row.event_type !== "string" ||
    typeof row.created_at !== "string"
  ) {
    return undefined;
  }
  const payload =
    row.payload !== null && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? Object.fromEntries(
          Object.entries(row.payload as Record<string, unknown>).map(([key, value]) => [key, String(value)]),
        )
      : {};
  return {
    id: row.id,
    organizationId: row.organization_id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    eventType: row.event_type,
    payload,
    createdAt: toContractTimestamp(row.created_at) ?? row.created_at,
    publishedAt: typeof row.published_at === "string" ? row.published_at : undefined,
  };
}

function asQuote(value: unknown): Quote | undefined {
  if (value === null || typeof value !== "object") {
    return undefined;
  }
  const quote = value as Quote;
  return typeof quote.id === "string" && typeof quote.fingerprint === "string" ? quote : undefined;
}

function asSale(value: unknown): PosSaleRecord | undefined {
  if (value === null || typeof value !== "object") {
    return undefined;
  }
  const sale = value as PosSaleRecord;
  return sale.prepared && typeof sale.prepared.transactionId === "string" ? { ...sale } : undefined;
}

function asReceipt(value: unknown): ReceiptSnapshot | undefined {
  if (value === null || typeof value !== "object") {
    return undefined;
  }
  const receipt = value as ReceiptSnapshot;
  return typeof receipt.id === "string" && typeof receipt.transactionId === "string" ? receipt : undefined;
}

function asPendingStatus(value: unknown): PendingOperation["status"] | undefined {
  if (
    value === "pending" ||
    value === "sent" ||
    value === "response_unknown" ||
    value === "acknowledged" ||
    value === "requires_attention"
  ) {
    return value;
  }
  return undefined;
}

function constraintName(body: unknown): string {
  if (body === null || typeof body !== "object") {
    return "";
  }
  const data = body as Record<string, unknown>;
  return `${String(data.code ?? "")} ${String(data.message ?? "")} ${String(data.details ?? "")}`.toLowerCase();
}

function errorMessage(body: unknown): string {
  if (body === null || typeof body !== "object") {
    return "";
  }
  const data = body as Record<string, unknown>;
  return String(data.message ?? data.details ?? "").toLowerCase();
}

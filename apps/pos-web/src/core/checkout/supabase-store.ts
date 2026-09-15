import type {
  CommandContext,
  PendingOperation,
  PrepareSaleRequest,
  Quote,
  ReceiptSnapshot,
  Uuid,
} from "../../../../../docs/contracts/domain.generated";
import type { PosRestFetch } from "../../server/http/server-fetch";
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
} from "./types";

export type SupabaseCheckoutStoreOptions = {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
};

export type StoredQuoteSnapshot = {
  readonly organizationId: string;
  readonly locationName: string;
  readonly quote: Quote;
};

export interface QuoteSnapshotStore {
  save(organizationId: string, quote: Quote): Promise<void>;
  get(organizationId: string, quoteId: string): Promise<StoredQuoteSnapshot | undefined>;
}

export type PrepareIntent = {
  readonly organizationId: string;
  readonly locationId: string;
  readonly registerId: string;
  readonly shiftId: Uuid;
  readonly deviceId: Uuid;
  readonly cashierId: string;
  readonly cashierName: string;
  readonly request: PrepareSaleRequest;
  readonly context: CommandContext;
  readonly createdAt: string;
};

export interface PrepareIntentStore {
  save(intent: PrepareIntent): Promise<void>;
  get(transactionId: Uuid): Promise<PrepareIntent | undefined>;
}

const DEFAULT_TIMEOUT_MS = 5_000;

type StoreClient = {
  readonly base: string;
  readonly headers: Record<string, string>;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs: number;
};

export function createSupabaseCheckoutStore(options: SupabaseCheckoutStoreOptions): CheckoutStore {
  const client = createClient(options);
  const chains = new Map<string, Promise<void>>();

  const store: CheckoutStore = {
    failNextReceiptWrite: false,
    failNextPaymentWrite: false,
    failNextSaleWrite: false,
    failNextCommercialConfirmedWrite: false,
    receiptWriteAttempts: 0,

    async withLock(key, fn) {
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
    },

    async seedRegister(register) {
      await upsert(client, "pos_registers?on_conflict=id", {
        id: register.id,
        organization_id: register.organizationId,
        location_id: register.locationId,
        name: register.name,
        currency: register.currency,
        status: register.status,
      });
    },

    async seedDevice(device) {
      await upsert(client, "pos_devices?on_conflict=id", {
        id: device.id,
        organization_id: device.organizationId,
        location_id: device.locationId,
        label: device.id,
        status: device.status,
      });
    },

    async getRegister(id) {
      const row = await readOne<Record<string, unknown>>(
        client,
        `pos_registers?id=eq.${enc(id)}&select=id,organization_id,location_id,name,currency,status`,
      );
      return row ? mapRegister(row) : undefined;
    },

    async getDevice(id) {
      const row = await readOne<Record<string, unknown>>(
        client,
        `pos_devices?id=eq.${enc(id)}&select=id,organization_id,location_id,status`,
      );
      return row ? mapDevice(row) : undefined;
    },

    async getActiveShift(registerId) {
      const row = await readOne<Record<string, unknown>>(
        client,
        `pos_shifts?register_id=eq.${enc(registerId)}&status=in.(open,closing)&order=opened_at.desc&limit=1&select=*`,
      );
      return row ? mapShift(row) : undefined;
    },

    async getShift(id) {
      const row = await readOne<Record<string, unknown>>(
        client,
        `pos_shifts?id=eq.${enc(id)}&limit=1&select=*`,
      );
      return row ? mapShift(row) : undefined;
    },

    async insertOpenShift(shift) {
      const value = await rpc<string>(client, "pos_checkout_open_shift", {
        p_shift_id: shift.id,
        p_organization_id: shift.organizationId,
        p_location_id: shift.locationId,
        p_register_id: shift.registerId,
        p_device_id: shift.deviceId,
        p_cashier_id: shift.cashierId,
        p_opening_minor: shift.openingFloat.minor,
        p_currency: shift.openingFloat.currency,
        p_opened_at: shift.openedAt,
      });
      return value === "ok" ? "ok" : "conflict";
    },

    async appendCashMovement(movement) {
      if (movement.kind !== "cash_sale" || !movement.transactionId) {
        throw new Error("durable checkout store only accepts internal cash_sale through this path");
      }
      const shift = await store.getShift(movement.shiftId);
      if (!shift) {
        return "shift_required";
      }
      const value = await rpc<string>(client, "pos_checkout_record_cash_sale", {
        p_movement_id: movement.id,
        p_organization_id: movement.organizationId,
        p_location_id: shift.locationId,
        p_register_id: shift.registerId,
        p_shift_id: movement.shiftId,
        p_actor_id: movement.actorId,
        p_transaction_id: movement.transactionId,
        p_amount_minor: movement.signedAmount.minor,
        p_currency: movement.signedAmount.currency,
        p_created_at: movement.createdAt,
      });
      if (value === "ok" || value === "duplicate_sale" || value === "shift_required" || value === "negative_expected") {
        return value;
      }
      throw new Error("cash ledger RPC returned an invalid result");
    },

    async listCashSales(transactionId) {
      const rows = await readMany<Record<string, unknown>>(
        client,
        `pos_cash_movements?kind=eq.cash_sale&transaction_id=eq.${enc(transactionId)}&order=created_at.asc&select=*`,
      );
      return rows.map(mapCashMovement);
    },

    async expectedCash(shiftId) {
      const row = await readOne<Record<string, unknown>>(
        client,
        `pos_shifts?id=eq.${enc(shiftId)}&limit=1&select=expected_cash_minor,expected_cash_currency`,
      );
      if (!row) return undefined;
      return { minor: numberValue(row.expected_cash_minor), currency: stringValue(row.expected_cash_currency) };
    },

    async seedPreparedSale(input) {
      const record: PosSaleRecord = { ...input, status: "prepared", commercialConfirmed: false };
      await saveSaleRecord(client, record);
      return record;
    },

    async getSale(transactionId) {
      const row = await readOne<Record<string, unknown>>(
        client,
        `pos_checkout_sales?transaction_id=eq.${enc(transactionId)}&limit=1&select=record`,
      );
      return row && isRecord(row.record) ? (row.record as unknown as PosSaleRecord) : undefined;
    },

    async saveSale(sale) {
      if (store.failNextSaleWrite) {
        store.failNextSaleWrite = false;
        throw new Error("injected POS sale persistence failure");
      }
      if (sale.commercialConfirmed && store.failNextCommercialConfirmedWrite) {
        store.failNextCommercialConfirmedWrite = false;
        throw new Error("injected POS commercial-confirmed persistence failure");
      }
      await saveSaleRecord(client, sale);
    },

    async getPayment(paymentId) {
      const row = await readOne<Record<string, unknown>>(
        client,
        `pos_checkout_payments?payment_id=eq.${enc(paymentId)}&limit=1&select=record`,
      );
      return row && isRecord(row.record) ? (row.record as unknown as StoredPayment) : undefined;
    },

    async getPaymentForTransaction(transactionId) {
      const row = await readOne<Record<string, unknown>>(
        client,
        `pos_checkout_payments?transaction_id=eq.${enc(transactionId)}&limit=1&select=record`,
      );
      return row && isRecord(row.record) ? (row.record as unknown as StoredPayment) : undefined;
    },

    async savePayment(payment) {
      if (store.failNextPaymentWrite) {
        store.failNextPaymentWrite = false;
        throw new Error("injected POS payment persistence failure");
      }
      await upsert(client, "pos_checkout_payments?on_conflict=transaction_id", {
        payment_id: payment.paymentId,
        transaction_id: payment.transactionId,
        organization_id: await organizationForTransaction(client, payment.transactionId),
        sale_id: payment.saleId,
        evidence_id: payment.evidenceId,
        amount_minor: payment.amount.minor,
        currency: payment.amount.currency,
        cash_received_minor: payment.cashReceived.minor,
        cash_received_currency: payment.cashReceived.currency,
        verified_at: payment.verifiedAt,
        actor_id: payment.actorId,
        record: payment,
      });
    },

    async getReceipt(transactionId) {
      const row = await readOne<Record<string, unknown>>(
        client,
        `pos_checkout_receipts?transaction_id=eq.${enc(transactionId)}&limit=1&select=snapshot`,
      );
      return row && isRecord(row.snapshot) ? (row.snapshot as unknown as ReceiptSnapshot) : undefined;
    },

    async saveReceipt(receipt) {
      store.receiptWriteAttempts += 1;
      if (store.failNextReceiptWrite) {
        store.failNextReceiptWrite = false;
        throw new Error("injected POS receipt persistence failure");
      }
      const existing = await store.getReceipt(receipt.transactionId);
      if (existing && existing.id !== receipt.id) {
        return "duplicate";
      }
      await upsert(client, "pos_checkout_receipts?on_conflict=transaction_id", {
        transaction_id: receipt.transactionId,
        organization_id: await organizationForTransaction(client, receipt.transactionId),
        receipt_id: receipt.id,
        snapshot: receipt,
      });
      return "ok";
    },

    async enqueueOutbox(event) {
      await insert(client, "pos_outbox_events", {
        id: event.id,
        organization_id: event.organizationId,
        aggregate_type: event.aggregateType,
        aggregate_id: event.aggregateId,
        event_type: event.eventType,
        payload: event.payload,
        created_at: event.createdAt,
        published_at: event.publishedAt ?? null,
      });
    },

    async listOutbox(aggregateId) {
      const rows = await readMany<Record<string, unknown>>(
        client,
        `pos_outbox_events?aggregate_id=eq.${enc(aggregateId)}&order=created_at.asc&select=id,organization_id,aggregate_type,aggregate_id,event_type,payload,created_at,published_at`,
      );
      return rows.map(mapOutbox);
    },

    async claimIdempotency(organizationId, operation, idempotencyKey, requestHash) {
      const value = await rpc<Record<string, unknown>>(client, "pos_checkout_claim_idempotency", {
        p_organization_id: organizationId,
        p_operation: operation,
        p_idempotency_key: idempotencyKey,
        p_request_hash: requestHash,
      });
      return mapClaim(value);
    },

    async markIdempotencySent(organizationId, operation, idempotencyKey) {
      await patchIdempotency(client, organizationId, operation, idempotencyKey, { status: "sent", updated_at: new Date().toISOString() });
    },

    async acknowledgeIdempotency(organizationId, operation, idempotencyKey, outcome) {
      await patchIdempotency(client, organizationId, operation, idempotencyKey, {
        status: "acknowledged",
        outcome,
        updated_at: new Date().toISOString(),
      });
    },

    async markIdempotencyRequiresAttention(organizationId, operation, idempotencyKey, outcome) {
      await patchIdempotency(client, organizationId, operation, idempotencyKey, {
        status: "requires_attention",
        outcome,
        updated_at: new Date().toISOString(),
      });
    },

    async releaseIdempotency(organizationId, operation, idempotencyKey) {
      await patch(
        client,
        `pos_checkout_idempotency?organization_id=eq.${enc(organizationId)}&operation=eq.${enc(operation)}&idempotency_key=eq.${enc(idempotencyKey)}&status=eq.sent`,
        { status: "pending", updated_at: new Date().toISOString() },
      );
    },

    async peekIdempotency(organizationId, operation, idempotencyKey) {
      const row = await readOne<Record<string, unknown>>(
        client,
        `pos_checkout_idempotency?organization_id=eq.${enc(organizationId)}&operation=eq.${enc(operation)}&idempotency_key=eq.${enc(idempotencyKey)}&limit=1&select=status`,
      );
      const status = row?.status;
      return isPendingStatus(status) ? status : undefined;
    },
  };

  return store;
}

export function createSupabaseQuoteSnapshotStore(options: SupabaseCheckoutStoreOptions): QuoteSnapshotStore {
  const client = createClient(options);
  return {
    async save(organizationId, quote) {
      const location = await readOne<Record<string, unknown>>(
        client,
        `pos_locations?id=eq.${enc(quote.locationId)}&organization_id=eq.${enc(organizationId)}&limit=1&select=name`,
      );
      await upsert(client, "pos_checkout_quotes?on_conflict=organization_id,quote_id", {
        organization_id: organizationId,
        quote_id: quote.id,
        location_id: quote.locationId,
        location_name: location ? stringValue(location.name) : quote.locationId,
        fingerprint: quote.fingerprint,
        snapshot: quote,
        expires_at: quote.expiresAt,
      });
    },
    async get(organizationId, quoteId) {
      const row = await readOne<Record<string, unknown>>(
        client,
        `pos_checkout_quotes?organization_id=eq.${enc(organizationId)}&quote_id=eq.${enc(quoteId)}&limit=1&select=organization_id,location_name,snapshot`,
      );
      if (!row || !isRecord(row.snapshot)) return undefined;
      return {
        organizationId: stringValue(row.organization_id),
        locationName: stringValue(row.location_name),
        quote: row.snapshot as unknown as Quote,
      };
    },
  };
}

export function createSupabasePrepareIntentStore(options: SupabaseCheckoutStoreOptions): PrepareIntentStore {
  const client = createClient(options);
  return {
    async save(intent) {
      await upsert(client, "pos_checkout_prepare_intents?on_conflict=transaction_id", {
        transaction_id: intent.request.transactionId,
        organization_id: intent.organizationId,
        location_id: intent.locationId,
        register_id: intent.registerId,
        shift_id: intent.shiftId,
        device_id: intent.deviceId,
        cashier_id: intent.cashierId,
        cashier_name: intent.cashierName,
        quote_id: intent.request.quoteId,
        quote_fingerprint: intent.request.quoteFingerprint,
        request: intent.request,
        idempotency_key: intent.context.idempotencyKey,
        correlation_id: intent.context.correlationId,
        created_at: intent.createdAt,
      });
    },
    async get(transactionId) {
      const row = await readOne<Record<string, unknown>>(
        client,
        `pos_checkout_prepare_intents?transaction_id=eq.${enc(transactionId)}&limit=1&select=*`,
      );
      if (!row || !isRecord(row.request)) return undefined;
      return {
        organizationId: stringValue(row.organization_id),
        locationId: stringValue(row.location_id),
        registerId: stringValue(row.register_id),
        shiftId: stringValue(row.shift_id),
        deviceId: stringValue(row.device_id),
        cashierId: stringValue(row.cashier_id),
        cashierName: stringValue(row.cashier_name),
        request: row.request as unknown as PrepareSaleRequest,
        context: {
          idempotencyKey: stringValue(row.idempotency_key),
          correlationId: stringValue(row.correlation_id),
        },
        createdAt: stringValue(row.created_at),
      };
    },
  };
}

export function createMemoryQuoteSnapshotStore(): QuoteSnapshotStore {
  const rows = new Map<string, StoredQuoteSnapshot>();
  return {
    async save(organizationId, quote) {
      rows.set(`${organizationId}\0${quote.id}`, { organizationId, locationName: quote.locationId, quote });
    },
    async get(organizationId, quoteId) {
      return rows.get(`${organizationId}\0${quoteId}`);
    },
  };
}

export function createMemoryPrepareIntentStore(): PrepareIntentStore {
  const rows = new Map<Uuid, PrepareIntent>();
  return {
    async save(intent) {
      rows.set(intent.request.transactionId, intent);
    },
    async get(transactionId) {
      return rows.get(transactionId);
    },
  };
}

function createClient(options: SupabaseCheckoutStoreOptions): StoreClient {
  return {
    base: `${options.url.replace(/\/+$/, "")}/rest/v1`,
    headers: {
      apikey: options.serviceRoleKey,
      Authorization: `Bearer ${options.serviceRoleKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
}

async function saveSaleRecord(client: StoreClient, sale: PosSaleRecord): Promise<void> {
  await upsert(client, "pos_checkout_sales?on_conflict=transaction_id", {
    transaction_id: sale.prepared.transactionId,
    organization_id: sale.organizationId,
    location_id: sale.locationId,
    register_id: sale.registerId,
    shift_id: sale.shiftId,
    device_id: sale.deviceId,
    cashier_id: sale.cashierId,
    sale_id: sale.prepared.saleId,
    order_reference: sale.prepared.orderReference,
    quote_fingerprint: sale.prepared.quoteFingerprint,
    total_minor: sale.prepared.total.minor,
    currency: sale.prepared.total.currency,
    status: sale.status,
    assigned_payment_id: sale.assignedPaymentId ?? null,
    commercial_confirmed: sale.commercialConfirmed,
    record: sale,
    updated_at: new Date().toISOString(),
  });
}

async function organizationForTransaction(client: StoreClient, transactionId: Uuid): Promise<string> {
  const row = await readOne<Record<string, unknown>>(
    client,
    `pos_checkout_sales?transaction_id=eq.${enc(transactionId)}&limit=1&select=organization_id`,
  );
  if (!row) throw new Error("checkout sale scope not found");
  return stringValue(row.organization_id);
}

async function patchIdempotency(
  client: StoreClient,
  organizationId: string,
  operation: PendingOperation["operation"],
  idempotencyKey: Uuid,
  body: Record<string, unknown>,
): Promise<void> {
  await patch(
    client,
    `pos_checkout_idempotency?organization_id=eq.${enc(organizationId)}&operation=eq.${enc(operation)}&idempotency_key=eq.${enc(idempotencyKey)}`,
    body,
  );
}

function mapRegister(row: Record<string, unknown>): StoredRegister {
  return {
    id: stringValue(row.id),
    organizationId: stringValue(row.organization_id),
    locationId: stringValue(row.location_id),
    name: stringValue(row.name),
    currency: stringValue(row.currency),
    status: stringValue(row.status) as StoredRegister["status"],
  };
}

function mapDevice(row: Record<string, unknown>): StoredDevice {
  return {
    id: stringValue(row.id),
    organizationId: stringValue(row.organization_id),
    locationId: stringValue(row.location_id),
    status: stringValue(row.status) as StoredDevice["status"],
  };
}

function mapShift(row: Record<string, unknown>): StoredShift {
  const openingCurrency = stringValue(row.opening_float_currency);
  const expectedCurrency = stringValue(row.expected_cash_currency);
  const countedMinor = nullableNumber(row.counted_cash_minor);
  const varianceMinor = nullableNumber(row.variance_minor);
  return {
    id: stringValue(row.id),
    organizationId: stringValue(row.organization_id),
    locationId: stringValue(row.location_id),
    registerId: stringValue(row.register_id),
    deviceId: stringValue(row.device_id),
    cashierId: stringValue(row.cashier_id),
    status: stringValue(row.status) as StoredShift["status"],
    openingFloat: { minor: numberValue(row.opening_float_minor), currency: openingCurrency },
    expectedCash: { minor: numberValue(row.expected_cash_minor), currency: expectedCurrency },
    ...(countedMinor === undefined ? {} : { countedCash: { minor: countedMinor, currency: stringValue(row.counted_cash_currency) } }),
    ...(varianceMinor === undefined ? {} : { variance: { minor: varianceMinor, currency: stringValue(row.variance_currency) } }),
    openedAt: stringValue(row.opened_at),
    ...(row.closed_at ? { closedAt: stringValue(row.closed_at) } : {}),
    ...(row.z_report_id ? { zReportId: stringValue(row.z_report_id) } : {}),
  };
}

function mapCashMovement(row: Record<string, unknown>): StoredCashMovement {
  return {
    id: stringValue(row.id),
    organizationId: stringValue(row.organization_id),
    shiftId: stringValue(row.shift_id),
    kind: stringValue(row.kind) as StoredCashMovement["kind"],
    signedAmount: { minor: numberValue(row.signed_amount_minor), currency: stringValue(row.currency) },
    actorId: stringValue(row.actor_id),
    createdAt: stringValue(row.created_at),
    ...(row.transaction_id ? { transactionId: stringValue(row.transaction_id) } : {}),
    ...(row.reason ? { reason: stringValue(row.reason) } : {}),
  };
}

function mapOutbox(row: Record<string, unknown>): OutboxEvent {
  return {
    id: stringValue(row.id),
    organizationId: stringValue(row.organization_id),
    aggregateType: stringValue(row.aggregate_type),
    aggregateId: stringValue(row.aggregate_id),
    eventType: stringValue(row.event_type),
    payload: isRecord(row.payload) ? mapStringRecord(row.payload) : {},
    createdAt: stringValue(row.created_at),
    ...(row.published_at ? { publishedAt: stringValue(row.published_at) } : {}),
  };
}

function mapClaim(value: Record<string, unknown>): IdempotencyClaim {
  const kind = value.kind;
  if (kind === "acquired" || kind === "in_progress" || kind === "conflict") return { kind };
  if (kind === "replay" || kind === "repair") return { kind, outcome: value.outcome };
  throw new Error("checkout idempotency RPC returned an invalid claim");
}

async function readOne<T>(client: StoreClient, path: string): Promise<T | undefined> {
  const rows = await readMany<T>(client, path);
  return rows[0];
}

async function readMany<T>(client: StoreClient, path: string): Promise<T[]> {
  const response = await client.fetchImpl(`${client.base}/${path}`, {
    method: "GET",
    headers: client.headers,
    signal: AbortSignal.timeout(client.timeoutMs),
  });
  if (!response.ok) throw new Error(`Supabase checkout read failed (${response.status})`);
  const value = await response.json();
  if (!Array.isArray(value)) throw new Error("Supabase checkout read returned a non-array payload");
  return value as T[];
}

async function insert(client: StoreClient, path: string, body: Record<string, unknown>): Promise<void> {
  const response = await client.fetchImpl(`${client.base}/${path}`, {
    method: "POST",
    headers: { ...client.headers, Prefer: "return=minimal" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(client.timeoutMs),
  });
  if (!response.ok) throw new Error(`Supabase checkout insert failed (${response.status})`);
}

async function upsert(client: StoreClient, path: string, body: Record<string, unknown>): Promise<void> {
  const response = await client.fetchImpl(`${client.base}/${path}`, {
    method: "POST",
    headers: { ...client.headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(client.timeoutMs),
  });
  if (!response.ok) throw new Error(`Supabase checkout upsert failed (${response.status})`);
}

async function patch(client: StoreClient, path: string, body: Record<string, unknown>): Promise<void> {
  const response = await client.fetchImpl(`${client.base}/${path}`, {
    method: "PATCH",
    headers: { ...client.headers, Prefer: "return=minimal" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(client.timeoutMs),
  });
  if (!response.ok) throw new Error(`Supabase checkout update failed (${response.status})`);
}

async function rpc<T>(client: StoreClient, name: string, body: Record<string, unknown>): Promise<T> {
  const response = await client.fetchImpl(`${client.base}/rpc/${name}`, {
    method: "POST",
    headers: client.headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(client.timeoutMs),
  });
  if (!response.ok) throw new Error(`Supabase checkout RPC ${name} failed (${response.status})`);
  return (await response.json()) as T;
}

function enc(value: string): string {
  return encodeURIComponent(value);
}

function stringValue(value: unknown): string {
  if (typeof value !== "string") throw new Error("Supabase checkout row contains a non-string field");
  return value;
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  throw new Error("Supabase checkout row contains an invalid integer");
}

function nullableNumber(value: unknown): number | undefined {
  return value === null || value === undefined ? undefined : numberValue(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mapStringRecord(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item)]));
}

function isPendingStatus(value: unknown): value is PendingOperation["status"] {
  return value === "pending" || value === "sent" || value === "response_unknown" || value === "acknowledged" || value === "requires_attention";
}

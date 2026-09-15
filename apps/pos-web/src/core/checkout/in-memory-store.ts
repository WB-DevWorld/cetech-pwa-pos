import type { Id, PendingOperation, Quote, ReceiptSnapshot, Uuid } from "../../../../../docs/contracts/domain.generated";
import type {
  CommandScopeBinding,
  FaultInjectingCheckoutStore,
  OutboxEvent,
  PosSaleRecord,
  StoredCashMovement,
  StoredDevice,
  StoredPayment,
  StoredRegister,
  StoredShift,
} from "./types";

type IdempotencyRow = {
  readonly organizationId: Id;
  readonly operation: PendingOperation["operation"];
  readonly idempotencyKey: Uuid;
  requestHash: string;
  status: PendingOperation["status"];
  outcome?: unknown;
  locationId?: Id;
  registerId?: Id;
  shiftId?: Uuid;
  transactionId?: Uuid;
};

function idempKey(organizationId: Id, operation: PendingOperation["operation"], key: Uuid): string {
  return `${organizationId}\0${operation}\0${key}`;
}

function scopeKey(operation: PendingOperation["operation"], transactionId: Uuid): string {
  return `${operation}\0${transactionId}`;
}

export function createInMemoryCheckoutStore(): FaultInjectingCheckoutStore {
  const registers = new Map<Id, StoredRegister>();
  const devices = new Map<Uuid, StoredDevice>();
  const shifts = new Map<Uuid, StoredShift>();
  const activeByRegister = new Map<Id, Uuid>();
  const movements: StoredCashMovement[] = [];
  const quotes = new Map<Id, Quote>();
  const sales = new Map<Uuid, PosSaleRecord>();
  const payments = new Map<Uuid, StoredPayment>();
  const paymentsByTx = new Map<Uuid, Uuid>();
  const receipts = new Map<Uuid, ReceiptSnapshot>();
  const outbox: OutboxEvent[] = [];
  const idempotency = new Map<string, IdempotencyRow>();
  const scopeByTransaction = new Map<string, CommandScopeBinding>();
  const chains = new Map<string, Promise<void>>();

  const store: FaultInjectingCheckoutStore = {
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
      chains.set(
        key,
        previous.then(() => gate),
      );
      await previous;
      try {
        return await fn();
      } finally {
        release();
      }
    },

    async seedRegister(register) {
      registers.set(register.id, register);
    },

    async seedDevice(device) {
      devices.set(device.id, device);
    },

    async getRegister(id) {
      return registers.get(id);
    },

    async getDevice(id) {
      return devices.get(id);
    },

    async getActiveShift(registerId) {
      const shiftId = activeByRegister.get(registerId);
      return shiftId ? shifts.get(shiftId) : undefined;
    },

    async getShift(id) {
      return shifts.get(id);
    },

    async insertOpenShift(shift) {
      if (activeByRegister.has(shift.registerId)) {
        return "conflict";
      }
      shifts.set(shift.id, shift);
      activeByRegister.set(shift.registerId, shift.id);
      return "ok";
    },

    async appendCashMovement(movement) {
      const shift = shifts.get(movement.shiftId);
      if (!shift || shift.status !== "open") {
        return "shift_required";
      }
      if (movement.kind === "cash_sale" && movement.transactionId) {
        const duplicate = movements.some(
          (row) => row.kind === "cash_sale" && row.transactionId === movement.transactionId,
        );
        if (duplicate) {
          return "duplicate_sale";
        }
      }
      if (movement.kind !== "opening_float") {
        const next = (shift.expectedCash?.minor ?? 0) + movement.signedAmount.minor;
        if (next < 0) {
          return "negative_expected";
        }
        shifts.set(shift.id, {
          ...shift,
          expectedCash: { minor: next, currency: shift.openingFloat.currency },
        });
      }
      movements.push(movement);
      return "ok";
    },

    async listCashSales(transactionId) {
      return movements.filter((row) => row.kind === "cash_sale" && row.transactionId === transactionId);
    },

    async expectedCash(shiftId) {
      return shifts.get(shiftId)?.expectedCash;
    },

    async saveQuote(quote) {
      quotes.set(quote.id, quote);
    },

    async getQuote(quoteId) {
      return quotes.get(quoteId);
    },

    async seedPreparedSale(input) {
      const record: PosSaleRecord = {
        ...input,
        status: "prepared",
        commercialConfirmed: false,
      };
      sales.set(input.prepared.transactionId, record);
      return record;
    },

    async getSale(transactionId) {
      const row = sales.get(transactionId);
      return row ? { ...row } : undefined;
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
      sales.set(sale.prepared.transactionId, { ...sale });
    },

    async getPayment(paymentId) {
      return payments.get(paymentId);
    },

    async getPaymentForTransaction(transactionId) {
      const paymentId = paymentsByTx.get(transactionId);
      return paymentId ? payments.get(paymentId) : undefined;
    },

    async savePayment(payment) {
      if (store.failNextPaymentWrite) {
        store.failNextPaymentWrite = false;
        throw new Error("injected POS payment persistence failure");
      }
      payments.set(payment.paymentId, payment);
      paymentsByTx.set(payment.transactionId, payment.paymentId);
    },

    async getReceipt(transactionId) {
      return receipts.get(transactionId);
    },

    async saveReceipt(receipt) {
      store.receiptWriteAttempts += 1;
      if (store.failNextReceiptWrite) {
        store.failNextReceiptWrite = false;
        throw new Error("injected POS receipt persistence failure");
      }
      const existing = receipts.get(receipt.transactionId);
      if (existing && existing.id !== receipt.id) {
        return "duplicate";
      }
      receipts.set(receipt.transactionId, receipt);
      return "ok";
    },

    async enqueueOutbox(event) {
      outbox.push(event);
    },

    async listOutbox(aggregateId) {
      return outbox.filter((event) => event.aggregateId === aggregateId);
    },

    async lookupCommandScope(input) {
      return scopeByTransaction.get(scopeKey(input.operation, input.transactionId));
    },

    async claimIdempotency(organizationId, operation, idempotencyKey, requestHash, locationId, scope) {
      const key = idempKey(organizationId, operation, idempotencyKey);
      const row = idempotency.get(key);
      if (!row) {
        const created: IdempotencyRow = {
          organizationId,
          operation,
          idempotencyKey,
          requestHash,
          status: "pending",
          locationId,
          registerId: scope?.registerId,
          shiftId: scope?.shiftId,
          transactionId: scope?.transactionId,
        };
        idempotency.set(key, created);
        if (scope?.transactionId && locationId) {
          const boundKey = scopeKey(operation, scope.transactionId);
          if (!scopeByTransaction.has(boundKey)) {
            scopeByTransaction.set(boundKey, {
              organizationId,
              locationId,
              registerId: scope.registerId,
              shiftId: scope.shiftId,
              transactionId: scope.transactionId,
              operation,
            });
          }
        }
        return { kind: "acquired" };
      }
      if (row.requestHash !== requestHash) {
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
    },

    async markIdempotencySent(organizationId, operation, idempotencyKey) {
      const row = idempotency.get(idempKey(organizationId, operation, idempotencyKey));
      if (row) {
        row.status = "sent";
      }
    },

    async acknowledgeIdempotency(organizationId, operation, idempotencyKey, outcome) {
      const row = idempotency.get(idempKey(organizationId, operation, idempotencyKey));
      if (row) {
        row.status = "acknowledged";
        row.outcome = outcome;
      }
    },

    async markIdempotencyRequiresAttention(organizationId, operation, idempotencyKey, outcome) {
      const row = idempotency.get(idempKey(organizationId, operation, idempotencyKey));
      if (row) {
        row.status = "requires_attention";
        row.outcome = outcome;
      }
    },

    async releaseIdempotency(organizationId, operation, idempotencyKey) {
      const row = idempotency.get(idempKey(organizationId, operation, idempotencyKey));
      if (row && row.status === "sent") {
        row.status = "pending";
      }
    },

    async peekIdempotency(organizationId, operation, idempotencyKey) {
      return idempotency.get(idempKey(organizationId, operation, idempotencyKey))?.status;
    },
  };

  return store;
}

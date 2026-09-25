import type { CheckoutStageView, PreparedSaleView } from "../state/checkoutSession";
import type { PosLocalDatabase } from "../../../local/pos-local-db";

const STORAGE_KEY = "checkout.active-business-attempt";

export type CheckoutAttemptRecord = {
  readonly transactionId: string;
  readonly quoteId: string;
  readonly quoteFingerprint: string;
  readonly quoteTotalMinor: number;
  readonly currency: string;
  readonly registerId: string;
  readonly shiftId: string;
  readonly deviceId: string;
  readonly prepareKey: string;
  readonly prepareCorrelationId: string;
  readonly cashKey: string;
  readonly cashCorrelationId: string;
  readonly finalizeKey: string;
  readonly finalizeCorrelationId: string;
  readonly cancelKey?: string;
  readonly cancelCorrelationId?: string;
  readonly paymentId?: string;
  readonly prepared?: PreparedSaleView;
  readonly stage: CheckoutStageView;
  readonly saleCompleted: boolean;
  readonly message: string;
};

const memory = new Map<string, CheckoutAttemptRecord | null>();

export type CheckoutAttemptStore = {
  readonly readSync: () => CheckoutAttemptRecord | null;
  readonly hydrate: () => Promise<CheckoutAttemptRecord | null>;
  readonly write: (record: CheckoutAttemptRecord) => void;
  readonly clear: () => void;
};

/** Drops the in-process copy so the next read comes from IndexedDB. */
export function discardCheckoutAttemptMemory(dbName: string): void {
  memory.delete(dbName);
}

export function createCheckoutAttemptStore(db: PosLocalDatabase): CheckoutAttemptStore {
  const memoryKey = db.name;
  return {
    readSync() {
      return memory.get(memoryKey) ?? null;
    },
    async hydrate() {
      if (memory.has(memoryKey)) {
        return memory.get(memoryKey) ?? null;
      }
      const row = await db.kv.get(STORAGE_KEY);
      if (!row) {
        memory.set(memoryKey, null);
        return null;
      }
      try {
        const parsed = JSON.parse(row.value) as CheckoutAttemptRecord;
        memory.set(memoryKey, parsed);
        return parsed;
      } catch {
        memory.set(memoryKey, null);
        return null;
      }
    },
    write(record) {
      memory.set(memoryKey, record);
      void db.kv.put({ key: STORAGE_KEY, value: JSON.stringify(record) });
    },
    clear() {
      memory.set(memoryKey, null);
      void db.kv.delete(STORAGE_KEY);
    },
  };
}

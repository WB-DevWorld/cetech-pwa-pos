import { openPosLocalDatabase, type PosLocalDatabase } from "./pos-local-db";

const TENDER_PREFIX = "pwa.tender.";
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

type TenderLease = {
  readonly transactionId: string;
  readonly expiresAt: number;
};

export interface TenderActivityPort {
  markActive(transactionId: string): Promise<void>;
  clear(transactionId: string): Promise<void>;
}

export function createTenderActivityPort(
  db: PosLocalDatabase = openPosLocalDatabase(),
  now: () => number = () => Date.now(),
  ttlMs = DEFAULT_TTL_MS,
): TenderActivityPort {
  return {
    async markActive(transactionId: string) {
      const lease: TenderLease = { transactionId, expiresAt: now() + ttlMs };
      await db.kv.put({ key: `${TENDER_PREFIX}${transactionId}`, value: JSON.stringify(lease) });
    },
    async clear(transactionId: string) {
      await db.kv.delete(`${TENDER_PREFIX}${transactionId}`);
    },
  };
}

export async function hasActiveTender(
  db: PosLocalDatabase = openPosLocalDatabase(),
  now: number = Date.now(),
): Promise<boolean> {
  const rows = await db.kv.toArray();
  let active = false;
  await db.transaction("rw", db.kv, async () => {
    for (const row of rows) {
      if (!row.key.startsWith(TENDER_PREFIX)) continue;
      const lease = parseLease(row.value);
      if (!lease || lease.expiresAt <= now) {
        await db.kv.delete(row.key);
        continue;
      }
      active = true;
    }
  });
  return active;
}

function parseLease(value: string): TenderLease | null {
  try {
    const parsed = JSON.parse(value) as Partial<TenderLease>;
    return typeof parsed.transactionId === "string" && typeof parsed.expiresAt === "number"
      ? { transactionId: parsed.transactionId, expiresAt: parsed.expiresAt }
      : null;
  } catch {
    return null;
  }
}

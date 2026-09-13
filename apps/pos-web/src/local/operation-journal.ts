import type { OperationJournal } from "../../../../docs/contracts/ports";
import type { PendingOperation, Uuid } from "../../../../docs/contracts/domain.generated";
import { canonicalJson, sha256Hex } from "./canonical";
import { openPosLocalDatabase, type JournalRecord, type PosLocalDatabase } from "./pos-local-db";
import { assertJournalPayloadHasNoSecrets } from "./secrets-guard";

function toPending(record: JournalRecord): PendingOperation {
  const { payload, attemptHistory, ...pending } = record;
  void payload;
  void attemptHistory;
  return pending;
}

export function createOperationJournal(db: PosLocalDatabase = openPosLocalDatabase()): OperationJournal {
  return {
    async appendBeforeSend(operation: PendingOperation, versionedCommandPayload: string): Promise<void> {
      assertJournalPayloadHasNoSecrets(versionedCommandPayload);
      const expectedHash = await sha256Hex(canonicalJson(JSON.parse(versionedCommandPayload) as unknown));
      if (operation.requestHash !== expectedHash) {
        throw new Error("operation journal requestHash must match the canonical payload digest");
      }
      await db.transaction("rw", db.journal, async () => {
        const existingByKey = await db.journal
          .where("[operation+idempotencyKey]")
          .equals([operation.operation, operation.idempotencyKey])
          .first();
        if (existingByKey) {
          if (existingByKey.requestHash !== operation.requestHash) {
            throw new Error("IDEMPOTENCY_CONFLICT");
          }
          return;
        }
        const record: JournalRecord = {
          ...operation,
          payload: versionedCommandPayload,
          attemptHistory: [{ at: operation.createdAt, status: operation.status }],
        };
        await db.journal.add(record);
      });
    },
    async pending(): Promise<ReadonlyArray<PendingOperation>> {
      const rows = await db.journal.toArray();
      return rows.filter((row) => row.status !== "acknowledged").map(toPending);
    },
    async markSent(id: Uuid): Promise<void> {
      await transition(db, id, "sent");
    },
    async markResponseUnknown(id: Uuid): Promise<void> {
      await transition(db, id, "response_unknown");
    },
    async markAcknowledged(id: Uuid): Promise<void> {
      await transition(db, id, "acknowledged");
    },
    async markRequiresAttention(id: Uuid, reason: string): Promise<void> {
      await transition(db, id, "requires_attention", reason);
    },
  };
}

async function transition(
  db: PosLocalDatabase,
  id: Uuid,
  status: PendingOperation["status"],
  reason?: string,
): Promise<void> {
  const at = new Date().toISOString();
  await db.transaction("rw", db.journal, async () => {
    const current = await db.journal.get(id);
    if (!current) {
      throw new Error("journal operation not found");
    }
    const attempts = status === "sent" ? current.attempts + 1 : current.attempts;
    const next: JournalRecord = {
      ...current,
      status,
      attempts,
      lastAttemptAt: at,
      lastErrorCode: reason ?? current.lastErrorCode,
      attemptHistory: [...current.attemptHistory, { at, status, errorCode: reason }],
    };
    await db.journal.put(next);
  });
}

export async function loadJournalPayload(db: PosLocalDatabase, id: Uuid): Promise<string | undefined> {
  const row = await db.journal.get(id);
  return row?.payload;
}

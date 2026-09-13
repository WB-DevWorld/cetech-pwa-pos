import "fake-indexeddb/auto";
import { afterEach, describe, expect, test } from "vitest";
import type { PendingOperation } from "../../../docs/contracts/domain.generated";
import { canonicalJson, sha256Hex } from "../../../apps/pos-web/src/local/canonical";
import { createOperationJournal, loadJournalPayload } from "../../../apps/pos-web/src/local/operation-journal";
import { deletePosLocalDatabase, openPosLocalDatabase } from "../../../apps/pos-web/src/local/pos-local-db";

const DBS: string[] = [];

afterEach(async () => {
  await Promise.all(DBS.splice(0).map((name) => deletePosLocalDatabase(name)));
});

function uniqueDb() {
  const name = `cetech-pos-local-${crypto.randomUUID()}`;
  DBS.push(name);
  return openPosLocalDatabase(name);
}

async function operation(payload: Record<string, unknown>): Promise<{
  pending: PendingOperation;
  serialized: string;
}> {
  const serialized = JSON.stringify(payload);
  const requestHash = await sha256Hex(canonicalJson(payload));
  return {
    serialized,
    pending: {
      id: "44444444-4444-4444-8444-444444444444",
      transactionId: "55555555-5555-4555-8555-555555555555",
      operation: "sale.prepare",
      idempotencyKey: "66666666-6666-4666-8666-666666666666",
      requestHash,
      payloadVersion: "1.0.0",
      status: "pending",
      attempts: 0,
      createdAt: "2026-09-13T20:00:00.000Z",
    },
  };
}

describe("CORE-04 OperationJournal", () => {
  test("append-before-send survives close/reopen as unacknowledged intent", async () => {
    const name = `cetech-pos-local-${crypto.randomUUID()}`;
    DBS.push(name);
    const db = openPosLocalDatabase(name);
    const journal = createOperationJournal(db);
    const { pending, serialized } = await operation({
      kind: "sale.prepare",
      transactionId: "55555555-5555-4555-8555-555555555555",
      quoteId: "quote-synthetic",
    });
    await journal.appendBeforeSend(pending, serialized);
    db.close();
    const reopened = openPosLocalDatabase(name);
    const restored = createOperationJournal(reopened);
    const pendingRows = await restored.pending();
    expect(pendingRows).toHaveLength(1);
    expect(pendingRows[0]?.status).toBe("pending");
    expect(pendingRows[0]?.requestHash).toBe(pending.requestHash);
    expect(await loadJournalPayload(reopened, pending.id)).toBe(serialized);
  });

  test("identical idempotency keys reuse the existing pending row", async () => {
    const journal = createOperationJournal(uniqueDb());
    const first = await operation({ kind: "sale.prepare", n: 1 });
    await journal.appendBeforeSend(first.pending, first.serialized);
    await journal.appendBeforeSend(
      { ...first.pending, id: "77777777-7777-4777-8777-777777777777" },
      first.serialized,
    );
    expect(await journal.pending()).toHaveLength(1);
    expect((await journal.pending())[0]?.id).toBe(first.pending.id);
  });

  test("response_unknown and requires_attention remain after reload", async () => {
    const name = `cetech-pos-local-${crypto.randomUUID()}`;
    DBS.push(name);
    const db = openPosLocalDatabase(name);
    const journal = createOperationJournal(db);
    const { pending, serialized } = await operation({ kind: "sale.prepare" });
    await journal.appendBeforeSend(pending, serialized);
    await journal.markSent(pending.id);
    await journal.markResponseUnknown(pending.id);
    db.close();
    const afterUnknown = createOperationJournal(openPosLocalDatabase(name));
    expect((await afterUnknown.pending())[0]?.status).toBe("response_unknown");
    await afterUnknown.markRequiresAttention(pending.id, "INTEGRATION_UNAVAILABLE");
    expect((await afterUnknown.pending())[0]?.status).toBe("requires_attention");
    expect((await afterUnknown.pending())[0]?.lastErrorCode).toBe("INTEGRATION_UNAVAILABLE");
  });

  test("rejects privileged secrets in the journal payload", async () => {
    const journal = createOperationJournal(uniqueDb());
    const { pending } = await operation({ token: "x" });
    await expect(
      journal.appendBeforeSend(pending, JSON.stringify({ SUPABASE_SERVICE_ROLE_KEY: "leak" })),
    ).rejects.toThrow(/privileged secrets/);
  });
});

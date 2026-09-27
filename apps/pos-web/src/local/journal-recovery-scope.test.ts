import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, test } from "vitest";
import type { PendingOperation } from "../../../../docs/contracts/domain.generated";
import { JOURNAL_OPERATION_RECOVERY, UNKNOWN_ORGANIZATION_RECOVERY_COPY } from "./journal-recovery-scope";
import {
  hasBlockingLocalTransactionRecovery,
  loadLocalJournalAttentionItems,
} from "../app/attention-recovery";
import {
  POS_LOCAL_SCHEMA_V4,
  closePosLocalDatabase,
  deletePosLocalDatabase,
  openPosLocalDatabase,
} from "./pos-local-db";
import { listUnresolvedJournalRecords } from "./operation-journal";

const DBS: string[] = [];

afterEach(async () => {
  await Promise.all(DBS.splice(0).map(async (name) => {
    await closePosLocalDatabase(name);
    await deletePosLocalDatabase(name);
  }));
});

type Covered = (typeof JOURNAL_OPERATION_RECOVERY)[number]["operation"];
type MissingOperation = Exclude<PendingOperation["operation"], Covered>;
const everyOperationIsClassified: MissingOperation extends never ? true : MissingOperation = true;

describe("CAN-01 journal recovery classification", () => {
  test("classifies every frozen journal operation without blocking an unrelated register", () => {
    expect(everyOperationIsClassified).toBe(true);
    expect(JOURNAL_OPERATION_RECOVERY.length).toBe(15);
    for (const row of JOURNAL_OPERATION_RECOVERY) {
      expect(row.blocksUnrelatedRegister).toBe(false);
      expect(row.blocksMatchingRegister).toBe(true);
      expect(row.deviceRelevant).toBe(true);
    }
    expect(JOURNAL_OPERATION_RECOVERY.find((row) => row.operation === "sale.prepare")?.financialRisk).toBe(true);
    expect(JOURNAL_OPERATION_RECOVERY.find((row) => row.operation === "shift.open")?.financialRisk).toBe(false);
  });

  test("schema v5 keeps a v4 journal row and does not assign it to a cashier", async () => {
    const name = `cetech-pos-local-${crypto.randomUUID()}`;
    DBS.push(name);
    const payload = JSON.stringify({
      payloadVersion: "1.0.0",
      operation: "sale.prepare",
      transactionId: "55555555-5555-4555-8555-555555555555",
      request: { registerId: "reg_a", deviceId: "device-a" },
    });
    class Historic extends Dexie {
      constructor() {
        super(name);
        this.version(POS_LOCAL_SCHEMA_V4).stores({
          catalogItems: "id, parentId, kind, searchNormalized, tombstoned, sourceItemId, *searchGrams",
          barcodeIndex: "barcode",
          catalogMeta: "key",
          cartDrafts: "cartId, updatedAt",
          journal: "id, status, idempotencyKey, transactionId, operation, [operation+idempotencyKey]",
          customers: "id, searchNormalized",
          schemaMeta: "key",
          kv: "key",
        });
      }
    }
    const historic = new Historic();
    await historic.open();
    await historic.table("journal").add({
      id: "44444444-4444-4444-8444-444444444444",
      transactionId: "55555555-5555-4555-8555-555555555555",
      operation: "sale.prepare",
      idempotencyKey: "44444444-4444-4444-8444-444444444444",
      requestHash: "historic-hash",
      payloadVersion: "1.0.0",
      status: "response_unknown",
      attempts: 1,
      createdAt: "2026-09-20T22:10:14.444Z",
      payload,
      attemptHistory: [{ at: "2026-09-20T22:10:14.444Z", status: "response_unknown" }],
    });
    await historic.table("schemaMeta").put({ key: "schema", localSchema: POS_LOCAL_SCHEMA_V4, appBuild: "historic" });
    historic.close();

    const upgraded = openPosLocalDatabase(name);
    await upgraded.open();
    expect(await upgraded.journal.count()).toBe(1);
    const row = await upgraded.journal.get("44444444-4444-4444-8444-444444444444");
    expect(row?.status).toBe("response_unknown");
    expect(row?.idempotencyKey).toBe("44444444-4444-4444-8444-444444444444");
    expect(row?.recoveryScope?.registerId).toBe("reg_a");
    expect(row?.recoveryScope?.deviceId).toBe("device-a");
    expect(row?.recoveryScope?.createdByActorId).toBeUndefined();
    expect(row?.recoveryScope?.organizationId).toBeUndefined();
    const unresolved = await listUnresolvedJournalRecords(upgraded);
    expect(unresolved[0]?.scope.createdByActorId).toBeUndefined();
    expect(unresolved[0]?.scope.organizationId).toBeUndefined();
    expect(unresolved[0]?.scope.registerId).toBe("reg_a");
    const meta = await upgraded.schemaMeta.get("schema");
    expect(meta?.localSchema).toBe(5);
    const gate = await loadLocalJournalAttentionItems(
      undefined,
      { actorId: "cashier_now", registerId: "reg_other", organizationId: "org_signed_in" },
      upgraded,
    );
    expect(gate).toHaveLength(1);
    expect(gate[0]?.quarantine).toBe(true);
    expect(gate[0]?.summary).toBe(UNKNOWN_ORGANIZATION_RECOVERY_COPY);
    expect(gate[0]?.transactionId).toBeUndefined();
    expect(gate[0]?.resolveAllowed).toBe(false);
    expect(gate[0]?.summary).not.toContain("55555555-5555-4555-8555-555555555555");
    expect(gate[0]?.summary).not.toContain("reg_a");
    expect(gate[0]?.summary).not.toContain("device-a");
    expect(gate[0]?.summary).not.toContain("org_signed_in");
    expect(gate[0]?.summary).not.toMatch(/sale\.prepare/i);
    expect(hasBlockingLocalTransactionRecovery(gate)).toBe(true);
    const afterGate = await upgraded.journal.get("44444444-4444-4444-8444-444444444444");
    expect(afterGate?.status).toBe("response_unknown");
    expect(afterGate?.idempotencyKey).toBe("44444444-4444-4444-8444-444444444444");
    expect(afterGate?.recoveryScope?.organizationId).toBeUndefined();
  });
});

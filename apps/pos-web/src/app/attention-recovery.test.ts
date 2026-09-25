import "fake-indexeddb/auto";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ApiResult, PaymentPort, SalesPort } from "../../../../docs/contracts/ports";
import type { PaymentState, SaleResolution } from "../../../../docs/contracts/domain.generated";
import type { AttentionItemView } from "../ui/operational";
import {
  createAttentionRecoveryLock,
  hasBlockingLocalTransactionRecovery,
  loadLocalJournalAttentionItems,
  localRecoverySellBanner,
  mergeAttentionItems,
  recoverAttentionItem,
  runAttentionRecovery,
} from "./attention-recovery";
import {
  assessUpdateActivation,
  closePosLocalDatabase,
  createOperationJournal,
  createTenderActivityPort,
  deletePosLocalDatabase,
  hasActiveTender,
  listUnresolvedJournalRecords,
  openPosLocalDatabase,
} from "../local";
import { createStaffRuntimeController } from "../core/identity/staff-runtime";
import type { RegisterPort } from "../../../../docs/contracts/ports";
import { createBrowserCashCheckoutPorts, LOCAL_CHECKOUT_SCOPE } from "./checkout-client";

const TX = "11111111-1111-4111-8111-111111111077";
const PAYMENT = "22222222-2222-4222-8222-222222222077";
const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const DBS: string[] = [];

afterEach(async () => {
  await Promise.all(DBS.splice(0).map((name) => deletePosLocalDatabase(name)));
});

function uniqueDbName(): string {
  const name = `cetech-pos-r9-reload-${crypto.randomUUID()}`;
  DBS.push(name);
  return name;
}

function paymentOk(status: PaymentState["status"] = "pending"): ApiResult<PaymentState> {
  return {
    ok: true,
    correlationId: CORRELATION,
    data: {
      transactionId: TX,
      paymentId: PAYMENT,
      tender: "mobile_money",
      status,
      amount: { minor: 1000, currency: "GHS" },
      nextAction: status === "verified" ? "none" : "resolve",
      ...(status === "verified" ? { verifiedAt: "2026-09-19T12:00:00.000Z" as const } : {}),
    } as PaymentState,
  };
}

function saleOk(status: SaleResolution["status"] = "requires_attention"): ApiResult<SaleResolution> {
  return {
    ok: true,
    correlationId: CORRELATION,
    data: { transactionId: TX, status },
  };
}

const paymentItem: AttentionItemView = {
  id: `payment:${PAYMENT}`,
  title: "Payment awaiting verification",
  summary: "This payment is still being checked.",
  typeLabel: "payment",
  severity: "medium",
  transactionReference: "TX-PENDING-1",
  transactionId: TX,
  paymentId: PAYMENT,
  resolveAllowed: true,
  recoverKind: "payment",
};

const saleItem: AttentionItemView = {
  id: `sale:${TX}`,
  title: "Sale needs review",
  summary: "Resolve the existing transaction.",
  typeLabel: "sale",
  severity: "critical",
  transactionReference: "#attn",
  transactionId: TX,
  resolveAllowed: true,
  recoverKind: "sale",
};

const refundItem: AttentionItemView = {
  id: `operation:payment.refund:${TX}`,
  title: "Operation needs recovery",
  summary: "This operation needs manager or reconciliation review.",
  typeLabel: "operation",
  severity: "critical",
  transactionReference: TX,
  transactionId: TX,
  resolveAllowed: false,
  recoverKind: "return",
};

describe("UX-04 attention recovery identity", () => {
  test("reload rediscovers an ambiguous prepare only from the durable journal and resolves before the gate opens", async () => {
    const name = uniqueDbName();
    const firstDb = openPosLocalDatabase(name);
    const firstJournal = createOperationJournal(firstDb);
    const firstTenderActivity = createTenderActivityPort(firstDb);

    const firstPorts = createBrowserCashCheckoutPorts({
      fetchImpl: async () => {
        throw new TypeError("simulated lost prepare response");
      },
      scope: LOCAL_CHECKOUT_SCOPE,
      journal: firstJournal,
      tenderActivity: firstTenderActivity,
    });

    await firstPorts.checkout.prepare(
      {
        transactionId: TX,
        registerId: LOCAL_CHECKOUT_SCOPE.registerId,
        shiftId: LOCAL_CHECKOUT_SCOPE.shiftId,
        deviceId: LOCAL_CHECKOUT_SCOPE.deviceId,
        quoteId: "quote-reload",
        quoteFingerprint: "0123456789abcdef0123456789abcdef",
      },
      { idempotencyKey: "44444444-4444-4444-8444-444444444444", correlationId: CORRELATION },
    );

    expect((await firstJournal.pending())[0]?.status).toBe("response_unknown");
    expect(await hasActiveTender(firstDb)).toBe(true);

    await closePosLocalDatabase(name);

    // Simulate mounted runtime recreation: no old checkout controller or transaction state is retained.
    const reloadedDb = openPosLocalDatabase(name);
    const reloadedJournal = createOperationJournal(reloadedDb);
    const reloadedTenderActivity = createTenderActivityPort(reloadedDb);
    const recoveredItems = await loadLocalJournalAttentionItems(reloadedJournal);

    expect(recoveredItems).toHaveLength(1);
    expect(recoveredItems[0]).toMatchObject({
      recoverKind: "sale",
      transactionId: TX,
      resolveAllowed: true,
    });
    expect(hasBlockingLocalTransactionRecovery(recoveredItems)).toBe(true);

    const requestedUrls: string[] = [];
    const recoveryPorts = createBrowserCashCheckoutPorts({
      fetchImpl: async (input) => {
        requestedUrls.push(String(input));
        return new Response(
          JSON.stringify({
            ok: true,
            correlationId: CORRELATION,
            data: {
              transactionId: TX,
              status: "not_found",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
      scope: LOCAL_CHECKOUT_SCOPE,
      journal: reloadedJournal,
      tenderActivity: reloadedTenderActivity,
    });

    let afterRecoveryItems: readonly AttentionItemView[] = recoveredItems;
    const status = await runAttentionRecovery({
      item: recoveredItems[0]!,
      lock: createAttentionRecoveryLock(),
      ports: { payments: recoveryPorts.payments, sales: recoveryPorts.sales },
      reload: async () => {
        afterRecoveryItems = await loadLocalJournalAttentionItems(reloadedJournal);
      },
    });

    expect(status).toBe("attempted");
    expect(requestedUrls).toEqual([`/api/pos/v1/sales/${TX}`]);
    expect(await reloadedJournal.pending()).toHaveLength(0);
    expect(afterRecoveryItems).toHaveLength(0);
    expect(hasBlockingLocalTransactionRecovery(afterRecoveryItems)).toBe(false);
    const terminalTenderActive = await hasActiveTender(reloadedDb);
    expect(terminalTenderActive).toBe(false);
    const terminalUpdateDecision = assessUpdateActivation({
      activeTender: terminalTenderActive,
      criticalOperationCount: 0,
      syncMutationInProgress: false,
      localMigrationInProgress: false,
      activeWindow: true,
      appBuild: "recovery-test",
    });
    expect(terminalUpdateDecision.safe).toBe(true);
  });

  test("reload recovery keeps both the journal gate and tender lease for nonterminal prepared sale", async () => {
    const name = uniqueDbName();
    const firstDb = openPosLocalDatabase(name);
    const firstJournal = createOperationJournal(firstDb);
    const firstTenderActivity = createTenderActivityPort(firstDb);

    const firstPorts = createBrowserCashCheckoutPorts({
      fetchImpl: async () => {
        throw new TypeError("simulated lost prepare response");
      },
      scope: LOCAL_CHECKOUT_SCOPE,
      journal: firstJournal,
      tenderActivity: firstTenderActivity,
    });

    await firstPorts.checkout.prepare(
      {
        transactionId: TX,
        registerId: LOCAL_CHECKOUT_SCOPE.registerId,
        shiftId: LOCAL_CHECKOUT_SCOPE.shiftId,
        deviceId: LOCAL_CHECKOUT_SCOPE.deviceId,
        quoteId: "quote-reload-nonterminal",
        quoteFingerprint: "0123456789abcdef0123456789abcdef",
      },
      { idempotencyKey: "55555555-5555-4555-8555-555555555555", correlationId: CORRELATION },
    );

    expect(await hasActiveTender(firstDb)).toBe(true);
    await closePosLocalDatabase(name);

    const reloadedDb = openPosLocalDatabase(name);
    const reloadedJournal = createOperationJournal(reloadedDb);
    const reloadedTenderActivity = createTenderActivityPort(reloadedDb);
    const recoveredItems = await loadLocalJournalAttentionItems(reloadedJournal);
    expect(recoveredItems).toHaveLength(1);

    const recoveryPorts = createBrowserCashCheckoutPorts({
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            ok: true,
            correlationId: CORRELATION,
            data: {
              transactionId: TX,
              status: "prepared",
              saleId: "sale-reloaded",
              orderReference: "ORDER-RELOADED",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      scope: LOCAL_CHECKOUT_SCOPE,
      journal: reloadedJournal,
      tenderActivity: reloadedTenderActivity,
    });

    let afterRecoveryItems: readonly AttentionItemView[] = recoveredItems;
    await runAttentionRecovery({
      item: recoveredItems[0]!,
      lock: createAttentionRecoveryLock(),
      ports: { payments: recoveryPorts.payments, sales: recoveryPorts.sales },
      reload: async () => {
        afterRecoveryItems = await loadLocalJournalAttentionItems(reloadedJournal);
      },
    });

    expect((await reloadedJournal.pending())[0]?.status).toBe("requires_attention");
    expect(hasBlockingLocalTransactionRecovery(afterRecoveryItems)).toBe(true);
    const nonterminalTenderActive = await hasActiveTender(reloadedDb);
    expect(nonterminalTenderActive).toBe(true);
    const nonterminalUpdateDecision = assessUpdateActivation({
      activeTender: nonterminalTenderActive,
      criticalOperationCount: 1,
      syncMutationInProgress: false,
      localMigrationInProgress: false,
      activeWindow: true,
      appBuild: "recovery-test",
    });
    expect(nonterminalUpdateDecision.safe).toBe(false);
    if (nonterminalUpdateDecision.safe) {
      throw new Error("nonterminal tender recovery unexpectedly became update-safe");
    }
    expect(nonterminalUpdateDecision.reasons).toContain("ACTIVE_TENDER");
  });

  test("local payment recovery checks payment then sale using the persisted transaction identity", async () => {
    const localPayment: AttentionItemView = {
      id: "local-journal:payment-op",
      title: paymentItem.title,
      summary: paymentItem.summary,
      typeLabel: paymentItem.typeLabel,
      severity: paymentItem.severity,
      transactionId: TX,
      resolveAllowed: true,
      recoverKind: "payment",
    };
    const paymentResolve = vi.fn(async () => paymentOk("verified"));
    const salesResolve = vi.fn(async () => saleOk("completed"));

    const outcome = await recoverAttentionItem(localPayment, {
      payments: { resolve: paymentResolve },
      sales: { resolve: salesResolve },
    });

    expect(outcome).toBe("attempted");
    expect(paymentResolve).toHaveBeenCalledWith({ transactionId: TX, paymentId: undefined });
    expect(salesResolve).toHaveBeenCalledWith(TX);
  });

  test("local recovery identity wins when server attention overlaps the same transaction", () => {
    const localSale: AttentionItemView = {
      id: "local-journal:sale-op",
      title: saleItem.title,
      summary: saleItem.summary,
      typeLabel: saleItem.typeLabel,
      severity: saleItem.severity,
      transactionId: TX,
      resolveAllowed: true,
      recoverKind: "sale",
    };
    const merged = mergeAttentionItems([saleItem], [localSale], []);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("local-journal:sale-op");
  });

  test("payment Check / Recover calls PaymentPort.resolve once for the same transaction/payment and never initialize", async () => {
    const initialize = vi.fn();
    const resolve = vi.fn(async () => paymentOk());
    const salesResolve = vi.fn();
    const payments = { initialize, resolve } as Pick<PaymentPort, "resolve"> & { initialize: typeof initialize };
    const sales = { resolve: salesResolve } as Pick<SalesPort, "resolve">;
    const outcome = await recoverAttentionItem(paymentItem, { payments, sales });
    expect(outcome).toBe("attempted");
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith({ transactionId: TX, paymentId: PAYMENT });
    expect(initialize).not.toHaveBeenCalled();
    expect(salesResolve).not.toHaveBeenCalled();
  });

  test("sale Check / Recover calls SalesPort.resolve for the same transaction", async () => {
    const paymentResolve = vi.fn();
    const salesResolve = vi.fn(async () => saleOk());
    await recoverAttentionItem(saleItem, {
      payments: { resolve: paymentResolve },
      sales: { resolve: salesResolve },
    });
    expect(salesResolve).toHaveBeenCalledTimes(1);
    expect(salesResolve).toHaveBeenCalledWith(TX);
    expect(paymentResolve).not.toHaveBeenCalled();
  });

  test("refund/return operations are not treated as sale recovery", async () => {
    const paymentResolve = vi.fn();
    const salesResolve = vi.fn();
    const outcome = await recoverAttentionItem(refundItem, {
      payments: { resolve: paymentResolve },
      sales: { resolve: salesResolve },
    });
    expect(outcome).toBe("unsupported");
    expect(paymentResolve).not.toHaveBeenCalled();
    expect(salesResolve).not.toHaveBeenCalled();
  });

  test("attention reload runs after recovery and unresolved durable state remains", async () => {
    const inbox = [paymentItem];
    const resolve = vi.fn(async () => paymentOk("requires_attention"));
    const reload = vi.fn(async () => undefined);
    const lock = createAttentionRecoveryLock();
    const status = await runAttentionRecovery({
      item: paymentItem,
      lock,
      ports: { payments: { resolve }, sales: { resolve: vi.fn() } },
      reload,
    });
    expect(status).toBe("attempted");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(inbox).toHaveLength(1);
    expect(lock.inFlightId()).toBeNull();
  });

  test("resolved durable read result is what removes the item, not the request itself", async () => {
    let inbox: AttentionItemView[] = [paymentItem];
    const resolve = vi.fn(async () => paymentOk("verified"));
    await runAttentionRecovery({
      item: paymentItem,
      lock: createAttentionRecoveryLock(),
      ports: { payments: { resolve }, sales: { resolve: vi.fn() } },
      reload: async () => {
        inbox = [];
      },
    });
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(inbox).toEqual([]);
  });

  test("repeated recover while in-flight does not issue a duplicate resolve", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolveGate) => {
      release = resolveGate;
    });
    const resolve = vi.fn(async () => {
      await gate;
      return paymentOk();
    });
    const reload = vi.fn(async () => undefined);
    const lock = createAttentionRecoveryLock();
    const ports = { payments: { resolve }, sales: { resolve: vi.fn() } };
    const first = runAttentionRecovery({ item: paymentItem, lock, ports, reload });
    const second = await runAttentionRecovery({ item: paymentItem, lock, ports, reload });
    expect(second).toBe("in_flight");
    expect(resolve).toHaveBeenCalledTimes(1);
    release?.();
    await first;
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

const CASHIER_A = "cashier_a";
const CASHIER_B = "cashier_b";
const REGISTER_A = "reg_a";
const REGISTER_B = "reg_b";
const PREPARE_KEY = "44444444-4444-4444-8444-444444444444";

describe("CAN-01 local recovery scope", () => {
  test("cashier B keeps A's unresolved sale, without inheriting authorship, and is blocked only on that register", async () => {
    const name = uniqueDbName();
    const db = openPosLocalDatabase(name);
    const journal = createOperationJournal(db, {
      createdByActorId: CASHIER_A,
      organizationId: "org_a",
      locationId: "loc_a1",
      registerId: REGISTER_A,
      deviceId: LOCAL_CHECKOUT_SCOPE.deviceId,
    });
    await createBrowserCashCheckoutPorts({
      fetchImpl: async () => {
        throw new TypeError("simulated lost prepare response");
      },
      scope: { ...LOCAL_CHECKOUT_SCOPE, registerId: REGISTER_A },
      journal,
      tenderActivity: createTenderActivityPort(db),
    }).checkout.prepare(
      {
        transactionId: TX,
        registerId: REGISTER_A,
        shiftId: LOCAL_CHECKOUT_SCOPE.shiftId,
        deviceId: LOCAL_CHECKOUT_SCOPE.deviceId,
        quoteId: "quote-can-01",
        quoteFingerprint: "0123456789abcdef0123456789abcdef",
      },
      { idempotencyKey: PREPARE_KEY, correlationId: CORRELATION },
    );

    const stored = await listUnresolvedJournalRecords(db);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.pending.status).toBe("response_unknown");
    expect(stored[0]?.pending.idempotencyKey).toBe(PREPARE_KEY);
    expect(stored[0]?.scope.createdByActorId).toBe(CASHIER_A);

    const sameRegister = await loadLocalJournalAttentionItems(journal, {
      actorId: CASHIER_B,
      registerId: REGISTER_A,
      organizationId: "org_a",
    }, db);
    expect(sameRegister).toHaveLength(1);
    expect(sameRegister[0]?.localRecoveryOwner).toBe("other");
    expect(localRecoverySellBanner(true, sameRegister)?.title).toBe("This register needs a status check.");
    expect(sameRegister[0]?.summary).toContain("Another cashier");
    expect(sameRegister[0]?.summary).toContain("not started in your current sign-in");
    expect(sameRegister[0]?.summary).not.toContain(CASHIER_B);
    expect(sameRegister[0]?.summary).not.toMatch(/OperationJournal|IndexedDB|request hash|sale\.prepare/i);
    expect(hasBlockingLocalTransactionRecovery(sameRegister)).toBe(true);

    const otherRegister = await loadLocalJournalAttentionItems(journal, {
      actorId: CASHIER_B,
      registerId: REGISTER_B,
      organizationId: "org_a",
    }, db);
    expect(otherRegister[0]?.summary).toContain("different register");
    expect(localRecoverySellBanner(true, otherRegister)).toBeNull();
    expect(hasBlockingLocalTransactionRecovery(otherRegister)).toBe(false);

    const ownReload = await loadLocalJournalAttentionItems(journal, {
      actorId: CASHIER_A,
      registerId: REGISTER_A,
      organizationId: "org_a",
    }, db);
    expect(ownReload[0]?.localRecoveryOwner).toBe("viewer");
    expect(ownReload[0]?.summary).toContain("This sale needs a status check");
    expect(localRecoverySellBanner(true, ownReload)?.title).toBe("Previous transaction needs a status check.");
    expect(hasBlockingLocalTransactionRecovery(ownReload)).toBe(true);

    const requested: string[] = [];
    const recovery = createBrowserCashCheckoutPorts({
      fetchImpl: async (input) => {
        requested.push(String(input));
        return new Response(JSON.stringify({
          ok: true,
          correlationId: CORRELATION,
          data: { transactionId: TX, status: "not_found" },
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
      scope: { ...LOCAL_CHECKOUT_SCOPE, registerId: REGISTER_A },
      journal,
      tenderActivity: createTenderActivityPort(db),
    });
    await runAttentionRecovery({
      item: sameRegister[0]!,
      lock: createAttentionRecoveryLock(),
      ports: { payments: recovery.payments, sales: recovery.sales },
      reload: async () => undefined,
    });
    expect(requested.some((url) => url.includes("/sales/prepare"))).toBe(false);
    expect(requested.some((url) => url.includes(`/sales/${TX}`))).toBe(true);
    const after = await db.journal.get(PREPARE_KEY);
    expect(after?.status).toBe("acknowledged");
    expect(after?.idempotencyKey).toBe(PREPARE_KEY);
  });

  test("a second device database does not invent the first device's local evidence", async () => {
    const firstName = uniqueDbName();
    const secondName = uniqueDbName();
    const first = openPosLocalDatabase(firstName);
    const journal = createOperationJournal(first, { createdByActorId: CASHIER_A, registerId: REGISTER_A });
    await journal.appendBeforeSend(
      {
        id: PREPARE_KEY,
        transactionId: TX,
        operation: "sale.prepare",
        idempotencyKey: PREPARE_KEY,
        requestHash: await (async () => {
          const payload = {
            payloadVersion: "1.0.0",
            operation: "sale.prepare",
            transactionId: TX,
            request: { transactionId: TX, registerId: REGISTER_A },
          };
          const { sha256Hex, canonicalJson } = await import("../local/canonical");
          return sha256Hex(canonicalJson(payload));
        })(),
        payloadVersion: "1.0.0",
        status: "response_unknown",
        attempts: 1,
        createdAt: "2026-09-25T09:00:00.000Z",
      },
      JSON.stringify({
        payloadVersion: "1.0.0",
        operation: "sale.prepare",
        transactionId: TX,
        request: { transactionId: TX, registerId: REGISTER_A },
      }),
    );
    const second = openPosLocalDatabase(secondName);
    const secondItems = await loadLocalJournalAttentionItems(
      createOperationJournal(second),
      { actorId: CASHIER_B, registerId: REGISTER_A },
      second,
    );
    expect(secondItems).toEqual([]);
    expect(await second.journal.count()).toBe(0);
    expect(await first.journal.count()).toBe(1);
  });

  test("sign-out does not delete unresolved evidence or rotate its idempotency key", async () => {
    const name = uniqueDbName();
    const db = openPosLocalDatabase(name);
    const journal = createOperationJournal(db, { createdByActorId: CASHIER_A, registerId: REGISTER_A });
    const payload = { payloadVersion: "1.0.0", operation: "sale.prepare", transactionId: TX, request: { registerId: REGISTER_A } };
    const { sha256Hex, canonicalJson } = await import("../local/canonical");
    const requestHash = await sha256Hex(canonicalJson(payload));
    await journal.appendBeforeSend({
      id: PREPARE_KEY,
      transactionId: TX,
      operation: "sale.prepare",
      idempotencyKey: PREPARE_KEY,
      requestHash,
      payloadVersion: "1.0.0",
      status: "response_unknown",
      attempts: 1,
      createdAt: "2026-09-25T09:00:00.000Z",
    }, JSON.stringify(payload));
    const runtime = createStaffRuntimeController({
      gateway: {
        async establish() {
          throw new Error("unused");
        },
        async readContext() {
          throw new Error("unused");
        },
        async read() {
          return null;
        },
        async clear() {
          return;
        },
      },
      auth: {
        async signIn() {
          return { accessToken: "token" };
        },
        async signOut() {
          return;
        },
      },
      registers: {} as RegisterPort,
    });
    await runtime.signOut();
    const row = await db.journal.get(PREPARE_KEY);
    expect(row?.status).toBe("response_unknown");
    expect(row?.idempotencyKey).toBe(PREPARE_KEY);
    expect(await db.journal.count()).toBe(1);
    await journal.markAcknowledged(PREPARE_KEY);
    await journal.markAcknowledged(PREPARE_KEY);
    const acknowledged = await db.journal.get(PREPARE_KEY);
    expect(acknowledged?.idempotencyKey).toBe(PREPARE_KEY);
    expect(acknowledged?.status).toBe("acknowledged");
  });

  test("legacy rows with no recorded cashier stay visible and block when register safety is unknown", async () => {
    const name = uniqueDbName();
    const db = openPosLocalDatabase(name);
    const payload = JSON.stringify({ kind: "sale.prepare", note: "historic" });
    const { sha256Hex, canonicalJson } = await import("../local/canonical");
    const requestHash = await sha256Hex(canonicalJson(JSON.parse(payload)));
    await db.journal.add({
      id: PREPARE_KEY,
      transactionId: TX,
      operation: "sale.prepare",
      idempotencyKey: PREPARE_KEY,
      requestHash,
      payloadVersion: "1.0.0",
      status: "response_unknown",
      attempts: 1,
      createdAt: "2026-09-20T22:10:14.444Z",
      payload,
      attemptHistory: [{ at: "2026-09-20T22:10:14.444Z", status: "response_unknown" }],
    });
    const items = await loadLocalJournalAttentionItems(
      createOperationJournal(db),
      { actorId: CASHIER_B, registerId: REGISTER_B, organizationId: "org_a" },
      db,
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.localRecoveryOwner).toBe("unknown");
    expect(items[0]?.summary).toContain("original cashier was not recorded");
    expect(items[0]?.summary).not.toContain(CASHIER_B);
    expect(hasBlockingLocalTransactionRecovery(items)).toBe(true);
    const stored = await listUnresolvedJournalRecords(db);
    expect(stored[0]?.scope.createdByActorId).toBeUndefined();
    expect(stored[0]?.pending.idempotencyKey).toBe(PREPARE_KEY);
  });
});

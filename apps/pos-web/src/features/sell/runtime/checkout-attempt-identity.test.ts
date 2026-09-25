import "fake-indexeddb/auto";
import { describe, expect, test, vi } from "vitest";
import type {
  PaymentState,
  PreparedSale,
  Quote,
  SaleResolution,
} from "../../../../../../docs/contracts/domain.generated";
import type { ApiResult } from "../../../../../../docs/contracts/ports";
import { openPosLocalDatabase } from "../../../local";
import {
  createCashCheckoutController,
  type CashCheckoutPorts,
} from "./cashCheckoutController";
import {
  createCheckoutAttemptStore,
  discardCheckoutAttemptMemory,
  type CheckoutAttemptStore,
} from "./checkout-attempt-store";

const TX = "11111111-1111-4111-8111-111111111111";

function quote(fingerprint = "fp-live-1"): Quote {
  return {
    id: "quote-live-1",
    fingerprint,
    cartId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    cartRevision: 1,
    customer: { kind: "walkin" },
    locationId: "loc-front-1",
    currency: "GHS",
    lines: [],
    subtotal: { minor: 1500, currency: "GHS" },
    discount: { minor: 0, currency: "GHS" },
    tax: { minor: 0, currency: "GHS" },
    total: { minor: 1500, currency: "GHS" },
    calculatedAt: "2026-09-13T20:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    purchasable: true,
  };
}

function prepareArgs(mock: object, index = 0): { transactionId: string; quoteFingerprint: string; idempotencyKey: string } {
  const call = (mock as { mock: { calls: ReadonlyArray<ReadonlyArray<unknown>> } }).mock.calls[index];
  const body = call?.[0];
  const context = call?.[1];
  if (!body || typeof body !== "object" || !("transactionId" in body) || typeof body.transactionId !== "string") {
    throw new Error("prepare was not called");
  }
  return {
    transactionId: body.transactionId,
    quoteFingerprint:
      "quoteFingerprint" in body && typeof body.quoteFingerprint === "string" ? body.quoteFingerprint : "",
    idempotencyKey:
      context && typeof context === "object" && "idempotencyKey" in context && typeof context.idempotencyKey === "string"
        ? context.idempotencyKey
        : "",
  };
}

function ports(
  prepare: CashCheckoutPorts["checkout"]["prepare"],
  sequenceStart: number,
  attemptStore?: CheckoutAttemptStore,
): CashCheckoutPorts {
  let n = sequenceStart;
  const next = () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };
  return {
    checkout: { prepare, finalize: vi.fn() },
    payments: { confirmCash: vi.fn(), resolve: vi.fn() },
    sales: {
      resolve: vi.fn(async (transactionId: string): Promise<ApiResult<SaleResolution>> => ({
        ok: true,
        correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        data: { transactionId, status: "not_found" },
      })),
      cancel: vi.fn(),
    },
    receipts: { getByTransaction: vi.fn() },
    printer: { print: vi.fn() },
    scope: { registerId: "reg_a", shiftId: "shift-1", deviceId: "device-1" },
    createUuid: next,
    attemptStore,
  };
}

describe("CAN-02 checkout business-attempt identity", () => {
  test("a delayed prepare followed by a new controller does not mint a second sale identity", async () => {
    let release: (value: ApiResult<{ transactionId: string }>) => void = () => undefined;
    const prepare = vi.fn(
      () =>
        new Promise<ApiResult<{ transactionId: string }>>((resolve) => {
          release = resolve;
        }),
    );
    const db = openPosLocalDatabase(`cetech-pos-local-${crypto.randomUUID()}`);
    const store = createCheckoutAttemptStore(db);
    const firstPorts = ports(prepare as CashCheckoutPorts["checkout"]["prepare"], 0, store);
    const first = createCashCheckoutController(firstPorts);
    void first.startPrepare(quote());
    const secondPorts = ports(prepare as CashCheckoutPorts["checkout"]["prepare"], 100, store);
    const second = createCashCheckoutController(secondPorts);
    void second.startPrepare(quote());
    const sent = prepareArgs(prepare);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(sent.transactionId).not.toBe("");
    expect(sent.idempotencyKey).not.toBe("");
    release({
      ok: true,
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      data: { transactionId: sent.transactionId },
    });
  });

  test("repeated Pay on one controller and a changed quote do not mint another identity", async () => {
    const prepare = vi.fn(() => new Promise<ApiResult<{ transactionId: string }>>(() => undefined));
    const db = openPosLocalDatabase(`cetech-pos-local-${crypto.randomUUID()}`);
    const store = createCheckoutAttemptStore(db);
    const controller = createCashCheckoutController(
      ports(prepare as CashCheckoutPorts["checkout"]["prepare"], 0, store),
    );
    void controller.startPrepare(quote());
    void controller.startPrepare(quote());
    const refreshed = vi.fn(() => new Promise<ApiResult<{ transactionId: string }>>(() => undefined));
    controller.replacePorts({
      ...ports(refreshed as CashCheckoutPorts["checkout"]["prepare"], 50, store),
      attemptStore: store,
    });
    void controller.startPrepare(quote());
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(refreshed).not.toHaveBeenCalled();

    const remounted = createCashCheckoutController(
      ports(prepare as CashCheckoutPorts["checkout"]["prepare"], 80, store),
    );
    void remounted.startPrepare(quote("fp-changed"));
    expect(prepare).toHaveBeenCalledTimes(1);
    const sent = prepareArgs(prepare);
    expect(sent.quoteFingerprint).toBe("fp-live-1");
    expect(remounted.getSession().transactionId).toBe(sent.transactionId);
  });

  test("another register cannot start a second attempt while the first is unresolved", () => {
    const prepare = vi.fn(() => new Promise<ApiResult<{ transactionId: string }>>(() => undefined));
    const db = openPosLocalDatabase(`cetech-pos-local-${crypto.randomUUID()}`);
    const store = createCheckoutAttemptStore(db);
    const first = createCashCheckoutController(
      ports(prepare as CashCheckoutPorts["checkout"]["prepare"], 0, store),
    );
    void first.startPrepare(quote());
    const otherRegister = ports(prepare as CashCheckoutPorts["checkout"]["prepare"], 100, store);
    const second = createCashCheckoutController({
      ...otherRegister,
      scope: { ...otherRegister.scope, registerId: "reg_b" },
    });
    void second.startPrepare(quote());
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  test("IndexedDB keeps the attempt after the in-process copy is dropped", async () => {
    const prepare = vi.fn(() => new Promise<ApiResult<{ transactionId: string }>>(() => undefined));
    const db = openPosLocalDatabase(`cetech-pos-local-${crypto.randomUUID()}`);
    const store = createCheckoutAttemptStore(db);
    const first = createCashCheckoutController(
      ports(prepare as CashCheckoutPorts["checkout"]["prepare"], 0, store),
    );
    void first.startPrepare(quote());
    const transactionId = prepareArgs(prepare).transactionId;
    await vi.waitFor(async () => {
      expect(await db.kv.get("checkout.active-business-attempt")).toBeTruthy();
    });
    discardCheckoutAttemptMemory(db.name);
    const reloaded = createCheckoutAttemptStore(db);
    await reloaded.hydrate();
    const again = vi.fn(() => new Promise<ApiResult<{ transactionId: string }>>(() => undefined));
    const second = createCashCheckoutController(
      ports(again as CashCheckoutPorts["checkout"]["prepare"], 100, reloaded),
    );
    void second.startPrepare(quote());
    expect(again).not.toHaveBeenCalled();
    expect(second.getSession().transactionId).toBe(transactionId);
  });

  test("an authoritative not-found result retires the attempt so a later sale can be new", async () => {
    const db = openPosLocalDatabase(`cetech-pos-local-${crypto.randomUUID()}`);
    const store = createCheckoutAttemptStore(db);
    const prepare = vi.fn(async () => {
      throw new TypeError("lost response");
    });
    const controller = createCashCheckoutController(
      ports(prepare as CashCheckoutPorts["checkout"]["prepare"], 0, store),
    );
    await controller.startPrepare(quote());
    expect(controller.getSession().stage).toBe("prepare_failed");
    expect(store.readSync()).toBeNull();
    const nextPrepare = vi.fn(async () => {
      throw new TypeError("lost response");
    });
    await controller.replacePorts({
      ...ports(nextPrepare as CashCheckoutPorts["checkout"]["prepare"], 100, store),
      attemptStore: store,
    });
    await controller.startPrepare(quote());
    const firstId = prepareArgs(prepare).transactionId;
    const secondId = prepareArgs(nextPrepare).transactionId;
    expect(secondId).not.toBe(firstId);
  });

  test("an uncertain resolution keeps the attempt so a reopened controller cannot mint", async () => {
    const db = openPosLocalDatabase(`cetech-pos-local-${crypto.randomUUID()}`);
    const store = createCheckoutAttemptStore(db);
    const prepare = vi.fn(async () => {
      throw new TypeError("lost response");
    });
    const built = ports(prepare as CashCheckoutPorts["checkout"]["prepare"], 0, store);
    const controller = createCashCheckoutController({
      ...built,
      sales: {
        resolve: vi.fn(async (transactionId: string): Promise<ApiResult<SaleResolution>> => ({
          ok: true,
          correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          data: { transactionId, status: "preparing" },
        })),
        cancel: vi.fn(),
      },
    });
    await controller.startPrepare(quote());
    const transactionId = prepareArgs(prepare).transactionId;
    expect(controller.getSession().stage).toBe("resolving_sale");
    expect(store.readSync()?.transactionId).toBe(transactionId);
    const again = vi.fn(async () => {
      throw new TypeError("lost response");
    });
    const second = createCashCheckoutController(
      ports(again as CashCheckoutPorts["checkout"]["prepare"], 100, store),
    );
    void second.startPrepare(quote());
    expect(again).not.toHaveBeenCalled();
    expect(second.getSession().transactionId).toBe(transactionId);
  });

  test("a completed sale keeps its identity until new sale, then the same cart may start a new one", async () => {
    const db = openPosLocalDatabase(`cetech-pos-local-${crypto.randomUUID()}`);
    const store = createCheckoutAttemptStore(db);
    const correlationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const prepared = (transactionId: string): PreparedSale => ({
      transactionId,
      saleId: "sale-1",
      orderReference: "POS-1001",
      quoteFingerprint: "fp-live-1",
      total: { minor: 1500, currency: "GHS" },
      status: "prepared",
      stockCommitment: "reserved",
      preparedAt: "2026-09-14T18:00:00.000Z",
      expiresAt: "2026-09-14T19:00:00.000Z",
    });
    const verified = (transactionId: string): PaymentState => ({
      transactionId,
      paymentId: TX,
      tender: "cash",
      status: "verified",
      amount: { minor: 1500, currency: "GHS" },
      verifiedAt: "2026-09-14T18:01:00.000Z",
      nextAction: "none",
    });
    const prepare = vi.fn(async (input: { transactionId: string }) => ({
      ok: true as const,
      correlationId,
      data: prepared(input.transactionId),
    }));
    const confirmCash = vi.fn(async (input: { transactionId: string }) => ({
      ok: true as const,
      correlationId,
      data: verified(input.transactionId),
    }));
    const finalize = vi.fn(async (input: { transactionId: string }): Promise<ApiResult<SaleResolution>> => ({
      ok: true,
      correlationId,
      data: {
        transactionId: input.transactionId,
        status: "completed",
        saleId: "sale-1",
        orderReference: "POS-1001",
        paymentId: TX,
      },
    }));
    const controller = createCashCheckoutController({
      ...ports(prepare as CashCheckoutPorts["checkout"]["prepare"], 0, store),
      checkout: { prepare: prepare as CashCheckoutPorts["checkout"]["prepare"], finalize },
      payments: { confirmCash, resolve: vi.fn() },
      receipts: {
        getByTransaction: vi.fn(async () => ({
          ok: false as const,
          correlationId,
          error: {
            code: "NOT_FOUND" as const,
            message: "Receipt is not ready.",
            retryable: false,
            nextAction: "none" as const,
          },
        })),
      },
    });
    await controller.startPrepare(quote());
    const firstId = prepareArgs(prepare).transactionId;
    controller.selectCash();
    await controller.confirmCash("20.00");
    expect(controller.getSession().saleCompleted).toBe(true);
    await controller.startPrepare(quote());
    expect(prepare).toHaveBeenCalledTimes(1);
    controller.resetForNewSale();
    expect(store.readSync()).toBeNull();
    const nextPrepare = vi.fn(async (input: { transactionId: string }) => ({
      ok: true as const,
      correlationId,
      data: prepared(input.transactionId),
    }));
    controller.replacePorts({
      ...ports(nextPrepare as CashCheckoutPorts["checkout"]["prepare"], 100, store),
      checkout: { prepare: nextPrepare as CashCheckoutPorts["checkout"]["prepare"], finalize },
      attemptStore: store,
    });
    await controller.startPrepare(quote());
    expect(prepareArgs(nextPrepare).transactionId).not.toBe(firstId);
  });
});

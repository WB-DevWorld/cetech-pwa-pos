import { describe, expect, test, vi } from "vitest";
import { createManualMobileMoneyClient } from "./checkout-client";

describe("manual Mobile Money browser client", () => {
  test("does not send a payment when the local recovery journal is missing", async () => {
    const fetchImpl = vi.fn();
    const client = createManualMobileMoneyClient({ fetchImpl: fetchImpl as typeof fetch });
    const context = {
      idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    };
    const begun = await client.begin("11111111-1111-4111-8111-111111111111", context);
    expect(begun.ok).toBe(false);
    if (!begun.ok) expect(begun.error.code).toBe("INTEGRATION_UNAVAILABLE");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("journals the original begin before the request", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: { payment: { paymentId: "pay", status: "awaiting_customer" }, network: "MTN", accountLabel: "Shop" },
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }), { status: 200 }));
    const journal = {
      appendBeforeSend: vi.fn(async () => undefined),
      pending: vi.fn(async () => []),
      markSent: vi.fn(async () => undefined),
      markResponseUnknown: vi.fn(async () => undefined),
      markAcknowledged: vi.fn(async () => undefined),
      markRequiresAttention: vi.fn(async () => undefined),
    };
    const client = createManualMobileMoneyClient({ fetchImpl: fetchImpl as typeof fetch, journal });
    const begun = await client.begin("11111111-1111-4111-8111-111111111111", {
      idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(begun.ok).toBe(true);
    expect(journal.appendBeforeSend).toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalled();
    const journalOrder = journal.appendBeforeSend.mock.invocationCallOrder[0] ?? 0;
    const fetchOrder = fetchImpl.mock.invocationCallOrder[0] ?? 0;
    expect(journalOrder).toBeLessThan(fetchOrder);
  });

  test("does not confirm when the journal cannot record the attempt", async () => {
    const fetchImpl = vi.fn();
    const journal = {
      appendBeforeSend: vi.fn(async () => {
        throw new Error("disk");
      }),
      pending: vi.fn(async () => []),
      markSent: vi.fn(async () => undefined),
      markResponseUnknown: vi.fn(async () => undefined),
      markAcknowledged: vi.fn(async () => undefined),
      markRequiresAttention: vi.fn(async () => undefined),
    };
    const client = createManualMobileMoneyClient({ fetchImpl: fetchImpl as typeof fetch, journal });
    const result = await client.confirm(
      {
        transactionId: "11111111-1111-4111-8111-111111111111",
        paymentId: "15151515-1515-4515-8515-151515151515",
        merchantReference: "MM-WIN",
        merchantConfirmed: true,
      },
      {
        idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INTEGRATION_UNAVAILABLE");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

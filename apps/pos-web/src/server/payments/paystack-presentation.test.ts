import { describe, expect, test } from "vitest";
import type { Session } from "../../../../../docs/contracts/domain.generated";
import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { handlePaystackPresentation } from "./handle-paystack-presentation";
import { allowlistedPaystackUrl, paystackTestCheckoutUrl } from "./paystack-presentation";

const NOW = new Date("2026-10-10T12:00:00.000Z");
const TX = "11111111-1111-4111-8111-111111111111";
const PAYMENT = "15151515-1515-4515-8515-151515151515";

async function cookie(organizationId = "org_a", locationIds: readonly string[] = ["loc_a"]) {
  const sessions = createEphemeralInMemoryStaffSessionStore();
  const session: Session = {
    actorId: "cashier_a",
    displayName: "Ada",
    organizationId,
    locationIds: [...locationIds],
    capabilities: [],
    expiresAt: "2026-10-10T18:00:00.000Z",
  };
  const id = await sessions.create(session, "csrf", new Date("2026-10-10T18:00:00.000Z"));
  return { sessions, cookieHeader: `cetech_pos_sid=${id}` };
}

describe("Paystack test presentation", () => {
  test("returns one allowlisted test URL for the stored payment and drops anything else", async () => {
    expect(allowlistedPaystackUrl("http://checkout.paystack.com/abc")).toBeUndefined();
    expect(allowlistedPaystackUrl("https://evil.example/abc")).toBeUndefined();
    expect(paystackTestCheckoutUrl({ accessCode: "ACCESSCODE", authorizationUrl: "https://evil.example/x" })).toBe(
      "https://checkout.paystack.com/ACCESSCODE",
    );
    const store = createInMemoryCheckoutStore();
    await store.seedPreparedSale({
      organizationId: "org_a",
      locationId: "loc_a",
      locationName: "Store",
      registerId: "reg_a",
      registerName: "Register A",
      deviceId: "44444444-4444-4444-8444-444444444444",
      shiftId: "66666666-6666-4666-8666-666666666666",
      cashierId: "cashier_a",
      cashierName: "Ada",
      customer: { kind: "walkin" },
      customerLabel: "Walk-in",
      prepared: {
        transactionId: TX,
        saleId: "sale-1",
        orderReference: "1001",
        quoteFingerprint: "0123456789abcdef0123456789abcdef",
        total: { minor: 2900, currency: "GHS" },
        status: "prepared",
        stockCommitment: "reserved",
        preparedAt: NOW.toISOString(),
        expiresAt: "2026-10-10T13:00:00.000Z",
      },
      subtotal: { minor: 2900, currency: "GHS" },
      discount: { minor: 0, currency: "GHS" },
      tax: { minor: 0, currency: "GHS" },
      lines: [],
    });
    await store.savePayment({
      paymentId: PAYMENT,
      transactionId: TX,
      saleId: "sale-1",
      tender: "card",
      status: "awaiting_customer",
      amount: { minor: 2900, currency: "GHS" },
      actorId: "cashier_a",
      provider: "paystack",
      providerReference: "ref-1",
      accessCode: "ACCESSCODE",
      authorizationUrl: "https://checkout.paystack.com/ACCESSCODE",
      displayReference: "ref-1",
    });
    const auth = await cookie();
    const first = await handlePaystackPresentation({
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      cookieHeader: auth.cookieHeader,
      paymentId: PAYMENT,
      now: NOW,
      sessions: auth.sessions,
      checkoutStore: store,
      env: { PAYSTACK_MODE: "test", PAYSTACK_CARD_ENABLED: "false" },
    });
    const second = await handlePaystackPresentation({
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab",
      cookieHeader: auth.cookieHeader,
      paymentId: PAYMENT,
      now: NOW,
      sessions: auth.sessions,
      checkoutStore: store,
      env: { PAYSTACK_MODE: "test", PAYSTACK_CARD_ENABLED: "false" },
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.data.url).toBe(second.data.url);
    expect(JSON.stringify(first)).not.toContain("sk_");
    expect(first.data.url).toBe("https://checkout.paystack.com/ACCESSCODE");
    expect(first.data.mode).toBe("test");

    const other = await cookie("org_b");
    const denied = await handlePaystackPresentation({
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac",
      cookieHeader: other.cookieHeader,
      paymentId: PAYMENT,
      now: NOW,
      sessions: other.sessions,
      checkoutStore: store,
      env: { PAYSTACK_MODE: "test" },
    });
    expect(denied.ok).toBe(false);

    const live = await handlePaystackPresentation({
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad",
      cookieHeader: auth.cookieHeader,
      paymentId: PAYMENT,
      now: NOW,
      sessions: auth.sessions,
      checkoutStore: store,
      env: { PAYSTACK_MODE: "live" },
    });
    expect(live.ok).toBe(false);
  });
});

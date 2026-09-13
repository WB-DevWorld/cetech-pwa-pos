import { describe, expect, test } from "vitest";
import { STAFF_CSRF_COOKIE, STAFF_SESSION_COOKIE } from "../config/auth";
import { createEphemeralInMemoryStaffSessionStore } from "./auth/session-store";
import { handleQuote } from "./quotes/handle-quote";

const CORRELATION = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ORIGIN = "https://pos.example.test";
const CSRF = "csrf-quote-token";
const NOW = new Date("2026-09-13T20:00:00.000Z");

const REQUEST = {
  cartId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  cartRevision: 1,
  customer: { kind: "walkin" as const },
  locationId: "loc_a1",
  lines: [{ lineId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", productId: "p-hardener", quantity: "1" }],
};

async function staffCookies() {
  const store = createEphemeralInMemoryStaffSessionStore();
  const sessionId = await store.create(
    {
      actorId: "cashier_a",
      displayName: "Cashier A",
      organizationId: "org_a",
      locationIds: ["loc_a1"],
      capabilities: ["ui.hint.only"],
      expiresAt: "2026-09-13T22:00:00.000Z",
    },
    CSRF,
    new Date("2026-09-13T22:00:00.000Z"),
  );
  return {
    store,
    cookieHeader: `${STAFF_SESSION_COOKIE}=${sessionId}; ${STAFF_CSRF_COOKIE}=${CSRF}`,
  };
}

describe("R4 BFF whole-cart quote", () => {
  test("anonymous request is AUTH_REQUIRED", async () => {
    const result = await handleQuote({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: `${STAFF_CSRF_COOKIE}=${CSRF}`,
      body: REQUEST,
      now: NOW,
      sessionStore: createEphemeralInMemoryStaffSessionStore(),
      allowedOrigins: [ORIGIN],
    });
    expect(result.status).toBe(401);
    expect(result.body.ok).toBe(false);
  });

  test("missing bridge is INTEGRATION_UNAVAILABLE after auth", async () => {
    const { store, cookieHeader } = await staffCookies();
    const result = await handleQuote({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader,
      body: REQUEST,
      now: NOW,
      sessionStore: store,
      allowedOrigins: [ORIGIN],
    });
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("INTEGRATION_UNAVAILABLE");
    }
  });

  test("forwards the QuoteRequest and returns the bridge Quote without computing totals", async () => {
    const { store, cookieHeader } = await staffCookies();
    const result = await handleQuote({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader,
      body: REQUEST,
      now: NOW,
      sessionStore: store,
      allowedOrigins: [ORIGIN],
      bridge: {
        async postQuote(request, correlationId) {
          expect(request.cartRevision).toBe(1);
          expect(request.lines[0]?.quantity).toBe("1");
          return {
            ok: true,
            correlationId,
            data: {
              id: "quote-1",
              fingerprint: "fp-1",
              cartId: request.cartId,
              cartRevision: request.cartRevision,
              customer: request.customer,
              locationId: request.locationId,
              currency: "GHS",
              lines: [],
              subtotal: { minor: 1500, currency: "GHS" },
              discount: { minor: 0, currency: "GHS" },
              tax: { minor: 0, currency: "GHS" },
              total: { minor: 1500, currency: "GHS" },
              calculatedAt: "2026-09-13T20:00:00.000Z",
              expiresAt: "2026-09-13T21:00:00.000Z",
              purchasable: true,
            },
          };
        },
      },
    });
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.data.total.minor).toBe(1500);
    }
  });
});

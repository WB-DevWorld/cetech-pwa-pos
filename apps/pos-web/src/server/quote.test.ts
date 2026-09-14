import { describe, expect, test } from "vitest";
import type { Quote, QuoteRequest } from "../../../../docs/contracts/domain.generated";
import { STAFF_CSRF_COOKIE, STAFF_SESSION_COOKIE } from "../config/auth";
import { createEphemeralInMemoryStaffSessionStore } from "./auth/session-store";
import { handleQuote, type QuoteBridge } from "./quotes/handle-quote";

const CORRELATION = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ORIGIN = "https://pos.example.test";
const CSRF = "csrf-quote-token";
const NOW = new Date("2026-09-13T20:00:00.000Z");
const FINGERPRINT = "0123456789abcdef0123456789abcdef";

const REQUEST: QuoteRequest = {
  cartId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  cartRevision: 1,
  customer: { kind: "walkin" },
  locationId: "loc_a1",
  lines: [{ lineId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", productId: "p-hardener", quantity: "1" }],
};

const B2B_REQUEST: QuoteRequest = {
  ...REQUEST,
  customer: { kind: "b2b", customerId: "cust-b2b-1" },
};

const RETAIL_REQUEST: QuoteRequest = {
  ...REQUEST,
  customer: { kind: "retail", customerId: "cust-retail-1" },
};

function money(minor: number) {
  return { minor, currency: "GHS" as const };
}

function validQuote(request: QuoteRequest, totalMinor = 1500): Quote {
  const line = request.lines[0]!;
  const unit = money(totalMinor);
  const zero = money(0);
  return {
    id: "quote-1",
    fingerprint: FINGERPRINT,
    cartId: request.cartId,
    cartRevision: request.cartRevision,
    customer: request.customer,
    locationId: request.locationId,
    currency: "GHS",
    lines: [
      {
        lineId: line.lineId,
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: unit,
        subtotal: unit,
        discount: zero,
        tax: zero,
        total: unit,
        stockStatus: "in_stock",
        purchasable: true,
        problems: [],
        ...(line.variationId === undefined ? {} : { variationId: line.variationId }),
      },
    ],
    subtotal: unit,
    discount: zero,
    tax: zero,
    total: unit,
    calculatedAt: "2026-09-13T20:00:00.000Z",
    expiresAt: "2026-09-13T21:00:00.000Z",
    purchasable: true,
  };
}

function quotingBridge(quote?: Quote): QuoteBridge {
  return {
    async postQuote(request, correlationId) {
      return {
        ok: true,
        correlationId,
        data: quote ?? validQuote(request),
      };
    },
  };
}

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

async function postQuote(body: unknown, bridge?: QuoteBridge) {
  const { store, cookieHeader } = await staffCookies();
  return handleQuote({
    correlationIdHeader: CORRELATION,
    origin: ORIGIN,
    referer: null,
    csrfHeader: CSRF,
    cookieHeader,
    body,
    now: NOW,
    sessionStore: store,
    allowedOrigins: [ORIGIN],
    bridge,
  });
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
    expect(result.headers["X-Correlation-ID"]).toBe(CORRELATION);
  });

  test("missing bridge is INTEGRATION_UNAVAILABLE after auth", async () => {
    const result = await postQuote(REQUEST);
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("INTEGRATION_UNAVAILABLE");
      expect(result.body.correlationId).toBe(CORRELATION);
    }
  });

  test("forwards a valid walk-in QuoteRequest and returns the bridge Quote without computing totals", async () => {
    const result = await postQuote(REQUEST, quotingBridge());
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(result.headers["X-Correlation-ID"]).toBe(CORRELATION);
    if (result.body.ok) {
      expect(result.body.data.total.minor).toBe(1500);
      expect(result.body.data.fingerprint).toBe(FINGERPRINT);
      expect(result.body.correlationId).toBe(CORRELATION);
    }
  });

  test("forwards a valid B2B QuoteRequest and returns the matching Quote", async () => {
    const result = await postQuote(B2B_REQUEST, quotingBridge());
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.data.customer).toEqual({ kind: "b2b", customerId: "cust-b2b-1" });
      expect(result.body.data.total.minor).toBe(1500);
    }
  });

  test("forwards a valid retail QuoteRequest and returns the matching Quote", async () => {
    const result = await postQuote(RETAIL_REQUEST, quotingBridge());
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.data.customer).toEqual({ kind: "retail", customerId: "cust-retail-1" });
    }
  });

  test("passes through a typed bridge failure without treating it as a Quote", async () => {
    const result = await postQuote(REQUEST, {
      async postQuote(_request, correlationId) {
        return {
          ok: false,
          correlationId,
          error: {
            code: "QUOTE_CHANGED",
            message: "quote changed",
            retryable: false,
            nextAction: "review_quote",
          },
        };
      },
    });
    expect(result.status).toBe(409);
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("QUOTE_CHANGED");
      expect(result.body.correlationId).toBe(CORRELATION);
    }
  });
});

function without(value: object, key: string): Record<string, unknown> {
  const next = { ...value } as Record<string, unknown>;
  delete next[key];
  return next;
}

describe("HARDEN-02 QuoteRequest schema at the BFF boundary", () => {
  test.each([
    ["missing required cartId", without(REQUEST, "cartId")],
    ["missing required lines", without(REQUEST, "lines")],
    ["missing required customer", without(REQUEST, "customer")],
    ["wrong nested type: quantity number", { ...REQUEST, lines: [{ ...REQUEST.lines[0]!, quantity: 1 }] }],
    ["wrong nested type: customer string", { ...REQUEST, customer: "walkin" }],
    ["wrong nested type: cartRevision string", { ...REQUEST, cartRevision: "1" }],
    ["invalid quantity zero", { ...REQUEST, lines: [{ ...REQUEST.lines[0]!, quantity: "0" }] }],
    ["invalid quantity trailing zeroes", { ...REQUEST, lines: [{ ...REQUEST.lines[0]!, quantity: "1.00" }] }],
    ["invalid customer: b2b without customerId", { ...REQUEST, customer: { kind: "b2b" } }],
    ["invalid customer: walkin extra property", { ...REQUEST, customer: { kind: "walkin", customerId: "c1" } }],
    ["invalid line missing productId", { ...REQUEST, lines: [{ lineId: REQUEST.lines[0]!.lineId, quantity: "1" }] }],
    ["invalid UUID format", { ...REQUEST, cartId: "not-a-uuid" }],
    ["invalid locationId format", { ...REQUEST, locationId: "loc a1" }],
    ["invalid customer kind enum", { ...REQUEST, customer: { kind: "guest" } }],
    ["unexpected property on request", { ...REQUEST, total: money(1500) }],
    ["unexpected property on line", { ...REQUEST, lines: [{ ...REQUEST.lines[0]!, unitPrice: money(1500) }] }],
    ["empty lines array", { ...REQUEST, lines: [] }],
  ] as const)("rejects %s before invoking the bridge", async (_name, body) => {
    let called = 0;
    const result = await postQuote(body, {
      async postQuote() {
        called += 1;
        throw new Error("bridge must not run for an invalid QuoteRequest");
      },
    });
    expect(called).toBe(0);
    expect(result.status).toBe(400);
    expect(result.headers["X-Correlation-ID"]).toBe(CORRELATION);
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("VALIDATION_ERROR");
      expect(result.body.correlationId).toBe(CORRELATION);
    }
  });
});

function patchedQuote(patch: Record<string, unknown>): Record<string, unknown> {
  return { ...validQuote(REQUEST), ...patch };
}

describe("HARDEN-02 Quote schema at the BFF boundary", () => {
  const validLine = validQuote(REQUEST).lines[0]!;
  test.each([
    ["missing required fingerprint", without(validQuote(REQUEST), "fingerprint")],
    ["empty lines", patchedQuote({ lines: [] })],
    ["fingerprint shorter than 32", patchedQuote({ fingerprint: "fp-1" })],
    ["invalid money: negative total", patchedQuote({ total: { minor: -1, currency: "GHS" } })],
    ["invalid money: fractional minor", patchedQuote({ total: { minor: 1.5, currency: "GHS" } })],
    ["invalid money: extra property", patchedQuote({ total: { minor: 1500, currency: "GHS", label: "GHS 15" } })],
    ["invalid quantity on line", patchedQuote({ lines: [{ ...validLine, quantity: "0" }] })],
    ["invalid stockStatus enum", patchedQuote({ lines: [{ ...validLine, stockStatus: "available" }] })],
    ["invalid QuoteProblem code", patchedQuote({ lines: [{ ...validLine, problems: [{ code: "NOPE", message: "x" }] }] })],
    ["invalid timestamp format", patchedQuote({ calculatedAt: "2026-09-13 20:00:00Z" })],
    ["invalid currency format", patchedQuote({ currency: "ghs" })],
    ["unexpected property on quote", patchedQuote({ clientTotal: money(1500) })],
    ["wrong nested type: purchasable string", patchedQuote({ purchasable: "true" })],
    ["invalid customer structure", patchedQuote({ customer: { kind: "b2b" } })],
  ])("rejects %s from the bridge before exposing it", async (_name, invalid) => {
    const result = await postQuote(REQUEST, quotingBridge(invalid as Quote));
    expect(result.status).toBe(503);
    expect(result.headers["X-Correlation-ID"]).toBe(CORRELATION);
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("INTEGRATION_UNAVAILABLE");
      expect(result.body.correlationId).toBe(CORRELATION);
      expect(result.body.error.message).toBe("quote bridge returned an invalid Quote");
    }
  });
});

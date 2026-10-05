import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Quote, QuoteRequest } from "../../../../../docs/contracts/domain.generated";
import type { PosRestFetch } from "../http/server-fetch";
import { createSupabaseStaffSessionStore } from "../auth/supabase-session-store";
import { createSupabaseStaffAssignmentDirectory } from "../auth/supabase-assignment-directory";
import { createSupabaseCheckoutStore } from "../sales/supabase-checkout-store";
import { createSupabaseCatalogProjectionStore } from "../catalog/catalog-projection-store";
import { POST } from "../../app/api/pos/v1/quotes/route";

const dependencies = vi.hoisted(() => ({
  fetch: vi.fn<PosRestFetch>(), session: vi.fn(), checkout: vi.fn(), assignments: vi.fn(),
  catalog: vi.fn(), bridge: vi.fn(), postQuote: vi.fn(),
}));
vi.mock("../../config/env", () => ({ staffAllowedOrigins: () => ["https://pos.invalid"] }));
vi.mock("../http/server-fetch", () => ({ createServerRestFetch: () => dependencies.fetch }));
vi.mock("../auth/compose-session-store", () => ({ composeStaffSessionStore: dependencies.session }));
vi.mock("../sales/compose-checkout-runtime", () => ({ composeCheckoutRuntime: dependencies.checkout }));
vi.mock("../sales/compose-assignment-directory", () => ({ composeStaffAssignmentDirectory: dependencies.assignments }));
vi.mock("../catalog/catalog-projection-store", async (importOriginal) => ({
  ...await importOriginal<typeof import("../catalog/catalog-projection-store")>(),
  composeCatalogProjectionStore: dependencies.catalog,
}));
vi.mock("./compose-quote-bridge", () => ({ composeQuoteBridge: dependencies.bridge }));

const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const CSRF = "fixture-csrf";
const EXPIRES = "2099-01-01T00:00:00.000Z";
const request: QuoteRequest = {
  cartId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", cartRevision: 1,
  locationId: "loc", customer: { kind: "walkin" },
  lines: [{ lineId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", productId: "pos-product", quantity: "1" }],
};

function quoteFromRequest(input: QuoteRequest): Quote {
  const total = { minor: 100, currency: "GHS" as const };
  const zero = { minor: 0, currency: "GHS" as const };
  return {
    ...input, id: "fixture-quote", fingerprint: "0123456789abcdef0123456789abcdef", currency: "GHS",
    lines: input.lines.map((line) => ({ ...line, unitPrice: total, subtotal: total, discount: zero, tax: zero,
      total, stockStatus: "in_stock", purchasable: true, problems: [] })),
    subtotal: total, discount: zero, tax: zero, total,
    calculatedAt: "2026-10-05T12:00:00.000Z", expiresAt: EXPIRES, purchasable: true,
  };
}

let failedTable: string | undefined;
function makeRequest(body = JSON.stringify(request)): NextRequest {
  return new NextRequest("https://pos.invalid/api/pos/v1/quotes", {
    method: "POST", body,
    headers: { "content-type": "application/json", origin: "https://pos.invalid", "x-correlation-id": CORRELATION,
      cookie: `cetech_pos_sid=${SESSION_ID}; cetech_pos_csrf=${CSRF}`, "x-csrf-token": CSRF },
  });
}

function expectResponseHeaders(response: Response, stages: readonly string[]): void {
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-correlation-id")).toBe(CORRELATION);
  expect(response.headers.has("timing-allow-origin")).toBe(false);
  expect(response.headers.has("access-control-allow-origin")).toBe(false);
  const timing = response.headers.get("server-timing");
  expect(timing).not.toBeNull();
  const metrics = timing!.split(", ");
  expect(metrics.map((metric) => metric.split(";")[0])).toEqual(["bff", ...stages]);
  for (const metric of metrics) expect(metric).toMatch(/^(bff|session|assignments|catalogIdentity|bridge|saveSnapshot);dur=\d+$/);
}

function restPaths(): string[] {
  return dependencies.fetch.mock.calls.map(([url, init]) => `${init.method} ${new URL(url).pathname.split("/").at(-1)}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  failedTable = undefined;
  dependencies.fetch.mockImplementation(async (url, init) => {
    const table = new URL(url).pathname.split("/").at(-1)!;
    const status = table === failedTable ? 503 : init.method === "GET" ? 200 : 201;
    let body: unknown = [];
    if (table === "pos_staff_sessions") body = [{ id: SESSION_ID, organization_id: "org", actor_id: "actor",
      csrf_token: CSRF, revoked_at: null, expires_at: EXPIRES,
      session_payload: { actorId: "actor", organizationId: "org", displayName: "Fixture", locationIds: ["loc"], capabilities: [], expiresAt: EXPIRES } }];
    if (table === "pos_staff_location_assignments") body = [{ organization_id: "org", actor_id: "actor", location_id: "loc", role: "cashier" }];
    if (table === "pos_staff_register_assignments") body = [{ organization_id: "org", actor_id: "actor", location_id: "loc", register_id: "reg" }];
    if (table === "pos_catalog_items") body = [{ organization_id: "org", item_id: "pos-product", source_system: "woocommerce", source_item_id: "101", tombstoned_at: null }];
    if (table === "pos_locations") body = [{ id: "loc", organization_id: "org" }];
    return { ok: status < 400, status, json: async () => body };
  });
  const options = { url: "https://supabase.invalid", serviceRoleKey: "SYNTHETIC-NOT-A-CREDENTIAL", fetchImpl: dependencies.fetch };
  dependencies.session.mockReturnValue(createSupabaseStaffSessionStore(options));
  dependencies.checkout.mockReturnValue({ store: createSupabaseCheckoutStore(options) });
  dependencies.assignments.mockReturnValue(createSupabaseStaffAssignmentDirectory(options));
  dependencies.catalog.mockReturnValue(createSupabaseCatalogProjectionStore(options));
  dependencies.postQuote.mockImplementation(async (input: QuoteRequest) => ({ ok: true, data: quoteFromRequest(input), correlationId: CORRELATION }));
  dependencies.bridge.mockReturnValue({ postQuote: dependencies.postQuote });
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe("quote route timing without commercial behavior changes", () => {
  test("successful quote preserves mapped body and all six REST requests plus one Woo request", async () => {
    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: quoteFromRequest(request), correlationId: CORRELATION });
    expectResponseHeaders(response, ["session", "assignments", "catalogIdentity", "bridge", "saveSnapshot"]);
    const logged = JSON.parse(vi.mocked(console.info).mock.calls[0]![0] as string);
    expect(response.headers.get("server-timing")!.split(", ")[0]).toBe(`bff;dur=${logged.elapsedMs}`);
    expect(restPaths()).toEqual([
      "GET pos_staff_sessions", "GET pos_staff_location_assignments", "GET pos_staff_register_assignments",
      "GET pos_catalog_items", "GET pos_locations", "POST pos_quote_snapshots",
    ]);
    expect(dependencies.postQuote).toHaveBeenCalledTimes(1);
    expect(dependencies.postQuote.mock.calls[0]![0].lines[0].productId).toBe("101");
    for (const [, init] of dependencies.fetch.mock.calls) expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  test("composition failure preserves failure envelope and makes no upstream request", async () => {
    dependencies.session.mockImplementationOnce(() => { throw new Error("fixture composition failure"); });
    const response = await POST(makeRequest());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, correlationId: CORRELATION, error: {
      code: "INTEGRATION_UNAVAILABLE", message: "durable staff session, checkout, and catalog identity stores are required",
      retryable: true, nextAction: "resolve",
    } });
    expectResponseHeaders(response, []);
    expect(dependencies.fetch).not.toHaveBeenCalled();
    expect(dependencies.postQuote).not.toHaveBeenCalled();
  });

  test("CSRF denial remains before every upstream request and exposes no unentered phases", async () => {
    const denied = makeRequest();
    denied.headers.delete("x-csrf-token");
    const response = await POST(denied);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, correlationId: CORRELATION, error: {
      code: "FORBIDDEN", message: "mutation requires matching CSRF cookie and header", retryable: false, nextAction: "none",
    } });
    expectResponseHeaders(response, []);
    expect(dependencies.fetch).not.toHaveBeenCalled();
    expect(dependencies.postQuote).not.toHaveBeenCalled();
  });

  test("malformed JSON retains validation failure after session verification without Woo", async () => {
    const response = await POST(makeRequest("{"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, correlationId: CORRELATION, error: {
      code: "VALIDATION_ERROR", message: "QuoteRequest is invalid", retryable: false, nextAction: "none",
    } });
    expectResponseHeaders(response, ["session"]);
    expect(restPaths()).toEqual(["GET pos_staff_sessions"]);
    expect(dependencies.postQuote).not.toHaveBeenCalled();
  });

  test("typed session-store failure includes only its entered phase and never calls Woo", async () => {
    failedTable = "pos_staff_sessions";
    const response = await POST(makeRequest());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, correlationId: CORRELATION, error: {
      code: "INTEGRATION_UNAVAILABLE", message: "staff session store is unavailable", retryable: true, nextAction: "resolve",
    } });
    expectResponseHeaders(response, ["session"]);
    expect(restPaths()).toEqual(["GET pos_staff_sessions"]);
    expect(dependencies.postQuote).not.toHaveBeenCalled();
  });

  test("typed assignment failure remains unavailable without identity lookup or Woo", async () => {
    failedTable = "pos_staff_location_assignments";
    const response = await POST(makeRequest());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, correlationId: CORRELATION,
      error: { code: "INTEGRATION_UNAVAILABLE", message: "staff assignment directory is unavailable" } });
    expectResponseHeaders(response, ["session", "assignments"]);
    expect(dependencies.fetch).toHaveBeenCalledTimes(3);
    expect(dependencies.postQuote).not.toHaveBeenCalled();
  });

  test("typed Woo failure preserves its body/status without saving a snapshot", async () => {
    const failure = { ok: false, correlationId: CORRELATION, error: {
      code: "VALIDATION_ERROR", message: "fixture product rejected", retryable: false, nextAction: "none",
    } };
    dependencies.postQuote.mockResolvedValueOnce(failure);
    const response = await POST(makeRequest());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(failure);
    expectResponseHeaders(response, ["session", "assignments", "catalogIdentity", "bridge"]);
    expect(dependencies.fetch).toHaveBeenCalledTimes(4);
    expect(dependencies.postQuote).toHaveBeenCalledTimes(1);
  });

  test("a handler exception from failed snapshot write keeps the existing failed result and counts", async () => {
    failedTable = "pos_quote_snapshots";
    const response = await POST(makeRequest());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, correlationId: CORRELATION, error: {
      code: "INTEGRATION_UNAVAILABLE", message: "Price check could not finish. Check the price again.", retryable: true, nextAction: "resolve",
    } });
    expectResponseHeaders(response, ["session", "assignments", "catalogIdentity", "bridge", "saveSnapshot"]);
    expect(dependencies.fetch).toHaveBeenCalledTimes(6);
    expect(dependencies.postQuote).toHaveBeenCalledTimes(1);
  });
});

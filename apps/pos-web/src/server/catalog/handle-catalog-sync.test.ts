import { describe, expect, test } from "vitest";
import type { CatalogSourceRecord } from "../../core/catalog/source";
import type { CatalogSyncPage } from "../../core/catalog/sync-page";
import { STAFF_CSRF_COOKIE, STAFF_SESSION_COOKIE } from "../../config/auth";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import {
  catalogUrl,
  composeCatalogBridge,
  withCatalogQuery,
  type CatalogBridge,
} from "./compose-catalog-bridge";
import { handleCatalogSync } from "./handle-catalog-sync";
import { mapBridgeCatalogItem } from "./map-bridge-catalog";
import { createMemoryCatalogProjectionStore } from "./catalog-projection-store";
import { quotesUrl } from "../quotes/compose-quote-bridge";

const CORRELATION = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CSRF = "csrf-catalog-token";
const NOW = new Date("2026-09-17T12:00:00.000Z");

const SIMPLE_DTO = {
  sourceSystem: "woocommerce",
  sourceItemId: "101",
  sourceVersion: "2026-09-17T12:00:00.000Z:101",
  name: "Simple Switch",
  sku: "0123SKU",
  barcodes: ["0012345678901"],
  kind: "simple",
  purchasable: true,
  stockStatus: "in_stock",
  sourceUpdatedAt: "2026-09-17T12:00:00.000Z",
  deleted: false,
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
      expiresAt: "2026-09-17T22:00:00.000Z",
    },
    CSRF,
    new Date("2026-09-17T22:00:00.000Z"),
  );
  return {
    store,
    cookieHeader: `${STAFF_SESSION_COOKIE}=${sessionId}; ${STAFF_CSRF_COOKIE}=${CSRF}`,
  };
}

function pageBridge(
  items: unknown[],
  nextCursor: string | null = null,
  onQuery?: (query: { cursor?: string; limit?: number; modifiedAfter?: string }) => void,
): CatalogBridge {
  return {
    async fetchPage(query, correlationId) {
      onQuery?.(query);
      return {
        ok: true,
        correlationId,
        page: { items, nextCursor },
      };
    },
  };
}

describe("STG-04 BFF catalog sync", () => {
  test("anonymous request is AUTH_REQUIRED and does not call the producer", async () => {
    let called = 0;
    const result = await handleCatalogSync({
      correlationIdHeader: CORRELATION,
      cookieHeader: `${STAFF_CSRF_COOKIE}=${CSRF}`,
      now: NOW,
      appEnv: "staging",
      sessionStore: createEphemeralInMemoryStaffSessionStore(),
      bridge: {
        async fetchPage() {
          called += 1;
          throw new Error("producer must not run");
        },
      },
    });
    expect(called).toBe(0);
    expect(result.status).toBe(401);
    expect(result.body.ok).toBe(false);
  });

  test("missing producer is INTEGRATION_UNAVAILABLE after auth in staging", async () => {
    const { store, cookieHeader } = await staffCookies();
    const result = await handleCatalogSync({
      correlationIdHeader: CORRELATION,
      cookieHeader,
      now: NOW,
      appEnv: "staging",
      sessionStore: store,
    });
    expect(result.status).toBe(503);
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("INTEGRATION_UNAVAILABLE");
      expect(result.body.error.message).toContain("unavailable");
    }
  });

  test("maps producer items, persists projection identity, and forwards cursor/limit/modifiedAfter", async () => {
    const { store, cookieHeader } = await staffCookies();
    let seen: { cursor?: string; limit?: number; modifiedAfter?: string } | undefined;
    const projectionStore = createMemoryCatalogProjectionStore();
    const result = await handleCatalogSync({
      correlationIdHeader: CORRELATION,
      cookieHeader,
      cursor: "100",
      limit: "25",
      modifiedAfter: "2026-09-17T00:00:00.000Z",
      now: NOW,
      appEnv: "staging",
      sessionStore: store,
      projectionStore,
      bridge: pageBridge([SIMPLE_DTO], "101", (query) => {
        seen = query;
      }),
    });
    expect(result.status).toBe(200);
    expect(seen).toEqual({ cursor: "100", limit: 25, modifiedAfter: "2026-09-17T00:00:00.000Z" });
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.data.policy).toBe("provider_required");
      expect(result.body.data.sourceSystem).toBe("woocommerce");
      expect(result.body.data.nextCursor).toBe("101");
      expect(result.body.data.items).toHaveLength(1);
      const item = result.body.data.items[0] as CatalogSourceRecord;
      expect(item.posItemId).toBe(mapBridgeCatalogItem(SIMPLE_DTO)?.posItemId);
      expect(item.displayPrice).toBeUndefined();
      const mapped = await projectionStore.loadByItemIds("org_a", [item.posItemId]);
      expect(mapped[0]?.sourceItemId).toBe("101");
      expect(JSON.stringify(mapped)).not.toContain("display");
      expect(JSON.stringify(result.body)).not.toContain("BRIDGE_USERNAME");
      expect(JSON.stringify(result.body)).not.toContain("BRIDGE_APPLICATION_PASSWORD");
    }
  });

  test("rejects an invalid cursor before invoking the producer", async () => {
    let called = 0;
    const { store, cookieHeader } = await staffCookies();
    const result = await handleCatalogSync({
      correlationIdHeader: CORRELATION,
      cookieHeader,
      cursor: "abc",
      now: NOW,
      appEnv: "staging",
      sessionStore: store,
      bridge: {
        async fetchPage() {
          called += 1;
          throw new Error("must not run");
        },
      },
    });
    expect(called).toBe(0);
    expect(result.status).toBe(400);
  });

  test("catalogUrl and quotesUrl stay on the CETECH POS Bridge namespace without duplicating wp-json", () => {
    expect(catalogUrl("https://training.cetechbpa.com")).toBe(
      "https://training.cetechbpa.com/wp-json/cetech-pos/v1/catalog",
    );
    expect(quotesUrl("https://training.cetechbpa.com")).toBe(
      "https://training.cetechbpa.com/wp-json/cetech-pos/v1/quotes",
    );
    expect(quotesUrl("https://training.cetechbpa.com/wp-json/cetech-pos/v1")).toBe(
      "https://training.cetechbpa.com/wp-json/cetech-pos/v1/quotes",
    );
    expect(quotesUrl("https://training.cetechbpa.com/wp-json/cetech-pos/v1/quotes")).toBe(
      "https://training.cetechbpa.com/wp-json/cetech-pos/v1/quotes",
    );
    expect(
      withCatalogQuery("https://training.cetechbpa.com/wp-json/cetech-pos/v1/catalog", {
        cursor: "9",
        limit: 50,
        modifiedAfter: "2026-09-17T00:00:00.000Z",
      }),
    ).toContain("cursor=9");
  });

  test("rest_no_route from training is catalog producer unavailable, not a synthetic fallback", async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        code: "rest_no_route",
        message: "No route was found matching the URL and request method",
        data: { status: 400 },
      }),
    });
    const bridge = composeCatalogBridge(
      {
        BRIDGE_BASE_URL: "https://training.cetechbpa.com",
        BRIDGE_USERNAME: "pos-bridge",
        BRIDGE_APPLICATION_PASSWORD: "test-application-password",
      },
      fetchImpl,
    );
    expect(bridge).toBeDefined();
    const result = await bridge!.fetchPage({}, CORRELATION);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INTEGRATION_UNAVAILABLE");
      expect(result.message).toContain("unavailable");
    }
  });
});

describe("STG-04 catalog sync page contract", () => {
  test("success page type does not include prices or WordPress internals", () => {
    const page: CatalogSyncPage = {
      policy: "provider_required",
      sourceSystem: "woocommerce",
      items: [],
      nextCursor: null,
    };
    expect(JSON.stringify(page)).not.toContain("guid");
    expect(JSON.stringify(page)).not.toContain("post_status");
    expect(JSON.stringify(page)).not.toContain("displayPrice");
  });
});

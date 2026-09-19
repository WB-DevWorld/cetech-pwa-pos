import { describe, expect, test } from "vitest";
import { STAFF_CSRF_COOKIE, STAFF_SESSION_COOKIE } from "../../config/auth";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { handleSearchCustomers } from "./handle-search-customers";
import type { CustomerBridge } from "./compose-customer-bridge";

const CORRELATION = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ORIGIN = "https://pos.example.test";
const CSRF = "csrf-ux04-customers";
const NOW = new Date("2026-09-19T12:00:00.000Z");

async function staffCookies() {
  const store = createEphemeralInMemoryStaffSessionStore();
  const sessionId = await store.create(
    {
      actorId: "cashier_a",
      displayName: "Cashier A",
      organizationId: "org_a",
      locationIds: ["loc_a1"],
      capabilities: ["ui.hint.only"],
      expiresAt: "2026-09-19T22:00:00.000Z",
    },
    CSRF,
    new Date("2026-09-19T22:00:00.000Z"),
  );
  return {
    store,
    cookieHeader: `${STAFF_SESSION_COOKIE}=${sessionId}; ${STAFF_CSRF_COOKIE}=${CSRF}`,
  };
}

const assignments = createMemoryAssignmentDirectory([
  {
    actorId: "cashier_a",
    organizationId: "org_a",
    locationRoles: [{ locationId: "loc_a1", role: "cashier" }],
    registerIds: ["reg_a1"],
  },
]);

describe("UX-04 customer directory BFF", () => {
  test("missing producer is INTEGRATION_UNAVAILABLE after auth", async () => {
    const { store, cookieHeader } = await staffCookies();
    const result = await handleSearchCustomers({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: ORIGIN,
      cookieHeader,
      now: NOW,
      sessionStore: store,
      allowedOrigins: [ORIGIN],
      assignments,
      query: "",
    });
    expect(result.status).toBe(503);
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) expect(result.body.error.code).toBe("INTEGRATION_UNAVAILABLE");
  });

  test("maps provider-neutral customer rows without pricing fields", async () => {
    const { store, cookieHeader } = await staffCookies();
    const customers: CustomerBridge = {
      async search(query, correlationId) {
        expect(query).toBe("Ada");
        return {
          ok: true,
          correlationId,
          page: {
            items: [
              {
                id: "12",
                kind: "retail",
                displayName: "Ada Boateng",
                phoneMasked: "024 *** 4567",
              },
            ],
          },
        };
      },
    };
    const result = await handleSearchCustomers({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: ORIGIN,
      cookieHeader,
      now: NOW,
      sessionStore: store,
      allowedOrigins: [ORIGIN],
      assignments,
      query: "Ada",
      customers,
    });
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (!result.body.ok) return;
    expect(result.body.data.items[0]?.displayName).toBe("Ada Boateng");
    expect(JSON.stringify(result.body.data.items)).not.toContain("price");
    expect(JSON.stringify(result.body.data.items)).not.toContain("B2BKing");
  });
});

import { describe, expect, test } from "vitest";
import type { SaleResolution, Session } from "../../../../../docs/contracts/domain.generated";
import type { SalesPort } from "../../../../../docs/contracts/ports";
import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import type { StaffSessionStore } from "../auth/session-store";
import { handleResolveSale } from "./handle-resolve-sale";

const NOW = new Date("2026-09-20T22:00:00.000Z");
const EXPIRES_AT = new Date("2026-09-21T22:00:00.000Z");
const TX = "11111111-1111-4111-8111-111111111099" as const;
const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0099" as const;
const SESSION_ID = "session-r9-resolve";
const PREPARE_KEY = "22222222-2222-4222-8222-222222222099" as const;
const REQUEST_HASH = "abcdefabcdefabcdefabcdefabcdefab";

function sessionStore(session: Session): StaffSessionStore {
  return {
    async create() {
      return SESSION_ID;
    },
    async get(sessionId) {
      return sessionId === SESSION_ID
        ? { session, csrfToken: "csrf-r9", expiresAt: EXPIRES_AT }
        : null;
    },
    async revoke() {},
    async revokeActorSessions() {},
  };
}

function actorSession(): Session {
  return {
    actorId: "cashier-a",
    displayName: "Cashier A",
    organizationId: "org-a",
    locationIds: ["loc-a"],
    capabilities: [],
    expiresAt: EXPIRES_AT.toISOString(),
  };
}

function assignments() {
  return createMemoryAssignmentDirectory([
    {
      actorId: "cashier-a",
      organizationId: "org-a",
      locationRoles: [{ locationId: "loc-a", role: "cashier" }],
      registerIds: ["reg-a"],
    },
  ]);
}

function countingSalesPort(): Pick<SalesPort, "resolve"> & { resolveCount: number } {
  const port = {
    resolveCount: 0,
    async resolve(transactionId: string) {
      port.resolveCount += 1;
      return {
        ok: true as const,
        data: { transactionId, status: "not_found" } as SaleResolution,
        correlationId: CORRELATION,
      };
    },
  };
  return port;
}

describe("R9 handleResolveSale recovery boundary", () => {
  test("authenticated absent transaction returns HTTP 200 not_found without bridge call or sale mutation", async () => {
    const store = createInMemoryCheckoutStore();
    const salesPort = countingSalesPort();

    const result = await handleResolveSale({
      correlationIdHeader: CORRELATION,
      origin: null,
      referer: null,
      cookieHeader: `cetech_pos_sid=${SESSION_ID}`,
      csrfHeader: null,
      transactionId: TX,
      now: NOW,
      sessionStore: sessionStore(actorSession()),
      allowedOrigins: [],
      checkoutStore: store,
      salesPort,
      assignments: assignments(),
    });

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (!result.body.ok) {
      throw new Error("expected successful not_found resolution");
    }
    expect(result.body.data).toEqual({ transactionId: TX, status: "not_found" });
    expect(salesPort.resolveCount).toBe(0);
    expect(await store.getSale(TX)).toBeUndefined();
  });

  test("trusted prepare binding outside actor scope remains fail-closed and never calls bridge", async () => {
    const store = createInMemoryCheckoutStore();
    const salesPort = countingSalesPort();

    const claim = await store.claimIdempotency(
      "org-b",
      "sale.prepare",
      PREPARE_KEY,
      REQUEST_HASH,
      "loc-b",
      {
        registerId: "reg-b",
        shiftId: "33333333-3333-4333-8333-333333333399",
        transactionId: TX,
      },
    );
    expect(claim.kind).toBe("acquired");

    const result = await handleResolveSale({
      correlationIdHeader: CORRELATION,
      origin: null,
      referer: null,
      cookieHeader: `cetech_pos_sid=${SESSION_ID}`,
      csrfHeader: null,
      transactionId: TX,
      now: NOW,
      sessionStore: sessionStore(actorSession()),
      allowedOrigins: [],
      checkoutStore: store,
      salesPort,
      assignments: assignments(),
    });

    expect(result.status).toBe(403);
    expect(result.body.ok).toBe(false);
    if (result.body.ok) {
      throw new Error("expected scoped recovery to remain forbidden");
    }
    expect(result.body.error.code).toBe("FORBIDDEN");
    expect(salesPort.resolveCount).toBe(0);
    expect(await store.getSale(TX)).toBeUndefined();
  });
});

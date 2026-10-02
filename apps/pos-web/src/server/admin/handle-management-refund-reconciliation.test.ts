import { describe, expect, test } from "vitest";
import type { Session } from "../../../../../docs/contracts/domain.generated";
import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import { createInMemoryReturnStore } from "../../core/returns/in-memory-store";
import type { ElectronicRefundProvider } from "../payments/refund-provider";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { createMemoryControlPlaneDirectory } from "./control-plane-directory";
import { handleManagementRefundReconciliation } from "./handle-management-refund-reconciliation";

const NOW = new Date("2026-09-22T23:00:00.000Z");
const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REFUND = "55555555-5555-4555-8555-555555555555";
const ORIGIN = "https://pos.example.test";

async function session(actorId: string) {
  const sessions = createEphemeralInMemoryStaffSessionStore();
  const sid = await sessions.create({
    actorId,
    displayName: actorId,
    organizationId: "org_a",
    locationIds: ["loc_a1"],
    capabilities: [],
    expiresAt: "2026-09-23T00:00:00.000Z",
  } satisfies Session, "csrf", new Date("2026-09-23T00:00:00.000Z"));
  return { sessions, cookieHeader: `cetech_pos_sid=${sid}` };
}

function provider(): ElectronicRefundProvider & { createCount: number; resolveCount: number } {
  const state = { createCount: 0, resolveCount: 0 };
  return {
    id: "test-refund",
    get createCount() {
      return state.createCount;
    },
    get resolveCount() {
      return state.resolveCount;
    },
    async createRefund() {
      state.createCount += 1;
      return { kind: "failed", message: "must not create" };
    },
    async resolveRefund() {
      state.resolveCount += 1;
      return {
        kind: "completed",
        providerRefundReference: "pref_existing",
        amount: { minor: 1500, currency: "GHS" },
        currency: "GHS",
        domain: "test",
      };
    },
  };
}

describe("ADMIN-105 refund reconciliation", () => {
  test("manager checks the existing refund and does not create another", async () => {
    const auth = await session("manager_a");
    const returns = createInMemoryReturnStore();
    await returns.insertTenderRefund({
      refundId: REFUND,
      returnId: "33333333-3333-4333-8333-333333333333",
      channel: "provider_electronic",
      status: "pending",
      amount: { minor: 1500, currency: "GHS" },
      organizationId: "org_a",
      locationId: "loc_a1",
      paymentId: "66666666-6666-4666-8666-666666666666",
      transactionId: "44444444-4444-4444-8444-444444444444",
    });
    const refunds = provider();
    const result = await handleManagementRefundReconciliation({
      correlationId: CORRELATION,
      cookieHeader: auth.cookieHeader,
      now: NOW,
      sessions: auth.sessions,
      assignments: createMemoryAssignmentDirectory([{
        actorId: "manager_a",
        organizationId: "org_a",
        locationRoles: [{ locationId: "loc_a1", role: "manager" }],
        registerIds: ["reg_a"],
      }]),
      controlPlane: createMemoryControlPlaneDirectory([]),
      checkoutStore: createInMemoryCheckoutStore(),
      returns,
      provider: refunds,
      refundId: REFUND,
      protection: {
        origin: ORIGIN,
        referer: null,
        csrfCookie: "csrf",
        csrfHeader: "csrf",
        allowedOrigins: [ORIGIN],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected reconciliation");
    expect(result.data.status).toBe("verified");
    expect(result.data.refundId).toBe(REFUND);
    expect(refunds.createCount).toBe(0);
    expect(refunds.resolveCount).toBe(1);
  });

  test("owner without operational manager assignment cannot reconcile a refund", async () => {
    const auth = await session("owner_a");
    const returns = createInMemoryReturnStore();
    await returns.insertTenderRefund({
      refundId: REFUND,
      returnId: "33333333-3333-4333-8333-333333333333",
      channel: "provider_electronic",
      status: "pending",
      amount: { minor: 1500, currency: "GHS" },
      organizationId: "org_a",
      locationId: "loc_a1",
      paymentId: "66666666-6666-4666-8666-666666666666",
      transactionId: "44444444-4444-4444-8444-444444444444",
    });
    const result = await handleManagementRefundReconciliation({
      correlationId: CORRELATION,
      cookieHeader: auth.cookieHeader,
      now: NOW,
      sessions: auth.sessions,
      assignments: createMemoryAssignmentDirectory([{
        actorId: "owner_a",
        organizationId: "org_a",
        locationRoles: [{ locationId: "loc_a1", role: "cashier" }],
        registerIds: ["reg_a"],
      }]),
      controlPlane: createMemoryControlPlaneDirectory([{
        organizationId: "org_a",
        actorId: "owner_a",
        controlRole: "owner",
        status: "active",
      }]),
      checkoutStore: createInMemoryCheckoutStore(),
      returns,
      provider: provider(),
      refundId: REFUND,
      protection: {
        origin: ORIGIN,
        referer: null,
        csrfCookie: "csrf",
        csrfHeader: "csrf",
        allowedOrigins: [ORIGIN],
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
  });
});

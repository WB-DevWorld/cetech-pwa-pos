import { describe, expect, test } from "vitest";
import type { Session } from "../../../../../docs/contracts/domain.generated";
import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import { createMemoryOperationalPolicyStore } from "../admin/operational-policy-store";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { handleRegisterClosePresentation } from "./handle-register-close-presentation";

const NOW = new Date("2026-09-22T23:00:00.000Z");
const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORIGIN = "https://pos.example.test";

async function cashierSession() {
  const sessions = createEphemeralInMemoryStaffSessionStore();
  const sid = await sessions.create({
    actorId: "cashier_a",
    displayName: "cashier_a",
    organizationId: "org_a",
    locationIds: ["loc_a1"],
    capabilities: [],
    expiresAt: "2026-09-23T00:00:00.000Z",
  } satisfies Session, "csrf", new Date("2026-09-23T00:00:00.000Z"));
  return { sessions, cookieHeader: `cetech_pos_sid=${sid}` };
}

async function store() {
  const checkout = createInMemoryCheckoutStore();
  await checkout.seedRegister({
    id: "reg_a",
    name: "Register A",
    locationId: "loc_a1",
    currency: "GHS",
    status: "active",
    organizationId: "org_a",
  });
  await checkout.insertOpenShift({
    id: "11111111-1111-4111-8111-111111111111",
    registerId: "reg_a",
    deviceId: "d1111111-1111-4111-8111-111111111111",
    cashierId: "cashier_a",
    status: "open",
    openingFloat: { minor: 5000, currency: "GHS" },
    openedAt: "2026-09-22T08:00:00.000Z",
    organizationId: "org_a",
    locationId: "loc_a1",
  });
  return checkout;
}

describe("ADMIN-105 register close presentation", () => {
  test("cashier close control follows effective policy", async () => {
    const auth = await cashierSession();
    const assignments = createMemoryAssignmentDirectory([{
      actorId: "cashier_a",
      organizationId: "org_a",
      locationRoles: [{ locationId: "loc_a1", role: "cashier" }],
      registerIds: ["reg_a"],
    }]);
    const hidden = await handleRegisterClosePresentation({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      cookieHeader: auth.cookieHeader,
      now: NOW,
      sessionStore: auth.sessions,
      allowedOrigins: [ORIGIN],
      checkoutStore: await store(),
      assignments,
      policies: createMemoryOperationalPolicyStore(),
      registerId: "reg_a",
    });
    expect(hidden.body.ok).toBe(true);
    if (!hidden.body.ok) throw new Error("expected presentation");
    expect(hidden.body.data.showClose).toBe(false);

    const shown = await handleRegisterClosePresentation({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      cookieHeader: auth.cookieHeader,
      now: NOW,
      sessionStore: auth.sessions,
      allowedOrigins: [ORIGIN],
      checkoutStore: await store(),
      assignments,
      policies: createMemoryOperationalPolicyStore([{
        id: "policy-org",
        organizationId: "org_a",
        updatedByActorId: "owner_a",
        updatedAt: "2026-09-22T00:00:00.000Z",
        cashierCanCloseShift: true,
      }]),
      registerId: "reg_a",
    });
    expect(shown.body.ok).toBe(true);
    if (!shown.body.ok) throw new Error("expected presentation");
    expect(shown.body.data.showClose).toBe(true);
    expect(shown.body.data.notice).toContain("cash difference");
  });
});

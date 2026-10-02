import { describe, expect, test } from "vitest";
import type { Session } from "../../../../../docs/contracts/domain.generated";
import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { createMemoryCashCorrectionAdminStore } from "./cash-correction-admin-store";
import { createMemoryControlPlaneDirectory } from "./control-plane-directory";
import { handleManagementCashCorrection } from "./handle-management-cash-correction";

const NOW = new Date("2026-09-22T23:00:00.000Z");
const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SHIFT = "11111111-1111-4111-8111-111111111111";
const MOVEMENT = "22222222-2222-4222-8222-222222222222";
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

function protection() {
  return {
    origin: ORIGIN,
    referer: null,
    csrfCookie: "csrf",
    csrfHeader: "csrf",
    allowedOrigins: [ORIGIN],
  };
}

async function openShift() {
  const checkout = createInMemoryCheckoutStore();
  await checkout.insertOpenShift({
    id: SHIFT,
    registerId: "reg_a",
    deviceId: "d1111111-1111-4111-8111-111111111111",
    cashierId: "cashier_a",
    status: "open",
    openingFloat: { minor: 5000, currency: "GHS" },
    expectedCash: { minor: 7500, currency: "GHS" },
    openedAt: "2026-09-22T08:00:00.000Z",
    organizationId: "org_a",
    locationId: "loc_a1",
  });
  return checkout;
}

describe("ADMIN-105 cash correction", () => {
  test("manager reversal is the exact opposite and replay does not add another movement", async () => {
    const auth = await session("manager_a");
    const corrections = createMemoryCashCorrectionAdminStore([{
      id: MOVEMENT,
      shiftId: SHIFT,
      kind: "pay_in",
      signedAmountMinor: 2500,
      currency: "GHS",
      createdAt: "2026-09-22T09:00:00.000Z",
    }]);
    const common = {
      correlationId: CORRELATION,
      cookieHeader: auth.cookieHeader,
      now: NOW,
      sessions: auth.sessions,
      assignments: createMemoryAssignmentDirectory([{
        actorId: "manager_a",
        organizationId: "org_a",
        locationRoles: [{ locationId: "loc_a1", role: "manager" as const }],
        registerIds: ["reg_a"],
      }]),
      controlPlane: createMemoryControlPlaneDirectory([]),
      checkout: await openShift(),
      corrections,
      shiftId: SHIFT,
      movementId: MOVEMENT,
      reason: "drawer was short",
      protection: protection(),
    };
    const first = await handleManagementCashCorrection(common);
    const second = await handleManagementCashCorrection(common);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error("expected reversal");
    expect(first.data.signedAmountMinor).toBe(-2500);
    expect(first.data.currency).toBe("GHS");
    expect(first.data.correctsMovementId).toBe(MOVEMENT);
    expect(second.data.movementId).toBe(first.data.movementId);
    expect(second.data.replayed).toBe(true);
    expect(corrections.rows.filter((row) => row.kind === "correction")).toHaveLength(1);
  });

  test("owner without operational manager assignment cannot reverse cash", async () => {
    const auth = await session("owner_a");
    const result = await handleManagementCashCorrection({
      correlationId: CORRELATION,
      cookieHeader: auth.cookieHeader,
      now: NOW,
      sessions: auth.sessions,
      assignments: createMemoryAssignmentDirectory([{
        actorId: "owner_a",
        organizationId: "org_a",
        locationRoles: [{ locationId: "loc_a1", role: "cashier" as const }],
        registerIds: ["reg_a"],
      }]),
      controlPlane: createMemoryControlPlaneDirectory([{
        organizationId: "org_a",
        actorId: "owner_a",
        controlRole: "owner",
        status: "active",
      }]),
      checkout: await openShift(),
      corrections: createMemoryCashCorrectionAdminStore([{
        id: MOVEMENT,
        shiftId: SHIFT,
        kind: "pay_in",
        signedAmountMinor: 2500,
        currency: "GHS",
        createdAt: "2026-09-22T09:00:00.000Z",
      }]),
      shiftId: SHIFT,
      movementId: MOVEMENT,
      reason: "drawer was short",
      protection: protection(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
  });
});

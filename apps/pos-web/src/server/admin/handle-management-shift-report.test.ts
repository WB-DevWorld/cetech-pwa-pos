import { describe, expect, test } from "vitest";
import type { Session } from "../../../../../docs/contracts/domain.generated";
import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { createMemoryControlPlaneDirectory } from "./control-plane-directory";
import { handleManagementShiftReport } from "./handle-management-shift-report";

const NOW = new Date("2026-09-22T23:00:00.000Z");
const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SHIFT = "11111111-1111-4111-8111-111111111111";

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

function manager() {
  return {
    assignments: createMemoryAssignmentDirectory([{
      actorId: "manager_a",
      organizationId: "org_a",
      locationRoles: [{ locationId: "loc_a1", role: "manager" as const }],
      registerIds: ["reg_a"],
    }]),
    controlPlane: createMemoryControlPlaneDirectory([]),
  };
}

describe("ADMIN-105 management shift reports", () => {
  test("X is a live view and is not stored", async () => {
    const auth = await session("manager_a");
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
    const result = await handleManagementShiftReport({
      correlationId: CORRELATION,
      cookieHeader: auth.cookieHeader,
      now: NOW,
      sessions: auth.sessions,
      ...manager(),
      checkout,
      shiftId: SHIFT,
      kind: "X",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected X report");
    expect(result.data.kind).toBe("X");
    expect(result.data.id).toBe(`report-x-${SHIFT}`);
    expect(result.data.expectedCash).toEqual({ minor: 7500, currency: "GHS" });
    expect(await checkout.getShiftReport(SHIFT, "X")).toBeUndefined();
  });

  test("Z returns the durable closed report and does not recalculate it", async () => {
    const auth = await session("manager_a");
    const checkout = createInMemoryCheckoutStore();
    await checkout.insertOpenShift({
      id: SHIFT,
      registerId: "reg_a",
      deviceId: "d1111111-1111-4111-8111-111111111111",
      cashierId: "cashier_a",
      status: "open",
      openingFloat: { minor: 5000, currency: "GHS" },
      openedAt: "2026-09-22T08:00:00.000Z",
      organizationId: "org_a",
      locationId: "loc_a1",
    });
    await checkout.closeShift({
      shiftId: SHIFT,
      countedCash: { minor: 4800, currency: "GHS" },
      status: "closed",
      closedAt: "2026-09-22T18:00:00.000Z",
      zReportId: "z-reg-a",
    });
    const durable = {
      id: "z-reg-a",
      shiftId: SHIFT,
      kind: "Z" as const,
      expectedCash: { minor: 5000, currency: "GHS" as const },
      countedCash: { minor: 4800, currency: "GHS" as const },
      variance: { minor: -200, currency: "GHS" as const },
      createdAt: "2026-09-22T18:00:00.000Z",
    };
    await checkout.saveShiftReport(durable);
    const result = await handleManagementShiftReport({
      correlationId: CORRELATION,
      cookieHeader: auth.cookieHeader,
      now: NOW,
      sessions: auth.sessions,
      ...manager(),
      checkout,
      shiftId: SHIFT,
      kind: "Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected Z report");
    expect(result.data).toEqual(durable);
  });
});

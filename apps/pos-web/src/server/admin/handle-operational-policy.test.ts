import { describe, expect, test } from "vitest";
import type { Session } from "../../../../../docs/contracts/domain.generated";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { createMemoryControlPlaneDirectory } from "./control-plane-directory";
import {
  handleGetOperationalPolicy,
  handleSetOperationalPolicy,
} from "./handle-operational-policy";
import { createMemoryOperationalPolicyStore } from "./operational-policy-store";

const NOW = new Date("2026-09-22T12:30:00.000Z");
const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORIGIN = "https://pos.example.test";

function session(actorId: string): Session {
  return {
    actorId,
    displayName: actorId,
    organizationId: "org_a",
    locationIds: ["loc_a1"],
    capabilities: [],
    expiresAt: "2026-09-22T13:30:00.000Z",
  };
}

async function runtime(actorId: string, role: "cashier" | "manager") {
  const sessions = createEphemeralInMemoryStaffSessionStore();
  const sessionId = await sessions.create(session(actorId), "csrf", new Date("2026-09-22T13:30:00.000Z"));
  return {
    correlationId: CORRELATION,
    cookieHeader: `cetech_pos_sid=${sessionId}`,
    now: NOW,
    sessions,
    assignments: createMemoryAssignmentDirectory([
      {
        actorId,
        organizationId: "org_a",
        locationRoles: [{ locationId: "loc_a1", role }],
        registerIds: ["reg_a"],
      },
    ]),
    policies: createMemoryOperationalPolicyStore(),
  };
}

describe("ADMIN-105 operational policy API", () => {
  test("manager can read effective policy in managed location", async () => {
    const base = await runtime("manager_a", "manager");
    const result = await handleGetOperationalPolicy({
      ...base,
      controlPlane: createMemoryControlPlaneDirectory([]),
      locationId: "loc_a1",
      registerId: "reg_a",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected policy");
    expect(result.data.effective.cashierCanCloseShift).toBe(false);
    expect(result.data.effective.managerCanCloseShift).toBe(true);
    expect(result.data.canManage).toBe(false);
  });

  test("manager cannot read policy outside managed location", async () => {
    const base = await runtime("manager_a", "manager");
    const result = await handleGetOperationalPolicy({
      ...base,
      controlPlane: createMemoryControlPlaneDirectory([]),
      locationId: "loc_a2",
      registerId: "reg_b",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
  });

  test("operational manager cannot mutate policy", async () => {
    const base = await runtime("manager_a", "manager");
    const result = await handleSetOperationalPolicy({
      ...base,
      controlPlane: createMemoryControlPlaneDirectory([]),
      locationId: "loc_a1",
      registerId: "reg_a",
      override: { cashierCanCloseShift: true },
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

  test("organization admin may configure cashier and manager close authority", async () => {
    const base = await runtime("admin_a", "cashier");
    const controlPlane = createMemoryControlPlaneDirectory([
      {
        organizationId: "org_a",
        actorId: "admin_a",
        controlRole: "admin",
        status: "active",
      },
    ]);
    const result = await handleSetOperationalPolicy({
      ...base,
      controlPlane,
      locationId: "loc_a1",
      registerId: "reg_a",
      override: {
        cashierCanCloseShift: true,
        managerCanCloseShift: true,
        cashierOwnShiftOnly: true,
        managerCanCloseOthersShift: true,
        nonZeroVarianceRequiresManager: true,
      },
      protection: {
        origin: ORIGIN,
        referer: null,
        csrfCookie: "csrf",
        csrfHeader: "csrf",
        allowedOrigins: [ORIGIN],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected policy update");
    expect(result.data.effective.cashierCanCloseShift).toBe(true);
    expect(result.data.effective.managerCanCloseShift).toBe(true);
    expect(result.data.canManage).toBe(true);
  });

  test("policy mutation requires valid CSRF and origin", async () => {
    const base = await runtime("owner_a", "cashier");
    const result = await handleSetOperationalPolicy({
      ...base,
      controlPlane: createMemoryControlPlaneDirectory([
        {
          organizationId: "org_a",
          actorId: "owner_a",
          controlRole: "owner",
          status: "active",
        },
      ]),
      override: { cashierCanCloseShift: true },
      protection: {
        origin: "https://evil.example",
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

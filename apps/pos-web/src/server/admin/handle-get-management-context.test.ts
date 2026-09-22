import { describe, expect, test } from "vitest";
import type { Session } from "../../../../../docs/contracts/domain.generated";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { createMemoryControlPlaneDirectory } from "./control-plane-directory";
import { handleGetManagementContext } from "./handle-get-management-context";

const NOW = new Date("2026-09-22T12:30:00.000Z");
const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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

async function cookieFor(actorId: string) {
  const store = createEphemeralInMemoryStaffSessionStore();
  const id = await store.create(session(actorId), "csrf", new Date("2026-09-22T13:30:00.000Z"));
  return { store, cookieHeader: `cetech_pos_sid=${id}` };
}

describe("ADMIN-105 management context", () => {
  test("cashier without organization control role is forbidden", async () => {
    const { store, cookieHeader } = await cookieFor("cashier_a");
    const result = await handleGetManagementContext({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions: store,
      assignments: createMemoryAssignmentDirectory([
        {
          actorId: "cashier_a",
          organizationId: "org_a",
          locationRoles: [{ locationId: "loc_a1", role: "cashier" }],
          registerIds: ["reg_a"],
        },
      ]),
      controlPlane: createMemoryControlPlaneDirectory([]),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
  });

  test("operational manager receives manager sections without global admin role", async () => {
    const { store, cookieHeader } = await cookieFor("manager_a");
    const result = await handleGetManagementContext({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions: store,
      assignments: createMemoryAssignmentDirectory([
        {
          actorId: "manager_a",
          organizationId: "org_a",
          locationRoles: [{ locationId: "loc_a1", role: "manager" }],
          registerIds: ["reg_a"],
        },
      ]),
      controlPlane: createMemoryControlPlaneDirectory([]),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected management context");
    expect(result.data.controlRole).toBeNull();
    expect(result.data.managerLocationIds).toEqual(["loc_a1"]);
    expect(result.data.sections).toContain("shifts_cash");
    expect(result.data.sections).toContain("returns_approvals");
    expect(result.data.sections).toContain("policies");
    expect(result.data.sections).not.toContain("locations");
  });

  test("organization owner receives full control-plane sections", async () => {
    const { store, cookieHeader } = await cookieFor("owner_a");
    const result = await handleGetManagementContext({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions: store,
      assignments: createMemoryAssignmentDirectory([]),
      controlPlane: createMemoryControlPlaneDirectory([
        {
          organizationId: "org_a",
          actorId: "owner_a",
          controlRole: "owner",
          status: "active",
        },
      ]),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected management context");
    expect(result.data.controlRole).toBe("owner");
    expect(result.data.sections).toContain("staff_access");
    expect(result.data.sections).toContain("locations");
    expect(result.data.sections).toContain("policies");
    expect(result.data.sections).toContain("audit");
  });

  test("support is diagnostics-only", async () => {
    const { store, cookieHeader } = await cookieFor("support_a");
    const result = await handleGetManagementContext({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions: store,
      assignments: createMemoryAssignmentDirectory([]),
      controlPlane: createMemoryControlPlaneDirectory([
        {
          organizationId: "org_a",
          actorId: "support_a",
          controlRole: "support",
          status: "active",
        },
      ]),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected management context");
    expect(result.data.sections).toEqual(["overview", "system_health", "audit"]);
  });

  test("disabled organization membership does not grant management", async () => {
    const { store, cookieHeader } = await cookieFor("admin_a");
    const result = await handleGetManagementContext({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions: store,
      assignments: createMemoryAssignmentDirectory([]),
      controlPlane: createMemoryControlPlaneDirectory([
        {
          organizationId: "org_a",
          actorId: "admin_a",
          controlRole: "admin",
          status: "disabled",
        },
      ]),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
  });

  test("manager role outside verified session locations is not authority", async () => {
    const { store, cookieHeader } = await cookieFor("manager_b");
    const result = await handleGetManagementContext({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions: store,
      assignments: createMemoryAssignmentDirectory([
        {
          actorId: "manager_b",
          organizationId: "org_a",
          locationRoles: [{ locationId: "loc_a2", role: "manager" }],
          registerIds: ["reg_b"],
        },
      ]),
      controlPlane: createMemoryControlPlaneDirectory([]),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
  });
});

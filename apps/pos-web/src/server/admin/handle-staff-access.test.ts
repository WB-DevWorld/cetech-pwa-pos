import { describe, expect, test } from "vitest";
import type { Session } from "../../../../../docs/contracts/domain.generated";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { createMemoryControlPlaneDirectory } from "./control-plane-directory";
import { createMemoryStaffAccessDirectory, type StaffAccessRecord } from "./staff-access-directory";
import { createMemoryStaffAssignmentAdminStore } from "./staff-assignment-admin-store";
import { createMemoryManagementTopologyDirectory } from "./management-topology-directory";
import { handleListStaffAccess, handleSetStaffAssignment } from "./handle-staff-access";

const NOW = new Date("2026-09-22T15:00:00.000Z");
const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORIGIN = "https://pos.example.test";

function session(actorId: string, locations = ["loc_a1"]): Session {
  return {
    actorId,
    displayName: actorId,
    organizationId: "org_a",
    locationIds: locations,
    capabilities: [],
    expiresAt: "2026-09-22T16:00:00.000Z",
  };
}

async function base(actorId: string, role: "cashier" | "manager", locations = ["loc_a1"]) {
  const sessions = createEphemeralInMemoryStaffSessionStore();
  const sessionId = await sessions.create(session(actorId, locations), "csrf", new Date("2026-09-22T16:00:00.000Z"));
  return {
    correlationId: CORRELATION,
    cookieHeader: `cetech_pos_sid=${sessionId}`,
    now: NOW,
    sessions,
    assignments: createMemoryAssignmentDirectory([
      {
        actorId,
        organizationId: "org_a",
        locationRoles: locations.map((locationId) => ({ locationId, role })),
        registerIds: ["reg_a"],
      },
    ]),
  };
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

function locationTopology() {
  return createMemoryManagementTopologyDirectory([
    {
      id: "loc_a1",
      name: "Location A1",
      registers: [
        { id: "reg_a", name: "Register A", currency: "GHS", status: "active" },
        { id: "reg_a2", name: "Register A2", currency: "GHS", status: "active" },
      ],
      devices: [],
    },
    {
      id: "loc_a2",
      name: "Location A2",
      registers: [{ id: "reg_b", name: "Register B", currency: "GHS", status: "active" }],
      devices: [],
    },
  ]);
}

const staffRows: StaffAccessRecord[] = [
  {
    actorId: "cashier_a",
    displayName: "Cashier A",
    email: "cashier@example.test",
    authStatus: "active",
    controlRole: null,
    locations: [{ locationId: "loc_a1", role: "cashier", registerIds: ["reg_a"] }],
  },
  {
    actorId: "manager_a",
    displayName: "Manager A",
    email: "manager@example.test",
    authStatus: "active",
    controlRole: null,
    locations: [{ locationId: "loc_a1", role: "manager", registerIds: ["reg_a", "reg_a2"] }],
  },
  {
    actorId: "cashier_b",
    displayName: "Cashier B",
    email: "cashier-b@example.test",
    authStatus: "active",
    controlRole: null,
    locations: [{ locationId: "loc_a2", role: "cashier", registerIds: ["reg_b"] }],
  },
  {
    actorId: "admin_a",
    displayName: "Admin A",
    email: "admin@example.test",
    authStatus: "active",
    controlRole: "admin",
    locations: [],
  },
];

describe("ADMIN-105 staff access", () => {
  test("manager sees only staff overlapping managed locations", async () => {
    const common = await base("manager_a", "manager");
    const result = await handleListStaffAccess({
      ...common,
      controlPlane: createMemoryControlPlaneDirectory([]),
      staff: createMemoryStaffAccessDirectory(staffRows),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected staff list");
    expect(result.data.map((row) => row.actorId).sort()).toEqual(["cashier_a", "manager_a"]);
    expect(result.data.every((row) => row.controlRole === null)).toBe(true);
  });

  test("organization admin sees all organization staff", async () => {
    const common = await base("admin_a", "cashier");
    const result = await handleListStaffAccess({
      ...common,
      controlPlane: createMemoryControlPlaneDirectory([
        {
          organizationId: "org_a",
          actorId: "admin_a",
          controlRole: "admin",
          status: "active",
        },
      ]),
      staff: createMemoryStaffAccessDirectory(staffRows),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected staff list");
    expect(result.data).toHaveLength(4);
    expect(result.data.find((row) => row.actorId === "admin_a")?.controlRole).toBe("admin");
  });

  test("cashier is forbidden from staff access", async () => {
    const common = await base("cashier_a", "cashier");
    const result = await handleListStaffAccess({
      ...common,
      controlPlane: createMemoryControlPlaneDirectory([]),
      staff: createMemoryStaffAccessDirectory(staffRows),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
  });

  test("manager register update fails closed until location registers are known", async () => {
    const common = await base("manager_a", "manager");
    const result = await handleSetStaffAssignment({
      ...common,
      controlPlane: createMemoryControlPlaneDirectory([]),
      staff: createMemoryStaffAccessDirectory(staffRows),
      mutation: createMemoryStaffAssignmentAdminStore(),
      targetActorId: "cashier_a",
      locationId: "loc_a1",
      role: "cashier",
      registerIds: ["reg_a"],
      protection: {
        origin: ORIGIN,
        referer: null,
        csrfCookie: "csrf",
        csrfHeader: "csrf",
        allowedOrigins: [ORIGIN],
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected unavailable");
    expect(result.error.code).toBe("INTEGRATION_UNAVAILABLE");
  });

  test("manager can update registers for existing staff at a managed location", async () => {
    const common = await base("manager_a", "manager");
    const mutation = createMemoryStaffAssignmentAdminStore();
    const result = await handleSetStaffAssignment({
      ...common,
      controlPlane: createMemoryControlPlaneDirectory([]),
      staff: createMemoryStaffAccessDirectory(staffRows),
      mutation,
      topology: locationTopology(),
      targetActorId: "cashier_a",
      locationId: "loc_a1",
      role: "cashier",
      registerIds: ["reg_a2"],
      protection: protection(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected register update");
    expect(result.data.role).toBe("cashier");
    expect(result.data.registerIds).toEqual(["reg_a2"]);
  });

  test("manager cannot promote, leave the location, or edit their own scope", async () => {
    const common = await base("manager_a", "manager");
    const shared = {
      ...common,
      controlPlane: createMemoryControlPlaneDirectory([]),
      staff: createMemoryStaffAccessDirectory(staffRows),
      mutation: createMemoryStaffAssignmentAdminStore(),
      topology: locationTopology(),
      protection: protection(),
    };
    const promoted = await handleSetStaffAssignment({
      ...shared,
      targetActorId: "cashier_a",
      locationId: "loc_a1",
      role: "manager",
      registerIds: ["reg_a"],
    });
    const otherLocation = await handleSetStaffAssignment({
      ...shared,
      targetActorId: "cashier_b",
      locationId: "loc_a2",
      role: "cashier",
      registerIds: ["reg_b"],
    });
    const self = await handleSetStaffAssignment({
      ...shared,
      targetActorId: "manager_a",
      locationId: "loc_a1",
      role: "manager",
      registerIds: ["reg_a"],
    });
    const outsideRegister = await handleSetStaffAssignment({
      ...shared,
      targetActorId: "cashier_a",
      locationId: "loc_a1",
      role: "cashier",
      registerIds: ["reg_b"],
    });
    for (const result of [promoted, otherLocation, self, outsideRegister]) {
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected forbidden");
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  test("owner/admin can atomically update operational assignment", async () => {
    const common = await base("admin_a", "cashier");
    const mutation = createMemoryStaffAssignmentAdminStore();
    const result = await handleSetStaffAssignment({
      ...common,
      controlPlane: createMemoryControlPlaneDirectory([
        {
          organizationId: "org_a",
          actorId: "admin_a",
          controlRole: "admin",
          status: "active",
        },
      ]),
      staff: createMemoryStaffAccessDirectory(staffRows),
      mutation,
      targetActorId: "cashier_a",
      locationId: "loc_a1",
      role: "manager",
      registerIds: ["reg_a2", "reg_a"],
      protection: {
        origin: ORIGIN,
        referer: null,
        csrfCookie: "csrf",
        csrfHeader: "csrf",
        allowedOrigins: [ORIGIN],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected assignment update");
    expect(result.data).toEqual({
      actorId: "cashier_a",
      organizationId: "org_a",
      locationId: "loc_a1",
      role: "manager",
      registerIds: ["reg_a", "reg_a2"],
    });
  });

  test("target actor must belong to organization staff directory", async () => {
    const common = await base("admin_a", "cashier");
    const result = await handleSetStaffAssignment({
      ...common,
      controlPlane: createMemoryControlPlaneDirectory([
        {
          organizationId: "org_a",
          actorId: "admin_a",
          controlRole: "admin",
          status: "active",
        },
      ]),
      staff: createMemoryStaffAccessDirectory(staffRows),
      mutation: createMemoryStaffAssignmentAdminStore(),
      targetActorId: "intruder",
      locationId: "loc_a1",
      role: "cashier",
      registerIds: ["reg_a"],
      protection: {
        origin: ORIGIN,
        referer: null,
        csrfCookie: "csrf",
        csrfHeader: "csrf",
        allowedOrigins: [ORIGIN],
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected not found");
    expect(result.error.code).toBe("NOT_FOUND");
  });

  test("assignment mutation requires CSRF and allowed origin", async () => {
    const common = await base("owner_a", "cashier");
    const result = await handleSetStaffAssignment({
      ...common,
      controlPlane: createMemoryControlPlaneDirectory([
        {
          organizationId: "org_a",
          actorId: "owner_a",
          controlRole: "owner",
          status: "active",
        },
      ]),
      staff: createMemoryStaffAccessDirectory(staffRows),
      mutation: createMemoryStaffAssignmentAdminStore(),
      targetActorId: "cashier_a",
      locationId: "loc_a1",
      role: "cashier",
      registerIds: ["reg_a"],
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

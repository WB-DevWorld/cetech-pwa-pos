import { describe, expect, test } from "vitest";
import type { Session } from "../../../../../docs/contracts/domain.generated";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { createMemoryControlPlaneDirectory } from "./control-plane-directory";
import { createMemoryControlMembershipAdminStore } from "./control-membership-admin-store";
import { handleSetControlMembership } from "./handle-control-membership";
import { createMemoryStaffAccessDirectory } from "./staff-access-directory";

const NOW = new Date("2026-09-22T16:15:00.000Z");
const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORIGIN = "https://pos.example.test";

function session(actorId: string): Session {
  return {
    actorId,
    displayName: actorId,
    organizationId: "org_a",
    locationIds: ["loc_a1"],
    capabilities: [],
    expiresAt: "2026-09-22T17:15:00.000Z",
  };
}

async function runtime(actorId: string, controlRole: "owner" | "admin" | null) {
  const sessions = createEphemeralInMemoryStaffSessionStore();
  const id = await sessions.create(
    session(actorId),
    "csrf",
    new Date("2026-09-22T17:15:00.000Z"),
  );
  return {
    correlationId: CORRELATION,
    cookieHeader: `cetech_pos_sid=${id}`,
    now: NOW,
    sessions,
    assignments: createMemoryAssignmentDirectory([
      {
        actorId,
        organizationId: "org_a",
        locationRoles: [{ locationId: "loc_a1", role: "manager" }],
        registerIds: ["reg_a"],
      },
    ]),
    controlPlane: createMemoryControlPlaneDirectory(
      controlRole
        ? [{
            organizationId: "org_a",
            actorId,
            controlRole,
            status: "active",
          }]
        : [],
    ),
    protection: {
      origin: ORIGIN,
      referer: null,
      csrfCookie: "csrf",
      csrfHeader: "csrf",
      allowedOrigins: [ORIGIN],
    },
  };
}

const staff = createMemoryStaffAccessDirectory([
  {
    actorId: "owner_a",
    displayName: "Owner",
    authStatus: "active",
    controlRole: "owner",
    locations: [],
  },
  {
    actorId: "admin_a",
    displayName: "Admin",
    authStatus: "active",
    controlRole: "admin",
    locations: [],
  },
  {
    actorId: "cashier_a",
    displayName: "Cashier",
    authStatus: "active",
    controlRole: null,
    locations: [{ locationId: "loc_a1", role: "cashier", registerIds: ["reg_a"] }],
  },
]);

describe("ADMIN-105 control membership", () => {
  test("owner may grant admin authority", async () => {
    const base = await runtime("owner_a", "owner");
    const mutation = createMemoryControlMembershipAdminStore();
    const result = await handleSetControlMembership({
      ...base,
      staff,
      mutation,
      targetActorId: "cashier_a",
      controlRole: "admin",
      status: "active",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected membership update");
    expect(result.data).toMatchObject({
      actorId: "cashier_a",
      controlRole: "admin",
      status: "active",
    });
  });

  test("admin may grant support authority", async () => {
    const base = await runtime("admin_a", "admin");
    const result = await handleSetControlMembership({
      ...base,
      staff,
      mutation: createMemoryControlMembershipAdminStore(),
      targetActorId: "cashier_a",
      controlRole: "support",
      status: "active",
    });
    expect(result.ok).toBe(true);
  });

  test("admin cannot grant owner authority", async () => {
    const base = await runtime("admin_a", "admin");
    const result = await handleSetControlMembership({
      ...base,
      staff,
      mutation: createMemoryControlMembershipAdminStore(),
      targetActorId: "cashier_a",
      controlRole: "owner",
      status: "active",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
  });

  test("admin cannot modify an existing owner", async () => {
    const base = await runtime("admin_a", "admin");
    const result = await handleSetControlMembership({
      ...base,
      staff,
      mutation: createMemoryControlMembershipAdminStore(),
      targetActorId: "owner_a",
      controlRole: "admin",
      status: "active",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
  });

  test("operational manager without organization role cannot mutate membership", async () => {
    const base = await runtime("manager_a", null);
    const result = await handleSetControlMembership({
      ...base,
      staff,
      mutation: createMemoryControlMembershipAdminStore(),
      targetActorId: "cashier_a",
      controlRole: "support",
      status: "active",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
  });
});

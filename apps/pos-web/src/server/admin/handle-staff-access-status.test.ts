import { describe, expect, test } from "vitest";
import type { Session } from "../../../../../docs/contracts/domain.generated";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { createMemoryControlPlaneDirectory } from "./control-plane-directory";
import { handleSetStaffAccessStatus } from "./handle-staff-access-status";
import { createMemoryStaffAccessDirectory } from "./staff-access-directory";
import { createMemoryStaffAccessStatusAdminStore } from "./staff-access-status-admin-store";

const NOW = new Date("2026-09-22T16:45:00.000Z");
const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORIGIN = "https://pos.example.test";

function session(actorId: string): Session {
  return {
    actorId,
    displayName: actorId,
    organizationId: "org_a",
    locationIds: ["loc_a1"],
    capabilities: [],
    expiresAt: "2026-09-22T17:45:00.000Z",
  };
}

async function runtime(actorId: string, controlRole: "owner" | "admin" | null) {
  const sessions = createEphemeralInMemoryStaffSessionStore();
  const id = await sessions.create(
    session(actorId),
    "csrf",
    new Date("2026-09-22T17:45:00.000Z"),
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
    posAccessStatus: "active",
    controlRole: "owner",
    locations: [],
  },
  {
    actorId: "admin_a",
    displayName: "Admin",
    authStatus: "active",
    posAccessStatus: "active",
    controlRole: "admin",
    locations: [],
  },
  {
    actorId: "cashier_a",
    displayName: "Cashier",
    authStatus: "active",
    posAccessStatus: "active",
    controlRole: null,
    locations: [{ locationId: "loc_a1", role: "cashier", registerIds: ["reg_a"] }],
  },
]);

describe("ADMIN-105 staff POS access status", () => {
  test("owner may disable ordinary staff and receives revoked-session evidence", async () => {
    const base = await runtime("owner_a", "owner");
    const result = await handleSetStaffAccessStatus({
      ...base,
      staff,
      mutation: createMemoryStaffAccessStatusAdminStore(),
      targetActorId: "cashier_a",
      status: "disabled",
      reason: "employment ended",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.data).toMatchObject({
      actorId: "cashier_a",
      status: "disabled",
      revokedSessionCount: 1,
    });
  });

  test("admin may re-enable ordinary staff", async () => {
    const base = await runtime("admin_a", "admin");
    const result = await handleSetStaffAccessStatus({
      ...base,
      staff,
      mutation: createMemoryStaffAccessStatusAdminStore(),
      targetActorId: "cashier_a",
      status: "active",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.data.status).toBe("active");
  });

  test("staff cannot disable their own current management access", async () => {
    const base = await runtime("admin_a", "admin");
    const result = await handleSetStaffAccessStatus({
      ...base,
      staff,
      mutation: createMemoryStaffAccessStatusAdminStore(),
      targetActorId: "admin_a",
      status: "disabled",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
  });

  test("owner must be transferred or demoted before POS disable", async () => {
    const base = await runtime("owner_a", "owner");
    const result = await handleSetStaffAccessStatus({
      ...base,
      staff,
      mutation: createMemoryStaffAccessStatusAdminStore(),
      targetActorId: "owner_a",
      status: "disabled",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
  });

  test("operational manager without organization authority cannot disable staff", async () => {
    const base = await runtime("manager_a", null);
    const result = await handleSetStaffAccessStatus({
      ...base,
      staff,
      mutation: createMemoryStaffAccessStatusAdminStore(),
      targetActorId: "cashier_a",
      status: "disabled",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
  });
});

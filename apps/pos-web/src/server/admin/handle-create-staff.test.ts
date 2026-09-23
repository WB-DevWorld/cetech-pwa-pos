import { describe, expect, test } from "vitest";
import type { Session } from "../../../../../docs/contracts/domain.generated";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { handleChangeRequiredPassword } from "../auth/handle-change-password";
import { parseStaffIdentityClaims } from "../auth/claims";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { createMemoryAdminAuditStore } from "./admin-audit-store";
import { createMemoryControlMembershipAdminStore } from "./control-membership-admin-store";
import { createMemoryControlPlaneDirectory } from "./control-plane-directory";
import { handleCreateStaffAccount } from "./handle-create-staff";
import { createMemoryManagementTopologyDirectory } from "./management-topology-directory";
import { createMemoryStaffAccessStatusAdminStore } from "./staff-access-status-admin-store";
import { createMemoryStaffAssignmentAdminStore } from "./staff-assignment-admin-store";
import { createMemoryStaffIdentityAdminStore } from "./staff-identity-admin-store";

const NOW = new Date("2026-09-23T12:00:00.000Z");
const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORIGIN = "https://pos.example.test";
const PASSWORD = "Aa7valid-pass";

function session(actorId: string): Session {
  return {
    actorId,
    displayName: actorId,
    organizationId: "org_a",
    locationIds: ["loc_a1"],
    capabilities: [],
    expiresAt: "2026-09-23T18:00:00.000Z",
  };
}

async function runtime(actorId: string, controlRole: "owner" | "admin" | null) {
  const sessions = createEphemeralInMemoryStaffSessionStore();
  const id = await sessions.create(session(actorId), "csrf", new Date("2026-09-23T18:00:00.000Z"));
  return {
    correlationId: CORRELATION,
    cookieHeader: `cetech_pos_sid=${id}`,
    now: NOW,
    sessions,
    assignments: createMemoryAssignmentDirectory([
      {
        actorId,
        organizationId: "org_a",
        locationRoles: [{ locationId: "loc_a1", role: "manager" as const }],
        registerIds: ["reg_a"],
      },
    ]),
    controlPlane: createMemoryControlPlaneDirectory(
      controlRole
        ? [{ organizationId: "org_a", actorId, controlRole, status: "active" as const }]
        : [],
    ),
    identities: createMemoryStaffIdentityAdminStore(),
    accessStatus: createMemoryStaffAccessStatusAdminStore(),
    memberships: createMemoryControlMembershipAdminStore(),
    staffAssignments: createMemoryStaffAssignmentAdminStore(),
    topology: createMemoryManagementTopologyDirectory([
      {
        id: "loc_a1",
        name: "Accra Main Store",
        registers: [{ id: "reg_a", name: "Front Register", currency: "GHS", status: "active" }],
        devices: [],
      },
    ]),
    audit: createMemoryAdminAuditStore(),
    protection: {
      origin: ORIGIN,
      referer: null,
      csrfCookie: "csrf",
      csrfHeader: "csrf",
      allowedOrigins: [ORIGIN],
    },
  };
}

describe("direct staff account creation", () => {
  test("owner can create an account with a temporary password and no password in the audit", async () => {
    const base = await runtime("owner_a", "owner");
    const result = await handleCreateStaffAccount({
      ...base,
      email: "new.cashier@example.com",
      displayName: "New Cashier",
      temporaryPassword: PASSWORD,
      controlRole: "support",
      locations: [{ locationId: "loc_a1", role: "cashier", registerIds: ["reg_a"] }],
      enableAccess: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.mustChangePassword).toBe(true);
    expect(result.data.posAccessStatus).toBe("active");
    expect(result.data.setupStatus).toBe("complete");
    expect(JSON.stringify(base.audit.events)).not.toContain(PASSWORD);
    expect(base.memberships.rows[0]?.controlRole).toBe("support");
    expect(base.staffAssignments.rows[0]?.role).toBe("cashier");
  });

  test("admin cannot grant Owner", async () => {
    const base = await runtime("admin_a", "admin");
    const result = await handleCreateStaffAccount({
      ...base,
      email: "owner2@example.com",
      displayName: "Second Owner",
      temporaryPassword: PASSWORD,
      controlRole: "owner",
      locations: [],
      enableAccess: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
    expect(base.identities.rows).toHaveLength(0);
  });

  test("manager cannot create staff identities", async () => {
    const base = await runtime("manager_a", null);
    const result = await handleCreateStaffAccount({
      ...base,
      email: "other@example.com",
      displayName: "Other",
      temporaryPassword: PASSWORD,
      controlRole: null,
      locations: [],
      enableAccess: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
  });

  test("a wrong location is rejected before an account is created", async () => {
    const base = await runtime("owner_a", "owner");
    const result = await handleCreateStaffAccount({
      ...base,
      email: "other@example.com",
      displayName: "Other",
      temporaryPassword: PASSWORD,
      controlRole: null,
      locations: [{ locationId: "loc_other", role: "cashier", registerIds: ["reg_a"] }],
      enableAccess: true,
    });
    expect(result.ok).toBe(false);
    expect(base.identities.rows).toHaveLength(0);
  });
});

describe("required password change", () => {
  test("app metadata requires a password change and user metadata cannot", () => {
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const required = parseStaffIdentityClaims({
      id: "auth-user",
      exp: expiry,
      app_metadata: {
        actor_id: "cashier_a",
        organization_id: "org_a",
        location_ids: ["loc_a1"],
        must_change_password: true,
      },
      user_metadata: { display_name: "Cashier" },
    });
    expect(required?.mustChangePassword).toBe(true);
    expect(required?.authUserId).toBe("auth-user");
    const ignored = parseStaffIdentityClaims({
      exp: expiry,
      app_metadata: {
        actor_id: "cashier_a",
        organization_id: "org_a",
        location_ids: ["loc_a1"],
      },
      user_metadata: { display_name: "Cashier", must_change_password: true },
    });
    expect(ignored?.mustChangePassword).toBe(false);
  });

  test("password change clears the requirement and revokes the session", async () => {
    const sessions = createEphemeralInMemoryStaffSessionStore();
    const identities = createMemoryStaffIdentityAdminStore();
    const sessionId = await sessions.create(
      session("cashier_a"),
      "csrf",
      new Date("2026-09-23T18:00:00.000Z"),
      { mustChangePassword: true, authUserId: "auth-user" },
    );
    const result = await handleChangeRequiredPassword({
      correlationId: CORRELATION,
      cookieHeader: `cetech_pos_sid=${sessionId}`,
      now: NOW,
      sessions,
      identities,
      password: "Bb8new-password",
      protection: {
        origin: ORIGIN,
        referer: null,
        csrfCookie: "csrf",
        csrfHeader: "csrf",
        allowedOrigins: [ORIGIN],
      },
    });
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain("Bb8new-password");
    expect(await sessions.get(sessionId, NOW)).toBeNull();
  });
});

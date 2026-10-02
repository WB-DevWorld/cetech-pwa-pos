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
import { handleResetStaffPassword } from "./handle-reset-staff-password";
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

  test("identity-audit failure leaves a direct-created account POS-disabled", async () => {
    const base = await runtime("owner_a", "owner");
    const result = await handleCreateStaffAccount({
      ...base,
      audit: { append: async () => "unavailable" as const },
      email: "audit.failure@example.com",
      displayName: "Audit Failure",
      temporaryPassword: PASSWORD,
      controlRole: null,
      locations: [{ locationId: "loc_a1", role: "cashier", registerIds: ["reg_a"] }],
      enableAccess: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.setupStatus).toBe("incomplete");
    expect(result.data.posAccessStatus).toBe("disabled");
    expect(base.accessStatus.rows).toHaveLength(1);
    expect(base.accessStatus.rows[0]?.status).toBe("disabled");
  });

});

const REPLACEMENT = "Bb8replacement-pass";

async function staffIdentity(
  identities: Awaited<ReturnType<typeof runtime>>["identities"],
  actorId: string,
) {
  await identities.createWithTemporaryPassword({
    organizationId: "org_a",
    actorId,
    email: `${actorId}@example.com`,
    displayName: actorId,
    temporaryPassword: PASSWORD,
  });
}

describe("temporary password reset", () => {
  test("records the reset request, revokes POS sessions, then changes the credential", async () => {
    const base = await runtime("owner_a", "owner");
    await staffIdentity(base.identities, "cashier_b");
    const targetSessionId = await base.sessions.create(
      session("cashier_b"),
      "csrf-target",
      new Date("2026-09-23T18:00:00.000Z"),
    );
    const order: string[] = [];
    const sessions = {
      ...base.sessions,
      async revokeActorSessions(input: { readonly organizationId: string; readonly actorId: string }) {
        order.push("revoke");
        return base.sessions.revokeActorSessions(input);
      },
    };
    const identities = {
      ...base.identities,
      async resetTemporaryPassword(input: { readonly authUserId: string; readonly temporaryPassword: string }) {
        order.push("reset");
        return base.identities.resetTemporaryPassword(input);
      },
    };
    const audit = {
      ...base.audit,
      async append(event: Parameters<typeof base.audit.append>[0]) {
        order.push(event.action);
        return base.audit.append(event);
      },
    };
    const result = await handleResetStaffPassword({
      ...base,
      sessions,
      identities,
      audit,
      targetActorId: "cashier_b",
      temporaryPassword: REPLACEMENT,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.mustChangePassword).toBe(true);
    expect(order).toEqual([
      "staff.password.reset.requested",
      "revoke",
      "reset",
      "staff.password.reset.completed",
    ]);
    expect(await base.sessions.get(targetSessionId, NOW)).toBeNull();
    const evidence = JSON.stringify(base.audit.events);
    expect(evidence).not.toContain(REPLACEMENT);
    expect(evidence).not.toContain(PASSWORD);
    expect(base.audit.events.map((event) => event.action)).toEqual([
      "staff.password.reset.requested",
      "staff.password.reset.completed",
    ]);
    expect(base.audit.events[1]?.afterState).toMatchObject({
      status: "completed",
      mustChangePassword: true,
      sessionsRevoked: true,
    });
  });

  test("does not change the credential when POS-session revocation fails", async () => {
    const base = await runtime("owner_a", "owner");
    await staffIdentity(base.identities, "cashier_b");
    const targetSessionId = await base.sessions.create(
      session("cashier_b"),
      "csrf-target",
      new Date("2026-09-23T18:00:00.000Z"),
    );
    let resetCalled = false;
    const sessions = {
      ...base.sessions,
      async revokeActorSessions() {
        throw new Error("session store unavailable");
      },
    };
    const identities = {
      ...base.identities,
      async resetTemporaryPassword(input: { readonly authUserId: string; readonly temporaryPassword: string }) {
        resetCalled = true;
        return base.identities.resetTemporaryPassword(input);
      },
    };
    const result = await handleResetStaffPassword({
      ...base,
      sessions,
      identities,
      targetActorId: "cashier_b",
      temporaryPassword: REPLACEMENT,
    });
    expect(result.ok).toBe(false);
    expect(resetCalled).toBe(false);
    expect(await base.sessions.get(targetSessionId, NOW)).not.toBeNull();
    expect(base.audit.events.map((event) => event.action)).toEqual(["staff.password.reset.requested"]);
    expect(JSON.stringify(base.audit.events)).not.toContain(REPLACEMENT);
  });

  test("an admin cannot reset an owner password", async () => {
    const base = await runtime("admin_a", "admin");
    await staffIdentity(base.identities, "owner_a");
    const targetSessionId = await base.sessions.create(
      session("owner_a"),
      "csrf-owner",
      new Date("2026-09-23T18:00:00.000Z"),
    );
    let resetCalled = false;
    let revoked = false;
    const result = await handleResetStaffPassword({
      ...base,
      controlPlane: createMemoryControlPlaneDirectory([
        { organizationId: "org_a", actorId: "admin_a", controlRole: "admin", status: "active" },
        { organizationId: "org_a", actorId: "owner_a", controlRole: "owner", status: "disabled" },
      ]),
      sessions: {
        ...base.sessions,
        async revokeActorSessions() {
          revoked = true;
        },
      },
      identities: {
        ...base.identities,
        async resetTemporaryPassword() {
          resetCalled = true;
          return "ok" as const;
        },
      },
      targetActorId: "owner_a",
      temporaryPassword: REPLACEMENT,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
    expect(revoked).toBe(false);
    expect(resetCalled).toBe(false);
    expect(await base.sessions.get(targetSessionId, NOW)).not.toBeNull();
    expect(base.audit.events).toEqual([]);
    expect(JSON.stringify(result)).not.toContain(REPLACEMENT);
  });

  test("an owner can reset another owner password", async () => {
    const base = await runtime("owner_a", "owner");
    await staffIdentity(base.identities, "owner_b");
    const result = await handleResetStaffPassword({
      ...base,
      controlPlane: createMemoryControlPlaneDirectory([
        { organizationId: "org_a", actorId: "owner_a", controlRole: "owner", status: "active" },
        { organizationId: "org_a", actorId: "owner_b", controlRole: "owner", status: "active" },
      ]),
      targetActorId: "owner_b",
      temporaryPassword: REPLACEMENT,
    });
    expect(result.ok).toBe(true);
    expect(base.audit.events.at(-1)?.action).toBe("staff.password.reset.completed");
  });

  test("fails closed when the target organization role cannot be checked", async () => {
    const base = await runtime("admin_a", "admin");
    await staffIdentity(base.identities, "cashier_b");
    let resetCalled = false;
    let revoked = false;
    const result = await handleResetStaffPassword({
      ...base,
      controlPlane: {
        async lookup() {
          return "unavailable" as const;
        },
      },
      sessions: {
        ...base.sessions,
        async revokeActorSessions() {
          revoked = true;
        },
      },
      identities: {
        ...base.identities,
        async resetTemporaryPassword() {
          resetCalled = true;
          return "ok" as const;
        },
      },
      targetActorId: "cashier_b",
      temporaryPassword: REPLACEMENT,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INTEGRATION_UNAVAILABLE");
    expect(revoked).toBe(false);
    expect(resetCalled).toBe(false);
    expect(base.audit.events).toEqual([]);
  });

  test("does not change the credential when the reset request cannot be recorded", async () => {
    const base = await runtime("owner_a", "owner");
    await staffIdentity(base.identities, "cashier_b");
    let resetCalled = false;
    let revoked = false;
    const result = await handleResetStaffPassword({
      ...base,
      audit: { async append() { return "unavailable" as const; } },
      sessions: {
        ...base.sessions,
        async revokeActorSessions() {
          revoked = true;
        },
      },
      identities: {
        ...base.identities,
        async resetTemporaryPassword() {
          resetCalled = true;
          return "ok" as const;
        },
      },
      targetActorId: "cashier_b",
      temporaryPassword: REPLACEMENT,
    });
    expect(result.ok).toBe(false);
    expect(resetCalled).toBe(false);
    expect(revoked).toBe(false);
    expect(JSON.stringify(result)).not.toContain(REPLACEMENT);
  });

  test("leaves the pending reset record when the credential change fails", async () => {
    const base = await runtime("owner_a", "owner");
    await staffIdentity(base.identities, "cashier_b");
    const result = await handleResetStaffPassword({
      ...base,
      identities: {
        ...base.identities,
        async resetTemporaryPassword() {
          return "unavailable" as const;
        },
      },
      targetActorId: "cashier_b",
      temporaryPassword: REPLACEMENT,
    });
    expect(result.ok).toBe(false);
    expect(base.audit.events.map((event) => event.action)).toEqual(["staff.password.reset.requested"]);
    expect(JSON.stringify(base.audit.events)).not.toContain(REPLACEMENT);
  });

  test("does not report success when the completion record cannot be saved", async () => {
    const base = await runtime("owner_a", "owner");
    await staffIdentity(base.identities, "cashier_b");
    const targetSessionId = await base.sessions.create(
      session("cashier_b"),
      "csrf-target",
      new Date("2026-09-23T18:00:00.000Z"),
    );
    let appends = 0;
    const result = await handleResetStaffPassword({
      ...base,
      audit: {
        async append(event) {
          appends += 1;
          if (appends === 1) {
            base.audit.events.push(event);
            return "ok" as const;
          }
          return "unavailable" as const;
        },
      },
      targetActorId: "cashier_b",
      temporaryPassword: REPLACEMENT,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INTEGRATION_UNAVAILABLE");
    expect(result.error.message).toContain("Do not reset this password again");
    expect(await base.sessions.get(targetSessionId, NOW)).toBeNull();
    expect(base.audit.events.map((event) => event.action)).toEqual(["staff.password.reset.requested"]);
    expect(JSON.stringify({ result, events: base.audit.events })).not.toContain(REPLACEMENT);
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

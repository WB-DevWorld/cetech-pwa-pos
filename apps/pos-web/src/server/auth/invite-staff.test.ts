import { describe, expect, test } from "vitest";
import type { Session } from "../../../../../docs/contracts/domain.generated";
import { createMemoryAssignmentDirectory } from "./assignments";
import { handleInviteStaff, type StaffInviteAudit } from "./invite-staff";
import { INVITE_ALREADY_REGISTERED, INVITE_FORBIDDEN, INVITE_NOT_CONFIGURED } from "../../features/auth/invite-messages";
import { assignmentRolePermits } from "./roles";
import { createEphemeralInMemoryStaffSessionStore } from "./session-store";
import type { SupabaseStaffInviteResult } from "./supabase-staff-invite";

const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STAGING = "https://pos-staging.example.com";
const SESSION: Session = {
  actorId: "manager_a",
  displayName: "Manager A",
  organizationId: "org_a",
  locationIds: ["loc_a1"],
  capabilities: ["ui.hint.only"],
  expiresAt: "2099-01-01T00:00:00.000Z",
};

describe("staff invitation", () => {
  test("a manager invite uses the trusted staging redirect and ignores a caller origin", async () => {
    const sent: Array<{ email: string; redirectTo: string }> = [];
    const audits: StaffInviteAudit[] = [];
    const result = await invite({
      env: stagingEnv(),
      origin: STAGING,
      allowedOrigins: [STAGING],
      body: {
        email: "new.cashier@example.com",
        redirectTo: "https://attacker.example",
        origin: "https://attacker.example",
      },
      audits,
      deliver: async (request) => {
        sent.push({ email: request.email, redirectTo: request.redirectTo });
        return { ok: true };
      },
    });

    expect(result.body).toMatchObject({ ok: true, data: { invited: true } });
    expect(sent).toEqual([{ email: "new.cashier@example.com", redirectTo: `${STAGING}/auth/invite` }]);
    expect(JSON.stringify(sent)).not.toContain("attacker.example");
    expect(JSON.stringify(sent)).not.toContain("localhost");
    expect(JSON.stringify(sent)).not.toContain("vercel.app");
    expect(audits).toEqual([
      {
        action: "staff.invite",
        actorId: "manager_a",
        organizationId: "org_a",
        outcome: "sent",
        correlationId: CORRELATION,
      },
    ]);
    expect(JSON.stringify(audits)).not.toContain("new.cashier@example.com");
  });

  test("local development may redirect to localhost", async () => {
    const sent: string[] = [];
    const result = await invite({
      env: {
        APP_ENV: "local",
        APP_ORIGIN: "http://localhost:3000",
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
      },
      origin: "http://localhost:3000",
      allowedOrigins: ["http://localhost:3000"],
      deliver: async (request) => {
        sent.push(request.redirectTo);
        return { ok: true };
      },
    });
    expect(result.body.ok).toBe(true);
    expect(sent).toEqual(["http://localhost:3000/auth/invite"]);
  });

  test("staging misconfiguration fails before the invite is sent", async () => {
    const cases = [
      stagingEnv({ APP_ORIGIN: undefined, VERCEL_URL: "cetech-pos-staging-abc123.vercel.app" }),
      stagingEnv({ APP_ORIGIN: "not-a-url" }),
      stagingEnv({ APP_ORIGIN: "http://localhost:3000" }),
    ];
    for (const env of cases) {
      let called = false;
      const result = await invite({
        env,
        origin: STAGING,
        allowedOrigins: [STAGING],
        deliver: async () => {
          called = true;
          return { ok: true };
        },
      });
      expect(called).toBe(false);
      expect(result.body).toMatchObject({ ok: false, error: { message: INVITE_NOT_CONFIGURED } });
    }
  });

  test("a cashier cannot invite staff", async () => {
    let called = false;
    const result = await invite({
      role: "cashier",
      env: stagingEnv(),
      origin: STAGING,
      allowedOrigins: [STAGING],
      body: { email: "new.cashier@example.com", role: "manager" },
      deliver: async () => {
        called = true;
        return { ok: true };
      },
    });
    expect(called).toBe(false);
    expect(result.body).toMatchObject({ ok: false, error: { code: "FORBIDDEN", message: INVITE_FORBIDDEN } });
    expect(assignmentRolePermits("cashier", "staff.invite")).toBe(false);
    expect(assignmentRolePermits("manager", "staff.invite")).toBe(true);
  });

  test("an existing account is not reported as a new invitation", async () => {
    const audits: StaffInviteAudit[] = [];
    const result = await invite({
      env: stagingEnv(),
      origin: STAGING,
      allowedOrigins: [STAGING],
      audits,
      deliver: async () => ({ ok: false, reason: "already_registered" }),
    });
    expect(result.body.ok).toBe(false);
    expect(result.body).toMatchObject({ error: { message: INVITE_ALREADY_REGISTERED } });
    expect(audits[0]?.outcome).toBe("already_registered");
  });

  test("assignment lookup failure does not send an invitation", async () => {
    let called = false;
    const result = await invite({
      env: stagingEnv(),
      origin: STAGING,
      allowedOrigins: [STAGING],
      assignments: "unavailable",
      deliver: async () => {
        called = true;
        return { ok: true };
      },
    });
    expect(called).toBe(false);
    expect(result.body).toMatchObject({
      ok: false,
      error: { code: "INTEGRATION_UNAVAILABLE", details: { field: "assignments" } },
    });
  });
});

function stagingEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    APP_ENV: "staging",
    APP_ORIGIN: STAGING,
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
    ...overrides,
  };
}

async function invite(input: {
  readonly env: Record<string, string | undefined>;
  readonly origin: string;
  readonly allowedOrigins: readonly string[];
  readonly role?: "manager" | "cashier";
  readonly body?: unknown;
  readonly assignments?: "unavailable";
  readonly audits?: StaffInviteAudit[];
  readonly deliver: (request: {
    readonly email: string;
    readonly redirectTo: string;
  }) => Promise<SupabaseStaffInviteResult>;
}) {
  const role = input.role ?? "manager";
  const store = createEphemeralInMemoryStaffSessionStore();
  const sessionId = await store.create(
    { ...SESSION, actorId: role === "manager" ? "manager_a" : "cashier_a" },
    "csrf-1",
    new Date("2099-01-01T00:00:00.000Z"),
  );
  const directory =
    input.assignments === "unavailable"
      ? { lookup: async () => "unavailable" as const }
      : createMemoryAssignmentDirectory([
          {
            actorId: role === "manager" ? "manager_a" : "cashier_a",
            organizationId: "org_a",
            locationRoles: [{ locationId: "loc_a1", role }],
            registerIds: ["reg_a"],
          },
        ]);
  return handleInviteStaff({
    correlationIdHeader: CORRELATION,
    origin: input.origin,
    referer: null,
    cookieHeader: `cetech_pos_sid=${sessionId}; cetech_pos_csrf=csrf-1`,
    csrfHeader: "csrf-1",
    body: input.body ?? { email: "new.cashier@example.com" },
    now: new Date("2026-09-25T00:00:00.000Z"),
    store,
    assignments: directory,
    allowedOrigins: input.allowedOrigins,
    env: input.env,
    deliver: async (request) => input.deliver(request),
    audit: (event) => input.audits?.push(event),
  });
}

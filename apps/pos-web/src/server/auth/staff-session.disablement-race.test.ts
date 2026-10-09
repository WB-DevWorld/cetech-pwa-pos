import { describe, expect, test } from "vitest";
import { createMemoryAssignmentDirectory } from "./assignments";
import { authorizeStaffMutation, authorizeStaffRead } from "./authorize";
import { createSupabaseStaffSessionStore } from "./supabase-session-store";
import { establishStaffSession } from "./staff-session";
import type { StaffAccessControl, StaffAccessStatus } from "./staff-access-control";
import { guardStaffCommand } from "../sales/guard-staff-command";
import type { PosRestFetch } from "../http/server-fetch";

const NOW = new Date("2026-10-09T12:00:00.000Z");
const CORRELATION = "7da2b960-d063-4d58-b07b-dac520db81b0";
const ORIGIN = "https://pos.synthetic.invalid";
const IDEMPOTENCY = "bdba96c5-2fe2-48e0-a6a1-8de56e350709";

const identity = {
  actorId: "cashier_race",
  displayName: "Synthetic test actor",
  organizationId: "org_a",
  locationIds: ["loc_a1"] as string[],
  registerId: null as string | null,
  capabilities: [] as string[],
  expiresAt: "2026-10-09T13:00:00.000Z",
};

const assignments = createMemoryAssignmentDirectory([
  {
    actorId: identity.actorId,
    organizationId: "org_a",
    locationRoles: [{ locationId: "loc_a1", role: "cashier" }],
    registerIds: ["reg_a"],
    registerAssignments: [{ registerId: "reg_a", locationId: "loc_a1" }],
  },
]);

type SessionRow = {
  id: string;
  organization_id: string;
  actor_id: string;
  csrf_token: string;
  session_payload: unknown;
  expires_at: string;
  revoked_at: string | null;
};

function raceFixture() {
  const rows = new Map<string, SessionRow>();
  let status: StaffAccessStatus = "active";
  let statusCalls = 0;
  let beforeInsert: (() => Promise<void>) | null = null;
  let beforeSecondStatus: (() => Promise<void>) | null = null;

  const fetchImpl: PosRestFetch = async (address, init) => {
    const url = new URL(String(address));
    if (!url.pathname.endsWith("/pos_staff_sessions")) {
      throw new Error(`unexpected URL ${url.pathname}`);
    }
    const method = init?.method ?? "GET";
    if (method === "POST") {
      if (beforeInsert) {
        await beforeInsert();
      }
      const row = JSON.parse(String(init?.body)) as Omit<SessionRow, "revoked_at">;
      rows.set(row.id, { ...row, revoked_at: null });
      return { status: 201, ok: true, json: async () => null } as Response;
    }
    if (method === "GET") {
      const id = url.searchParams.get("id")?.slice(3);
      if (!id || !rows.has(id)) {
        return { status: 200, ok: true, json: async () => [] } as Response;
      }
      return { status: 200, ok: true, json: async () => [rows.get(id)] } as Response;
    }
    if (method === "PATCH") {
      const patch = JSON.parse(String(init?.body)) as { revoked_at?: string };
      for (const row of rows.values()) {
        if (url.searchParams.has("id") && row.id !== url.searchParams.get("id")?.slice(3)) {
          continue;
        }
        if (
          url.searchParams.has("actor_id") &&
          row.actor_id !== url.searchParams.get("actor_id")?.slice(3)
        ) {
          continue;
        }
        Object.assign(row, patch);
      }
      return { status: 200, ok: true, json: async () => null } as Response;
    }
    throw new Error(`unexpected method ${method}`);
  };

  const store = createSupabaseStaffSessionStore({
    url: "https://synthetic.invalid",
    serviceRoleKey: "FAKE_SERVER_INFRASTRUCTURE",
    fetchImpl,
  });

  const accessControl: StaffAccessControl = {
    async status() {
      statusCalls += 1;
      if (statusCalls >= 2 && beforeSecondStatus) {
        await beforeSecondStatus();
        beforeSecondStatus = null;
      }
      return status;
    },
  };

  const disable = async () => {
    status = "disabled";
    await store.revokeActorSessions({
      organizationId: "org_a",
      actorId: identity.actorId,
    });
  };

  const establish = () =>
    establishStaffSession({
      accessToken: "synthetic-token",
      now: NOW,
      verifier: {
        async verify() {
          return { ok: true, identity };
        },
      },
      accessControl,
      store,
      correlationId: CORRELATION,
      secureCookies: true,
    });

  const guard = async (
    established: Awaited<ReturnType<typeof establish>>,
    changes: Partial<Parameters<typeof guardStaffCommand>[0]> = {},
  ) => {
    const cookieHeader = established.ok
      ? established.data.cookies.map((cookie) => cookie.split(";")[0]).join("; ")
      : undefined;
    const csrfHeader = established.ok
      ? established.data.cookies[1]?.split(";")[0]?.split("=")[1]
      : undefined;
    return guardStaffCommand({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      cookieHeader,
      csrfHeader,
      now: NOW,
      sessionStore: store,
      accessControl,
      allowedOrigins: [ORIGIN],
      requireMutationProtection: true,
      requireIdempotencyKey: true,
      idempotencyKeyHeader: IDEMPOTENCY,
      ...changes,
    });
  };

  return {
    rows,
    store,
    accessControl,
    establish,
    guard,
    disable,
    setStatus(next: StaffAccessStatus) {
      status = next;
    },
    beforeInsert(fn: () => Promise<void>) {
      beforeInsert = fn;
    },
    beforeSecondStatus(fn: () => Promise<void>) {
      beforeSecondStatus = fn;
    },
    isDisabled: () => status === "disabled",
    statusCalls: () => statusCalls,
  };
}

describe("AUTH-01 staff disablement / session issuance race", () => {
  test("negative control: disable before access read denies and creates no session", async () => {
    const fixture = raceFixture();
    await fixture.disable();
    const result = await fixture.establish();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
    expect(fixture.rows.size).toBe(0);
  });

  test("negative control: disable after completed insert revokes the visible session", async () => {
    const fixture = raceFixture();
    const established = await fixture.establish();
    expect(established.ok).toBe(true);
    await fixture.disable();
    const guarded = await fixture.guard(established);
    expect(guarded.ok).toBe(false);
    if (guarded.ok) throw new Error("expected denied");
    // Session row was revoked by disablement, so store get fails closed as AUTH_REQUIRED.
    expect(guarded.body.error.code).toBe("AUTH_REQUIRED");
  });

  test("commit order A: access ACTIVE then disable/revoke then INSERT — issuance denied", async () => {
    const fixture = raceFixture();
    fixture.beforeInsert(async () => {
      await fixture.disable();
    });

    const established = await fixture.establish();
    expect(fixture.isDisabled()).toBe(true);
    expect(established.ok).toBe(false);
    if (established.ok) throw new Error("expected post-insert disablement denial");
    expect(established.error.code).toBe("FORBIDDEN");
    expect(established.error.details?.field).toBe("pos_access");

    const inserted = [...fixture.rows.values()];
    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.revoked_at).not.toBeNull();

    const guarded = await fixture.guard(established);
    expect(guarded.ok).toBe(false);
  });

  test("commit order B: disable commits before establish access read — issuance denied", async () => {
    const fixture = raceFixture();
    await fixture.disable();
    const established = await fixture.establish();
    expect(established.ok).toBe(false);
    if (!established.ok) {
      expect(established.error.code).toBe("FORBIDDEN");
    }
    expect(fixture.rows.size).toBe(0);
  });

  test("commit order C: disable between INSERT and post-insert recheck revokes and denies", async () => {
    const fixture = raceFixture();
    fixture.beforeSecondStatus(async () => {
      await fixture.disable();
    });
    const established = await fixture.establish();
    expect(established.ok).toBe(false);
    if (established.ok) throw new Error("expected denial after post-insert disable");
    expect(established.error.code).toBe("FORBIDDEN");
    const inserted = [...fixture.rows.values()];
    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.revoked_at).not.toBeNull();
  });

  test("validated-session path rejects durable disabled actor with missed revoke row", async () => {
    const fixture = raceFixture();
    const established = await fixture.establish();
    expect(established.ok).toBe(true);

    // Missed revoke: durable access flips to disabled without session PATCH.
    fixture.setStatus("disabled");
    const guarded = await fixture.guard(established);
    expect(guarded.ok).toBe(false);
    if (guarded.ok) throw new Error("expected disabled denial");
    expect(guarded.body.error.code).toBe("FORBIDDEN");
    expect(guarded.body.error.details?.field).toBe("pos_access");
    const row = [...fixture.rows.values()][0];
    expect(row?.revoked_at).not.toBeNull();
  });

  test("access-control unavailability never means active on establish or guard", async () => {
    const unavailable: StaffAccessControl = {
      async status() {
        return "unavailable";
      },
    };
    const fixture = raceFixture();
    const established = await establishStaffSession({
      accessToken: "synthetic-token",
      now: NOW,
      verifier: {
        async verify() {
          return { ok: true, identity };
        },
      },
      accessControl: unavailable,
      store: fixture.store,
      correlationId: CORRELATION,
      secureCookies: true,
    });
    expect(established.ok).toBe(false);
    if (!established.ok) {
      expect(established.error.code).toBe("INTEGRATION_UNAVAILABLE");
    }

    const activeEstablish = await fixture.establish();
    expect(activeEstablish.ok).toBe(true);
    const guarded = await fixture.guard(activeEstablish, { accessControl: unavailable });
    expect(guarded.ok).toBe(false);
    if (!guarded.ok) {
      expect(guarded.body.error.code).toBe("INTEGRATION_UNAVAILABLE");
    }
  });

  test("scope and request-protection negative controls remain denied", async () => {
    const fixture = raceFixture();
    const established = await fixture.establish();
    expect(established.ok).toBe(true);
    if (!established.ok) throw new Error("expected session");

    const protection = {
      origin: ORIGIN,
      referer: null,
      csrfCookie: "test-csrf",
      csrfHeader: "test-csrf",
      allowedOrigins: [ORIGIN],
    };

    const authorized = await authorizeStaffMutation(
      {
        verifyResult: {
          ok: true,
          identity,
        },
        assignments,
        accessControl: fixture.accessControl,
        correlationId: CORRELATION,
        required: {
          organizationId: "org_a",
          locationId: "loc_a1",
          registerId: "reg_a",
          permission: "payment.cash",
        },
      },
      protection,
    );
    expect(authorized.ok).toBe(true);

    const crossOrg = await authorizeStaffRead({
      verifyResult: { ok: true, identity },
      assignments,
      accessControl: fixture.accessControl,
      correlationId: CORRELATION,
      required: { organizationId: "org_b", locationId: "loc_a1", registerId: "reg_a" },
    });
    const crossLocation = await authorizeStaffRead({
      verifyResult: { ok: true, identity },
      assignments,
      accessControl: fixture.accessControl,
      correlationId: CORRELATION,
      required: { organizationId: "org_a", locationId: "loc_other", registerId: "reg_a" },
    });
    const crossRegister = await authorizeStaffRead({
      verifyResult: { ok: true, identity },
      assignments,
      accessControl: fixture.accessControl,
      correlationId: CORRELATION,
      required: { organizationId: "org_a", locationId: "loc_a1", registerId: "reg_other" },
    });
    for (const denied of [crossOrg, crossLocation, crossRegister]) {
      expect(denied.ok).toBe(false);
      if (!denied.ok) expect(denied.error.code).toBe("FORBIDDEN");
    }

    const missingCsrf = await fixture.guard(established, { csrfHeader: null });
    const badOrigin = await fixture.guard(established, { origin: "https://evil.synthetic.invalid" });
    const anonymous = await guardStaffCommand({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      cookieHeader: undefined,
      csrfHeader: undefined,
      now: NOW,
      sessionStore: fixture.store,
      accessControl: fixture.accessControl,
      allowedOrigins: [ORIGIN],
      requireMutationProtection: true,
      requireIdempotencyKey: true,
      idempotencyKeyHeader: IDEMPOTENCY,
    });
    expect(missingCsrf.ok).toBe(false);
    expect(badOrigin.ok).toBe(false);
    expect(anonymous.ok).toBe(false);
    if (!missingCsrf.ok) expect(missingCsrf.body.error.code).toBe("FORBIDDEN");
    if (!badOrigin.ok) expect(badOrigin.body.error.code).toBe("FORBIDDEN");
  });

  test("authorize denies disabled actors when accessControl is composed into the check", async () => {
    const fixture = raceFixture();
    await fixture.disable();
    const result = await authorizeStaffRead({
      verifyResult: { ok: true, identity },
      assignments,
      accessControl: fixture.accessControl,
      correlationId: CORRELATION,
      required: {
        organizationId: "org_a",
        locationId: "loc_a1",
        registerId: "reg_a",
        permission: "payment.cash",
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
      expect(result.error.details?.field).toBe("pos_access");
    }
  });

  test("forced password change still blocks before access recheck grants commands", async () => {
    const fixture = raceFixture();
    const established = await establishStaffSession({
      accessToken: "synthetic-token",
      now: NOW,
      verifier: {
        async verify() {
          return {
            ok: true,
            identity: { ...identity, mustChangePassword: true },
          };
        },
      },
      accessControl: fixture.accessControl,
      store: fixture.store,
      correlationId: CORRELATION,
      secureCookies: true,
    });
    expect(established.ok).toBe(true);
    const guarded = await fixture.guard(established);
    expect(guarded.ok).toBe(false);
    if (!guarded.ok) {
      expect(guarded.body.error.code).toBe("FORBIDDEN");
      expect(guarded.body.error.message).toContain("password");
    }
  });
});

import { describe, expect, test } from "vitest";
import type { Session, StoreHealth } from "../../../../../docs/contracts/domain.generated";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { createMemoryControlPlaneDirectory } from "./control-plane-directory";
import { handleGetManagementSystemHealth } from "./handle-management-system-health";
import { presentManagementSystemHealth } from "./management-system-health";

const NOW = new Date("2026-09-22T16:00:00.000Z");
const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function health(overrides: Partial<StoreHealth> = {}): StoreHealth {
  return {
    contractVersion: "1.0.0",
    pendingOperationCount: 0,
    attentionCount: 0,
    buildId: "build-105",
    checks: [
      {
        id: "supabase",
        status: "healthy",
        message: "store data responded",
        checkedAt: "2026-09-22T16:00:00.000Z",
      },
      {
        id: "bridge",
        status: "unavailable",
        message: "commerce connection could not be reached",
        checkedAt: "2026-09-22T16:00:01.000Z",
      },
      {
        id: "bridge-contract",
        status: "unverified",
        message: "wooDetected=false woodmartDetected=false b2bkingDetected=false pricingParityVerified=false; detection is not pricing parity",
        checkedAt: "2026-09-22T16:00:02.000Z",
      },
    ],
    ...overrides,
  };
}

function session(actorId: string): Session {
  return {
    actorId,
    displayName: actorId,
    organizationId: "org_a",
    locationIds: ["loc_a1"],
    capabilities: [],
    expiresAt: "2026-09-22T17:00:00.000Z",
  };
}

async function cookieFor(actorId: string) {
  const sessions = createEphemeralInMemoryStaffSessionStore();
  const id = await sessions.create(session(actorId), "csrf", new Date("2026-09-22T17:00:00.000Z"));
  return { sessions, cookieHeader: `cetech_pos_sid=${id}` };
}

describe("ADMIN-105 system health oversight", () => {
  test("owner, admin, manager, and support can read service checks", async () => {
    for (const actor of [
      { id: "owner_a", role: "owner" as const, manager: false },
      { id: "admin_a", role: "admin" as const, manager: false },
      { id: "support_a", role: "support" as const, manager: false },
      { id: "manager_a", role: null, manager: true },
    ]) {
      const { sessions, cookieHeader } = await cookieFor(actor.id);
      let reads = 0;
      const result = await handleGetManagementSystemHealth({
        correlationId: CORRELATION,
        cookieHeader,
        now: NOW,
        sessions,
        assignments: createMemoryAssignmentDirectory(actor.manager ? [{
          actorId: actor.id,
          organizationId: "org_a",
          locationRoles: [{ locationId: "loc_a1", role: "manager" }],
          registerIds: ["reg_a"],
        }] : []),
        controlPlane: createMemoryControlPlaneDirectory(actor.role ? [{
          organizationId: "org_a",
          actorId: actor.id,
          controlRole: actor.role,
          status: "active",
        }] : []),
        readHealth: async () => {
          reads += 1;
          return health();
        },
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected health");
      expect(reads).toBe(1);
      expect(result.data.overall).toBe("unavailable");
      expect(result.data.checks.map((check) => check.id)).toEqual([
        "bridge",
        "bridge-contract",
        "supabase",
      ]);
      expect(result.data.checks[0]?.label).toBe("Commerce connection");
      expect(JSON.stringify(result.data)).not.toContain("pendingOperationCount");
      expect(JSON.stringify(result.data)).not.toContain("org_b");
    }
  });

  test("an unauthenticated request is rejected before a health read", async () => {
    let reads = 0;
    const result = await handleGetManagementSystemHealth({
      correlationId: CORRELATION,
      now: NOW,
      sessions: createEphemeralInMemoryStaffSessionStore(),
      assignments: createMemoryAssignmentDirectory([]),
      controlPlane: createMemoryControlPlaneDirectory([]),
      readHealth: async () => {
        reads += 1;
        return health();
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected auth required");
    expect(result.error.code).toBe("AUTH_REQUIRED");
    expect(reads).toBe(0);
  });

  test("cashier is forbidden and the health reader is not called", async () => {
    const { sessions, cookieHeader } = await cookieFor("cashier_a");
    let reads = 0;
    const result = await handleGetManagementSystemHealth({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions,
      assignments: createMemoryAssignmentDirectory([{
        actorId: "cashier_a",
        organizationId: "org_a",
        locationRoles: [{ locationId: "loc_a1", role: "cashier" }],
        registerIds: ["reg_a"],
      }]),
      controlPlane: createMemoryControlPlaneDirectory([]),
      readHealth: async () => {
        reads += 1;
        return health();
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
    expect(reads).toBe(0);
  });

  test("a failed health read is unavailable rather than a healthy empty result", async () => {
    const { sessions, cookieHeader } = await cookieFor("support_a");
    const result = await handleGetManagementSystemHealth({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions,
      assignments: createMemoryAssignmentDirectory([]),
      controlPlane: createMemoryControlPlaneDirectory([{
        organizationId: "org_a",
        actorId: "support_a",
        controlRole: "support",
        status: "active",
      }]),
      readHealth: async () => "unavailable",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected unavailable");
    expect(result.error.code).toBe("INTEGRATION_UNAVAILABLE");
  });

  test("presentation keeps real statuses and hides probe secrets", () => {
    const view = presentManagementSystemHealth(health({
      checks: [
        {
          id: "supabase",
          status: "unverified",
          message: "live supabase probe skipped; PREP_ONLY mock",
          checkedAt: "2026-09-22T16:00:00.000Z",
        },
      ],
      buildId: "build-with-a-very-long-identifier-that-stays-secondary",
    }));
    expect(view.overall).toBe("unverified");
    expect(view.checks[0]?.summary).toBe("This check has not been confirmed.");
    expect(view.checks[0]?.detail).toBe("A live check was not run from this screen.");
    expect(JSON.stringify(view)).not.toContain("PREP_ONLY");
    expect(JSON.stringify(view)).not.toContain("service_role");
    expect(view.buildId).toContain("build-with-a-very-long-identifier");
  });
});

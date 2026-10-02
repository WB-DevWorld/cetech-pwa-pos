import { describe, expect, test } from "vitest";
import type { Session } from "../../../../../docs/contracts/domain.generated";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import type { PosRestFetch } from "../http/server-fetch";
import {
  MANAGEMENT_AUDIT_RESULT_LIMIT,
  createMemoryAdminAuditDirectory,
  createSupabaseAdminAuditDirectory,
  selectAdminAuditRecords,
  type AdminAuditDirectory,
  type AdminAuditRecord,
} from "./admin-audit-directory";
import { createMemoryControlPlaneDirectory } from "./control-plane-directory";
import { handleGetManagementAudit } from "./handle-management-audit";
import { presentManagementAuditRecord } from "./management-audit";

const NOW = new Date("2026-09-22T22:00:00.000Z");
const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function auditRecord(overrides: Partial<AdminAuditRecord> = {}): AdminAuditRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    organizationId: "org_a",
    actorId: "owner_a",
    action: "receipt_settings.set",
    targetType: "receipt_settings",
    targetId: "loc_a1",
    locationId: "loc_a1",
    beforeState: { shorten_product_names: false, product_name_max_characters: 40, show_sku: false },
    afterState: { shorten_product_names: true, product_name_max_characters: 30, show_sku: true },
    correlationId: CORRELATION,
    createdAt: "2026-09-22T21:00:00.000Z",
    ...overrides,
  };
}

function session(actorId: string): Session {
  return {
    actorId,
    displayName: actorId,
    organizationId: "org_a",
    locationIds: ["loc_a1", "loc_a2"],
    capabilities: [],
    expiresAt: "2026-09-22T23:00:00.000Z",
  };
}

async function cookieFor(actorId: string) {
  const sessions = createEphemeralInMemoryStaffSessionStore();
  const id = await sessions.create(session(actorId), "csrf", new Date("2026-09-22T23:00:00.000Z"));
  return { sessions, cookieHeader: `cetech_pos_sid=${id}` };
}

describe("ADMIN-105 management audit", () => {
  test("owner, admin, and support receive organization-wide audit", async () => {
    for (const role of ["owner", "admin", "support"] as const) {
      const actorId = `${role}_a`;
      const { sessions, cookieHeader } = await cookieFor(actorId);
      const result = await handleGetManagementAudit({
        correlationId: CORRELATION,
        cookieHeader,
        now: NOW,
        sessions,
        assignments: createMemoryAssignmentDirectory([]),
        controlPlane: createMemoryControlPlaneDirectory([{
          organizationId: "org_a", actorId, controlRole: role, status: "active",
        }]),
        audit: createMemoryAdminAuditDirectory([
          auditRecord(),
          auditRecord({ id: "org-wide", locationId: undefined, targetType: "organization_membership" }),
        ]),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected audit");
      expect(result.data.scope).toEqual({ kind: "organization" });
      expect(result.data.rows).toHaveLength(2);
    }
  });

  test("manager sees only events tied to verified managed locations", async () => {
    const { sessions, cookieHeader } = await cookieFor("manager_a");
    const result = await handleGetManagementAudit({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions,
      assignments: createMemoryAssignmentDirectory([{
        actorId: "manager_a",
        organizationId: "org_a",
        locationRoles: [{ locationId: "loc_a1", role: "manager" }],
        registerIds: ["reg_a"],
      }]),
      controlPlane: createMemoryControlPlaneDirectory([]),
      audit: createMemoryAdminAuditDirectory([
        auditRecord({ id: "mine", locationId: "loc_a1" }),
        auditRecord({ id: "other-location", locationId: "loc_a2" }),
        auditRecord({ id: "org-wide", locationId: undefined, targetType: "organization_membership" }),
      ]),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected audit");
    expect(result.data.scope).toEqual({ kind: "locations", locationIds: ["loc_a1"] });
    expect(result.data.rows.map((row) => row.id)).toEqual(["mine"]);
  });

  test("cashier and unauthenticated requests fail before audit reads", async () => {
    const cashier = await cookieFor("cashier_a");
    let reads = 0;
    const directory: AdminAuditDirectory = {
      async listOrganization() { reads += 1; return { rows: [], truncated: false }; },
    };
    const denied = await handleGetManagementAudit({
      correlationId: CORRELATION,
      cookieHeader: cashier.cookieHeader,
      now: NOW,
      sessions: cashier.sessions,
      assignments: createMemoryAssignmentDirectory([{
        actorId: "cashier_a",
        organizationId: "org_a",
        locationRoles: [{ locationId: "loc_a1", role: "cashier" }],
        registerIds: [],
      }]),
      controlPlane: createMemoryControlPlaneDirectory([]),
      audit: directory,
    });
    expect(denied.ok).toBe(false);
    if (denied.ok) throw new Error("expected forbidden");
    expect(denied.error.code).toBe("FORBIDDEN");
    expect(reads).toBe(0);

    const unsigned = await handleGetManagementAudit({
      correlationId: CORRELATION,
      now: NOW,
      sessions: createEphemeralInMemoryStaffSessionStore(),
      assignments: createMemoryAssignmentDirectory([]),
      controlPlane: createMemoryControlPlaneDirectory([]),
      audit: directory,
    });
    expect(unsigned.ok).toBe(false);
    if (unsigned.ok) throw new Error("expected auth required");
    expect(unsigned.error.code).toBe("AUTH_REQUIRED");
    expect(reads).toBe(0);
  });

  test("leaky directory rows are stripped by tenant and manager scope", async () => {
    const { sessions, cookieHeader } = await cookieFor("manager_a");
    const result = await handleGetManagementAudit({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions,
      assignments: createMemoryAssignmentDirectory([{
        actorId: "manager_a",
        organizationId: "org_a",
        locationRoles: [{ locationId: "loc_a1", role: "manager" }],
        registerIds: [],
      }]),
      controlPlane: createMemoryControlPlaneDirectory([]),
      audit: {
        async listOrganization() {
          return {
            rows: [
              auditRecord({ id: "mine", locationId: "loc_a1" }),
              auditRecord({ id: "other-location", locationId: "loc_a2" }),
              auditRecord({ id: "other-org", organizationId: "org_b", locationId: "loc_a1" }),
            ],
            truncated: false,
          };
        },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected audit");
    expect(result.data.rows.map((row) => row.id)).toEqual(["mine"]);
  });

  test("failure is unavailable rather than empty success", async () => {
    const { sessions, cookieHeader } = await cookieFor("support_a");
    const result = await handleGetManagementAudit({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions,
      assignments: createMemoryAssignmentDirectory([]),
      controlPlane: createMemoryControlPlaneDirectory([{
        organizationId: "org_a", actorId: "support_a", controlRole: "support", status: "active",
      }]),
      audit: { async listOrganization() { return "unavailable"; } },
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected unavailable");
    expect(result.error.code).toBe("INTEGRATION_UNAVAILABLE");
  });

  test("presentation exposes only whitelisted field changes", () => {
    const presented = presentManagementAuditRecord(auditRecord({
      afterState: {
        shorten_product_names: true,
        product_name_max_characters: 24,
        show_sku: true,
        email: "private@example.test",
        service_role: "secret",
        password: "secret",
      },
    }));
    expect(presented.changes.map((change) => change.label)).toEqual([
      "Shorten product names",
      "Maximum product-name characters",
      "Show SKU",
    ]);
    const serialized = JSON.stringify(presented);
    expect(serialized).not.toContain("private@example.test");
    expect(serialized).not.toContain("service_role");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("secret");
  });

  test("selection is deterministic and bounded", () => {
    const many = Array.from({ length: MANAGEMENT_AUDIT_RESULT_LIMIT + 3 }, (_, index) =>
      auditRecord({
        id: String(index).padStart(3, "0"),
        createdAt: `2026-09-22T${String(index % 24).padStart(2, "0")}:00:00.000Z`,
      }),
    );
    const selected = selectAdminAuditRecords({ rows: many, organizationId: "org_a" });
    expect(selected.rows).toHaveLength(MANAGEMENT_AUDIT_RESULT_LIMIT);
    expect(selected.truncated).toBe(true);
    const times = selected.rows.map((row) => row.createdAt);
    expect([...times].sort().reverse()).toEqual(times);
  });

  test("Supabase read is GET-only and pushes manager scope into the query", async () => {
    const calls: string[] = [];
    const fetchImpl: PosRestFetch = async (url, init) => {
      calls.push(`${init.method ?? "GET"} ${url}`);
      return { ok: true, status: 200, json: async () => [] };
    };
    await createSupabaseAdminAuditDirectory({
      url: "https://example.test",
      serviceRoleKey: "service-role",
      fetchImpl,
    }).listOrganization({ organizationId: "org_a", locationIds: ["loc_a1"] });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("GET ");
    expect(calls[0]).toContain("organization_id=eq.org_a");
    expect(calls[0]).toContain("location_id=in.(loc_a1)");
    expect(calls[0]).not.toContain("loc_a2");
  });
});

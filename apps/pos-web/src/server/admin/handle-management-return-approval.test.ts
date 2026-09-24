import { describe, expect, test } from "vitest";
import type { Session } from "../../../../../docs/contracts/domain.generated";
import { createInMemoryReturnStore } from "../../core/returns/in-memory-store";
import type { StoredReturnRecord } from "../../core/returns/types";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { createMemoryAdminAuditStore } from "./admin-audit-store";
import { createMemoryControlPlaneDirectory } from "./control-plane-directory";
import { handleManagementReturnApproval } from "./handle-management-return-approval";
import { createMemoryReturnApprovalAdminStore } from "./return-approval-admin-store";

const NOW = new Date("2026-09-22T23:00:00.000Z");
const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RETURN_ID = "33333333-3333-4333-8333-333333333333";
const ORIGIN = "https://pos.example.test";

function storedReturn(overrides: Partial<StoredReturnRecord> = {}): StoredReturnRecord {
  return {
    returnId: RETURN_ID,
    organizationId: "org_a",
    locationId: "loc_a1",
    registerId: "reg_a",
    actorId: "cashier_a",
    transactionId: "44444444-4444-4444-8444-444444444444",
    saleId: "sale_a",
    economicsVersion: "hv1",
    fingerprint: "0123456789abcdef0123456789abcdef",
    previewExpiresAt: "2026-09-22T23:30:00.000Z",
    approvalRequired: true,
    refundTotal: { minor: 1500, currency: "GHS" },
    status: "approval_required",
    historicLines: [],
    historicTenders: [],
    requestedLines: [],
    ...overrides,
  };
}

async function session(actorId: string, locationIds: readonly string[]) {
  const sessions = createEphemeralInMemoryStaffSessionStore();
  const sid = await sessions.create({
    actorId,
    displayName: actorId,
    organizationId: "org_a",
    locationIds,
    capabilities: [],
    expiresAt: "2026-09-23T00:00:00.000Z",
  } satisfies Session, "csrf", new Date("2026-09-23T00:00:00.000Z"));
  return { sessions, cookieHeader: `cetech_pos_sid=${sid}` };
}

function protection(valid = true): MutationProtection {
  return {
    origin: valid ? ORIGIN : "https://evil.example",
    referer: null,
    csrfCookie: "csrf",
    csrfHeader: "csrf",
    allowedOrigins: [ORIGIN],
  };
}
type MutationProtection = {
  readonly origin: string | null;
  readonly referer: string | null;
  readonly csrfCookie: string | null;
  readonly csrfHeader: string | null;
  readonly allowedOrigins: readonly string[];
};

describe("ADMIN-105 return approval mutation", () => {
  test("operational manager binds one replay-safe approval and audit event", async () => {
    const auth = await session("manager_a", ["loc_a1"]);
    const returns = createInMemoryReturnStore();
    await returns.insertPreview(storedReturn());
    const audit = createMemoryAdminAuditStore();
    const approvals = createMemoryReturnApprovalAdminStore({ returns, audit });
    const common = {
      correlationId: CORRELATION,
      cookieHeader: auth.cookieHeader,
      now: NOW,
      sessions: auth.sessions,
      assignments: createMemoryAssignmentDirectory([{
        actorId: "manager_a",
        organizationId: "org_a",
        locationRoles: [{ locationId: "loc_a1", role: "manager" as const }],
        registerIds: ["reg_a"],
      }]),
      controlPlane: createMemoryControlPlaneDirectory([]),
      returns,
      approvals,
      returnId: RETURN_ID,
      protection: protection(),
    };
    const first = await handleManagementReturnApproval(common);
    const second = await handleManagementReturnApproval(common);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error("expected approval");
    expect(second.data.approvalId).toBe(first.data.approvalId);
    expect((await returns.getApprovalForReturn(RETURN_ID, storedReturn().fingerprint))?.approvalId)
      .toBe(first.data.approvalId);
    expect(audit.events.filter((row) => row.action === "return.approval.bound")).toHaveLength(1);
  });

  test("cashier and owner-without-manager-assignment cannot approve", async () => {
    for (const actor of [
      { id: "cashier_a", role: "cashier" as const, control: null },
      { id: "owner_a", role: "cashier" as const, control: "owner" as const },
    ]) {
      const auth = await session(actor.id, ["loc_a1"]);
      const returns = createInMemoryReturnStore();
      await returns.insertPreview(storedReturn());
      const result = await handleManagementReturnApproval({
        correlationId: CORRELATION,
        cookieHeader: auth.cookieHeader,
        now: NOW,
        sessions: auth.sessions,
        assignments: createMemoryAssignmentDirectory([{
          actorId: actor.id,
          organizationId: "org_a",
          locationRoles: [{ locationId: "loc_a1", role: actor.role }],
          registerIds: ["reg_a"],
        }]),
        controlPlane: createMemoryControlPlaneDirectory(
          actor.control ? [{ organizationId: "org_a", actorId: actor.id, controlRole: actor.control, status: "active" }] : [],
        ),
        returns,
        approvals: createMemoryReturnApprovalAdminStore({
          returns,
          audit: createMemoryAdminAuditStore(),
        }),
        returnId: RETURN_ID,
        protection: protection(),
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected forbidden");
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  test("manager cannot approve another managed-unknown location or another tenant", async () => {
    const auth = await session("manager_a", ["loc_a1", "loc_a2"]);
    for (const row of [
      storedReturn({ locationId: "loc_a2" }),
      storedReturn({ organizationId: "org_b" }),
    ]) {
      const returns = createInMemoryReturnStore();
      await returns.insertPreview(row);
      const result = await handleManagementReturnApproval({
        correlationId: CORRELATION,
        cookieHeader: auth.cookieHeader,
        now: NOW,
        sessions: auth.sessions,
        assignments: createMemoryAssignmentDirectory([{
          actorId: "manager_a",
          organizationId: "org_a",
          locationRoles: [{ locationId: "loc_a1", role: "manager" }],
          registerIds: ["reg_a"],
        }]),
        controlPlane: createMemoryControlPlaneDirectory([]),
        returns,
        approvals: createMemoryReturnApprovalAdminStore({
          returns,
          audit: createMemoryAdminAuditStore(),
        }),
        returnId: RETURN_ID,
        protection: protection(),
      });
      expect(result.ok).toBe(false);
    }
  });

  test("expired or non-approval return fails closed", async () => {
    const auth = await session("manager_a", ["loc_a1"]);
    for (const row of [
      storedReturn({ previewExpiresAt: "2026-09-22T22:59:59.000Z" }),
      storedReturn({ approvalRequired: false, status: "previewed" }),
    ]) {
      const returns = createInMemoryReturnStore();
      await returns.insertPreview(row);
      const result = await handleManagementReturnApproval({
        correlationId: CORRELATION,
        cookieHeader: auth.cookieHeader,
        now: NOW,
        sessions: auth.sessions,
        assignments: createMemoryAssignmentDirectory([{
          actorId: "manager_a",
          organizationId: "org_a",
          locationRoles: [{ locationId: "loc_a1", role: "manager" }],
          registerIds: ["reg_a"],
        }]),
        controlPlane: createMemoryControlPlaneDirectory([]),
        returns,
        approvals: createMemoryReturnApprovalAdminStore({
          returns,
          audit: createMemoryAdminAuditStore(),
        }),
        returnId: RETURN_ID,
        protection: protection(),
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected validation failure");
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("mutation requires valid origin/CSRF protection", async () => {
    const auth = await session("manager_a", ["loc_a1"]);
    const returns = createInMemoryReturnStore();
    await returns.insertPreview(storedReturn());
    const result = await handleManagementReturnApproval({
      correlationId: CORRELATION,
      cookieHeader: auth.cookieHeader,
      now: NOW,
      sessions: auth.sessions,
      assignments: createMemoryAssignmentDirectory([{
        actorId: "manager_a",
        organizationId: "org_a",
        locationRoles: [{ locationId: "loc_a1", role: "manager" }],
        registerIds: ["reg_a"],
      }]),
      controlPlane: createMemoryControlPlaneDirectory([]),
      returns,
      approvals: createMemoryReturnApprovalAdminStore({
        returns,
        audit: createMemoryAdminAuditStore(),
      }),
      returnId: RETURN_ID,
      protection: protection(false),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
  });
});

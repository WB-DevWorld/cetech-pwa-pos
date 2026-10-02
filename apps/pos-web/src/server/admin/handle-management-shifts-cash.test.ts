import { describe, expect, test } from "vitest";
import type { Session } from "../../../../../docs/contracts/domain.generated";
import type { PosRestFetch } from "../http/server-fetch";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { createMemoryControlPlaneDirectory } from "./control-plane-directory";
import { handleGetManagementShiftsCash } from "./handle-management-shifts-cash";
import {
  createMemoryManagementShiftCashDirectory,
  createSupabaseManagementShiftCashDirectory,
  MANAGEMENT_SHIFT_CASH_RESULT_LIMIT,
  managementShiftReportAvailability,
  selectManagementShiftCashRows,
  type ManagementShiftCashDirectory,
  type ManagementShiftCashRow,
  type ManagementShiftStatus,
} from "./management-shift-cash-directory";

const NOW = new Date("2026-09-22T16:00:00.000Z");
const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function shift(overrides: Partial<ManagementShiftCashRow> & Pick<ManagementShiftCashRow, "shiftId" | "status">): ManagementShiftCashRow {
  const status = overrides.status;
  return {
    organizationId: "org_a",
    locationId: "loc_a1",
    locationName: "Accra Main Store",
    registerId: "reg_a",
    registerName: "Register A",
    deviceId: "11111111-1111-4111-8111-111111111111",
    cashierId: "cashier_a",
    openedAt: "2026-09-22T08:00:00.000Z",
    openingFloat: { minor: 5000, currency: "GHS" },
    expectedCash: { minor: 12500, currency: "GHS" },
    ...overrides,
    report: overrides.report ?? managementShiftReportAvailability({
      status,
      zReportId: overrides.zReportId,
    }),
  };
}

const rows: readonly ManagementShiftCashRow[] = [
  shift({
    shiftId: "open-late",
    status: "open",
    openedAt: "2026-09-22T12:00:00.000Z",
    registerId: "reg_a2",
    registerName: "Register A2",
  }),
  shift({
    shiftId: "open-early",
    status: "open",
    openedAt: "2026-09-22T07:00:00.000Z",
  }),
  shift({
    shiftId: "closing-a",
    status: "closing",
    locationId: "loc_a2",
    locationName: "Tema Harbour",
    registerId: "reg_b",
    registerName: "Register B",
    openedAt: "2026-09-22T09:00:00.000Z",
  }),
  shift({
    shiftId: "attention-a",
    status: "requires_attention",
    openedAt: "2026-09-22T06:00:00.000Z",
    closedAt: "2026-09-22T11:00:00.000Z",
    countedCash: { minor: 10000, currency: "GHS" },
    variance: { minor: -2500, currency: "GHS" },
  }),
  shift({
    shiftId: "closed-new",
    status: "closed",
    openedAt: "2026-09-21T08:00:00.000Z",
    closedAt: "2026-09-21T18:00:00.000Z",
    countedCash: { minor: 12500, currency: "GHS" },
    variance: { minor: 0, currency: "GHS" },
    zReportId: "z-new",
  }),
  shift({
    shiftId: "closed-old",
    status: "closed",
    locationId: "loc_a2",
    locationName: "Tema Harbour",
    openedAt: "2026-09-20T08:00:00.000Z",
    closedAt: "2026-09-20T18:00:00.000Z",
    countedCash: { minor: 8000, currency: "GHS" },
    variance: { minor: 0, currency: "GHS" },
    zReportId: "z-old",
  }),
  shift({
    shiftId: "org-b",
    status: "open",
    organizationId: "org_b",
    locationId: "loc_b1",
    locationName: "Other Org",
    cashierId: "cashier_b",
  }),
];

function session(actorId: string, locationIds: readonly string[], organizationId = "org_a"): Session {
  return {
    actorId,
    displayName: actorId,
    organizationId,
    locationIds,
    capabilities: [],
    expiresAt: "2026-09-22T17:00:00.000Z",
  };
}

async function cookieFor(actorId: string, locationIds: readonly string[] = ["loc_a1"]) {
  const sessions = createEphemeralInMemoryStaffSessionStore();
  const id = await sessions.create(
    session(actorId, locationIds),
    "csrf",
    new Date("2026-09-22T17:00:00.000Z"),
  );
  return { sessions, cookieHeader: `cetech_pos_sid=${id}` };
}

function directory(extra: readonly ManagementShiftCashRow[] = rows) {
  return createMemoryManagementShiftCashDirectory(extra);
}

describe("ADMIN-105 shift and cash oversight", () => {
  test("owner sees organization-wide shifts in priority order", async () => {
    const { sessions, cookieHeader } = await cookieFor("owner_a", []);
    const result = await handleGetManagementShiftsCash({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions,
      assignments: createMemoryAssignmentDirectory([]),
      controlPlane: createMemoryControlPlaneDirectory([
        { organizationId: "org_a", actorId: "owner_a", controlRole: "owner", status: "active" },
      ]),
      shifts: directory(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected shifts");
    expect(result.data.scope).toEqual({ kind: "organization" });
    expect(result.data.rows.map((row) => row.shiftId)).toEqual([
      "attention-a",
      "closing-a",
      "open-early",
      "open-late",
      "closed-new",
      "closed-old",
    ]);
    expect(result.data.rows.some((row) => row.organizationId === "org_b")).toBe(false);
  });

  test("admin sees organization-wide shifts", async () => {
    const { sessions, cookieHeader } = await cookieFor("admin_a", []);
    const result = await handleGetManagementShiftsCash({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions,
      assignments: createMemoryAssignmentDirectory([]),
      controlPlane: createMemoryControlPlaneDirectory([
        { organizationId: "org_a", actorId: "admin_a", controlRole: "admin", status: "active" },
      ]),
      shifts: directory(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected shifts");
    expect(result.data.rows.map((row) => row.locationId)).toEqual([
      "loc_a1",
      "loc_a2",
      "loc_a1",
      "loc_a1",
      "loc_a1",
      "loc_a2",
    ]);
  });

  test("manager sees only the verified managed location", async () => {
    const { sessions, cookieHeader } = await cookieFor("manager_a", ["loc_a1", "loc_a2"]);
    const result = await handleGetManagementShiftsCash({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions,
      assignments: createMemoryAssignmentDirectory([
        {
          actorId: "manager_a",
          organizationId: "org_a",
          locationRoles: [{ locationId: "loc_a1", role: "manager" }],
          registerIds: ["reg_a", "reg_a2"],
        },
      ]),
      controlPlane: createMemoryControlPlaneDirectory([]),
      shifts: directory(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected shifts");
    expect(result.data.scope).toEqual({ kind: "locations", locationIds: ["loc_a1"] });
    expect(result.data.rows.every((row) => row.locationId === "loc_a1")).toBe(true);
    expect(result.data.rows.map((row) => row.shiftId)).not.toContain("closing-a");
    expect(result.data.rows.map((row) => row.shiftId)).not.toContain("closed-old");
  });

  test("manager location query cannot widen scope", async () => {
    const { sessions, cookieHeader } = await cookieFor("manager_a", ["loc_a1", "loc_a2"]);
    const shifts: ManagementShiftCashDirectory = {
      async listOrganization() {
        throw new Error("unauthorized location must not be queried");
      },
    };
    const result = await handleGetManagementShiftsCash({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions,
      assignments: createMemoryAssignmentDirectory([
        {
          actorId: "manager_a",
          organizationId: "org_a",
          locationRoles: [{ locationId: "loc_a1", role: "manager" }],
          registerIds: ["reg_a"],
        },
      ]),
      controlPlane: createMemoryControlPlaneDirectory([]),
      shifts,
      locationId: "loc_a2",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
  });

  test("support cannot access shift and cash oversight", async () => {
    const { sessions, cookieHeader } = await cookieFor("support_a", []);
    const result = await handleGetManagementShiftsCash({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions,
      assignments: createMemoryAssignmentDirectory([]),
      controlPlane: createMemoryControlPlaneDirectory([
        { organizationId: "org_a", actorId: "support_a", controlRole: "support", status: "active" },
      ]),
      shifts: directory(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
  });

  test("cashier is forbidden", async () => {
    const { sessions, cookieHeader } = await cookieFor("cashier_a");
    const result = await handleGetManagementShiftsCash({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions,
      assignments: createMemoryAssignmentDirectory([
        {
          actorId: "cashier_a",
          organizationId: "org_a",
          locationRoles: [{ locationId: "loc_a1", role: "cashier" }],
          registerIds: ["reg_a"],
        },
      ]),
      controlPlane: createMemoryControlPlaneDirectory([]),
      shifts: directory(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
  });

  test("organization A cannot see organization B shifts even when the directory leaks them", async () => {
    const { sessions, cookieHeader } = await cookieFor("owner_a", []);
    const leaky: ManagementShiftCashDirectory = {
      async listOrganization() {
        return { rows, truncated: false };
      },
    };
    const result = await handleGetManagementShiftsCash({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions,
      assignments: createMemoryAssignmentDirectory([]),
      controlPlane: createMemoryControlPlaneDirectory([
        { organizationId: "org_a", actorId: "owner_a", controlRole: "owner", status: "active" },
      ]),
      shifts: leaky,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected shifts");
    expect(result.data.rows.some((row) => row.organizationId !== "org_a" || row.shiftId === "org-b")).toBe(false);
  });

  test("data-store failure is unavailable rather than an empty success", async () => {
    const { sessions, cookieHeader } = await cookieFor("owner_a", []);
    const result = await handleGetManagementShiftsCash({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions,
      assignments: createMemoryAssignmentDirectory([]),
      controlPlane: createMemoryControlPlaneDirectory([
        { organizationId: "org_a", actorId: "owner_a", controlRole: "owner", status: "active" },
      ]),
      shifts: { async listOrganization() { return "unavailable"; } },
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected unavailable");
    expect(result.error.code).toBe("INTEGRATION_UNAVAILABLE");
  });

  test("preserves status, money sign, currency, and report availability", async () => {
    const { sessions, cookieHeader } = await cookieFor("admin_a", []);
    const result = await handleGetManagementShiftsCash({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions,
      assignments: createMemoryAssignmentDirectory([]),
      controlPlane: createMemoryControlPlaneDirectory([
        { organizationId: "org_a", actorId: "admin_a", controlRole: "admin", status: "active" },
      ]),
      shifts: directory(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected shifts");
    const attention = result.data.rows.find((row) => row.shiftId === "attention-a");
    const open = result.data.rows.find((row) => row.shiftId === "open-early");
    const closing = result.data.rows.find((row) => row.shiftId === "closing-a");
    const closed = result.data.rows.find((row) => row.shiftId === "closed-new");
    expect(attention?.status).toBe("requires_attention");
    expect(attention?.openingFloat).toEqual({ minor: 5000, currency: "GHS" });
    expect(attention?.expectedCash).toEqual({ minor: 12500, currency: "GHS" });
    expect(attention?.countedCash).toEqual({ minor: 10000, currency: "GHS" });
    expect(attention?.variance).toEqual({ minor: -2500, currency: "GHS" });
    expect(attention?.report).toEqual({ xAvailable: false, zAvailable: false });
    expect(open?.countedCash).toBeUndefined();
    expect(open?.variance).toBeUndefined();
    expect(open?.report).toEqual({ xAvailable: true, zAvailable: false });
    expect(closing?.status).toBe("closing");
    expect(closing?.report.xAvailable).toBe(true);
    expect(closing?.report.zAvailable).toBe(false);
    expect(closed?.status).toBe("closed");
    expect(closed?.variance).toEqual({ minor: 0, currency: "GHS" });
    expect(closed?.report).toEqual({ xAvailable: false, zAvailable: true, zReportId: "z-new" });
  });

  test("an authorized organization with no shifts is an empty success", async () => {
    const { sessions, cookieHeader } = await cookieFor("owner_a", []);
    const result = await handleGetManagementShiftsCash({
      correlationId: CORRELATION,
      cookieHeader,
      now: NOW,
      sessions,
      assignments: createMemoryAssignmentDirectory([]),
      controlPlane: createMemoryControlPlaneDirectory([
        { organizationId: "org_a", actorId: "owner_a", controlRole: "owner", status: "active" },
      ]),
      shifts: createMemoryManagementShiftCashDirectory([]),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected empty");
    expect(result.data.rows).toEqual([]);
    expect(result.data.truncated).toBe(false);
    expect(result.data.limit).toBe(MANAGEMENT_SHIFT_CASH_RESULT_LIMIT);
  });

  test("selection is deterministic and bounded", () => {
    const many = Array.from({ length: MANAGEMENT_SHIFT_CASH_RESULT_LIMIT + 5 }, (_, index) =>
      shift({
        shiftId: `open-${String(index).padStart(3, "0")}`,
        status: "open" satisfies ManagementShiftStatus,
        openedAt: `2026-09-22T${String(index % 24).padStart(2, "0")}:00:00.000Z`,
      }),
    );
    const selected = selectManagementShiftCashRows({
      rows: many,
      organizationId: "org_a",
    });
    expect(selected.rows).toHaveLength(MANAGEMENT_SHIFT_CASH_RESULT_LIMIT);
    expect(selected.truncated).toBe(true);
    const opened = selected.rows.map((row) => row.openedAt);
    expect([...opened].sort()).toEqual(opened);
  });
});

describe("ADMIN-105 shift cash supabase read model", () => {
  test("normalizes stored money and names without inventing a count", async () => {
    const calls: string[] = [];
    const fetchImpl: PosRestFetch = async (url) => {
      calls.push(url);
      const body = bodyFor(url);
      return { ok: true, status: 200, json: async () => body };
    };
    const directory = createSupabaseManagementShiftCashDirectory({
      url: "https://example.test",
      serviceRoleKey: "service-role",
      fetchImpl,
    });
    const listed = await directory.listOrganization({
      organizationId: "org_a",
      locationIds: ["loc_a1"],
    });
    expect(listed).not.toBe("unavailable");
    if (listed === "unavailable") throw new Error("expected rows");
    expect(calls.every((url) => url.includes("organization_id=eq.org_a"))).toBe(true);
    expect(calls.some((url) => url.includes("location_id=in.(loc_a1)"))).toBe(true);
    expect(calls.some((url) => url.includes("loc_a2"))).toBe(false);
    expect(listed.rows).toHaveLength(4);
    expect(listed.rows.map((row) => row.status)).toEqual([
      "requires_attention",
      "closing",
      "open",
      "closed",
    ]);
    const open = listed.rows.find((row) => row.status === "open");
    expect(open?.openingFloat).toEqual({ minor: 1500, currency: "GHS" });
    expect(open?.expectedCash).toEqual({ minor: 2500, currency: "GHS" });
    expect(open?.countedCash).toBeUndefined();
    expect(open?.variance).toBeUndefined();
    expect(open?.locationName).toBe("Accra Main Store and Service Counter");
    expect(open?.registerName).toBe("Front Register A");
    const attention = listed.rows.find((row) => row.status === "requires_attention");
    expect(attention?.variance).toEqual({ minor: -250, currency: "GHS" });
    expect(attention?.countedCash).toEqual({ minor: 2250, currency: "GHS" });
    expect(attention?.report.zAvailable).toBe(false);
    const closed = listed.rows.find((row) => row.status === "closed");
    expect(closed?.report).toEqual({
      xAvailable: false,
      zAvailable: true,
      zReportId: "z-report-1",
    });
  });

  test("a failed shift query is unavailable", async () => {
    const fetchImpl: PosRestFetch = async (url) => {
      if (url.includes("status=eq.open")) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => [] };
    };
    const directory = createSupabaseManagementShiftCashDirectory({
      url: "https://example.test",
      serviceRoleKey: "service-role",
      fetchImpl,
    });
    await expect(directory.listOrganization({ organizationId: "org_a" })).resolves.toBe("unavailable");
  });
});

function bodyFor(url: string): unknown {
  if (url.includes("pos_locations")) {
    return [{ id: "loc_a1", name: "Accra Main Store and Service Counter" }];
  }
  if (url.includes("pos_registers")) {
    return [{ id: "reg_a", location_id: "loc_a1", name: "Front Register A" }];
  }
  if (url.includes("status=eq.requires_attention")) {
    return [storedShift("requires_attention", "2026-09-22T06:00:00.000Z", {
      counted_cash_minor: "2250",
      counted_cash_currency: "GHS",
      variance_minor: "-250",
      variance_currency: "GHS",
      closed_at: "2026-09-22T11:00:00.000Z",
    })];
  }
  if (url.includes("status=eq.closing")) {
    return [storedShift("closing", "2026-09-22T09:00:00.000Z")];
  }
  if (url.includes("status=eq.open")) {
    return [storedShift("open", "2026-09-22T08:00:00.000Z")];
  }
  if (url.includes("status=eq.closed")) {
    return [storedShift("closed", "2026-09-21T08:00:00.000Z", {
      counted_cash_minor: 2500,
      counted_cash_currency: "GHS",
      variance_minor: 0,
      variance_currency: "GHS",
      closed_at: "2026-09-21T18:00:00.000Z",
      z_report_id: "z-report-1",
    })];
  }
  return [];
}

function storedShift(status: string, openedAt: string, extra: Record<string, unknown> = {}) {
  return {
    id: `shift-${status}`,
    organization_id: "org_a",
    location_id: "loc_a1",
    register_id: "reg_a",
    device_id: "11111111-1111-4111-8111-111111111111",
    cashier_id: "cashier_a",
    status,
    opening_float_minor: "1500",
    opening_float_currency: "GHS",
    expected_cash_minor: "2500",
    expected_cash_currency: "GHS",
    counted_cash_minor: null,
    counted_cash_currency: null,
    variance_minor: null,
    variance_currency: null,
    opened_at: openedAt,
    closed_at: null,
    z_report_id: null,
    ...extra,
  };
}

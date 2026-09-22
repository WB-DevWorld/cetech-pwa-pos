import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { managementShiftReportAvailability, type ManagementShiftCashRow, type ManagementShiftCashView } from "../../server/admin/management-shift-cash-directory";
import { DEFAULT_SHIFT_CLOSE_POLICY } from "../../server/auth/policy";
import { ManagementScreen } from "./ManagementScreen";
import { ShiftCashPanel } from "./ShiftCashPanel";

const NOW = new Date("2026-09-22T12:00:00.000Z");

function row(overrides: Partial<ManagementShiftCashRow> & Pick<ManagementShiftCashRow, "shiftId" | "status">): ManagementShiftCashRow {
  return {
    organizationId: "org_a",
    locationId: "loc_a1",
    locationName: "Accra Main Store and Service Counter — North Ridge Industrial",
    registerId: "reg_a",
    registerName: "Front Register A — Express Lane",
    deviceId: "11111111-1111-4111-8111-111111111111",
    cashierId: "Ama Mensah — Morning Cashier",
    openedAt: "2026-09-22T10:30:00.000Z",
    openingFloat: { minor: 5000, currency: "GHS" },
    expectedCash: { minor: 12500, currency: "GHS" },
    report: managementShiftReportAvailability({
      status: overrides.status,
      zReportId: overrides.zReportId,
    }),
    ...overrides,
  };
}

function view(rows: readonly ManagementShiftCashRow[], scope: ManagementShiftCashView["scope"] = { kind: "locations", locationIds: ["loc_a1"] }): ManagementShiftCashView {
  return { scope, limit: 40, truncated: false, rows };
}

function render(props: Partial<ComponentProps<typeof ShiftCashPanel>> = {}) {
  return renderToStaticMarkup(<ShiftCashPanel view={view([])} now={NOW} {...props} />);
}

describe("ShiftCashPanel", () => {
  test("renders an open shift without inventing a count or variance", () => {
    const html = render({
      view: view([row({ shiftId: "open-1", status: "open" })]),
    });
    expect(html).toContain("Accra Main Store and Service Counter — North Ridge Industrial");
    expect(html).toContain("Front Register A — Express Lane");
    expect(html).toContain("Opened by Ama Mensah — Morning Cashier");
    expect(html).toContain("Open for 1 hr 30 min");
    expect(html).toContain("Expected cash");
    expect(html).toContain("GHS");
    expect(html).toContain("X report available");
    expect(html).toContain("Z report pending because shift is not closed");
    expect(html).toContain('data-shift-status="open"');
    expect(html).not.toContain("Counted cash");
    expect(html).not.toContain("Variance");
    expect(html).not.toContain("<table");
    expect(html).toContain('data-layout="shift-card"');
  });

  test("makes requires attention unmistakable", () => {
    const html = render({
      view: view([row({
        shiftId: "attention-1",
        status: "requires_attention",
        countedCash: { minor: 10000, currency: "GHS" },
        variance: { minor: -2500, currency: "GHS" },
      })]),
    });
    expect(html).toContain("Needs attention");
    expect(html).toContain("Requires attention");
    expect(html).toContain("Short by GHS");
    expect(html).toContain('data-variance-minor="-2500"');
    expect(html).toContain("status-pill danger");
    expect(html).toContain('data-shift-status="requires_attention"');
  });

  test("closing does not masquerade as open or closed", () => {
    const html = render({
      view: view([row({ shiftId: "closing-1", status: "closing" })]),
    });
    expect(html).toContain("Closing");
    expect(html).toContain('data-shift-status="closing"');
    expect(html).toContain("status-pill warning");
    expect(html).not.toContain('data-shift-status="open"');
    expect(html).not.toContain('data-shift-status="closed"');
    expect(html).not.toContain(">Closed<");
  });

  test("closed zero variance does not raise a warning", () => {
    const html = render({
      view: view([row({
        shiftId: "closed-1",
        status: "closed",
        closedAt: "2026-09-22T11:00:00.000Z",
        countedCash: { minor: 12500, currency: "GHS" },
        variance: { minor: 0, currency: "GHS" },
        zReportId: "z-1",
      })]),
    });
    expect(html).toContain("No variance");
    expect(html).toContain("Z report available");
    expect(html).toContain("Recently closed");
    expect(html).not.toContain("Short by");
    expect(html).not.toContain("Over by");
    expect(html).not.toContain("banner warning");
    expect(html).not.toContain("Requires attention");
    expect(html).not.toContain('data-shift-status="requires_attention"');
  });

  test("non-zero variance is explicit", () => {
    const html = render({
      view: view([row({
        shiftId: "closed-over",
        status: "closed",
        closedAt: "2026-09-22T11:00:00.000Z",
        countedCash: { minor: 13000, currency: "GHS" },
        variance: { minor: 500, currency: "GHS" },
        zReportId: "z-over",
      })]),
    });
    expect(html).toContain("Over by GHS");
    expect(html).toContain('data-variance-minor="500"');
  });

  test("empty authorized scope is not an error", () => {
    const html = render({ view: view([]) });
    expect(html).toContain("No shifts are currently available in your management scope.");
    expect(html).toContain("Showing shifts only for locations you manage.");
    expect(html).not.toContain("temporarily unavailable");
  });

  test("server unavailability is an error state", () => {
    const html = render({
      view: null,
      errorMessage: "shift and cash oversight is unavailable",
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(html).toContain("Shift and cash oversight is temporarily unavailable.");
    expect(html).toContain("Reference aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(html).not.toContain("No shifts are currently available");
  });

  test("renders only the authorized shifts it was given", () => {
    const html = render({
      view: view([
        row({ shiftId: "mine", status: "open", locationName: "Accra Main Store", registerName: "Register A" }),
      ]),
    });
    expect(html).toContain("Accra Main Store");
    expect(html).toContain("Showing shifts for Accra Main Store.");
    expect(html).not.toContain("Tema Harbour");
    expect(html).not.toContain("Register B");
  });

  test("shows effective close policy without an editor", () => {
    const html = render({
      view: view([row({ shiftId: "open-1", status: "open", locationName: "Accra Main Store" })]),
      policy: {
        scope: { organizationId: "org_a", locationId: "loc_a1" },
        effective: DEFAULT_SHIFT_CLOSE_POLICY,
        canManage: false,
      },
      onOpenPolicies: () => undefined,
    });
    expect(html).toContain("Policy reference: location loc_a1.");
    expect(html).toContain("Managers allowed");
    expect(html).toContain("Cashier close disabled");
    expect(html).toContain("Non-zero variance requires manager");
    expect(html).toContain("Register-specific overrides may differ from this location policy.");
    expect(html).toContain("Open Policies");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("type=\"checkbox\"");
  });

  test("does not present one scoped policy as universal across multiple visible locations", () => {
    const html = render({
      view: view(
        [
          row({ shiftId: "loc-a", status: "open", locationId: "loc_a1", locationName: "Accra" }),
          row({ shiftId: "loc-b", status: "open", locationId: "loc_a2", locationName: "Tema" }),
        ],
        { kind: "locations", locationIds: ["loc_a1", "loc_a2"] },
      ),
      policy: {
        scope: { organizationId: "org_a", locationId: "loc_a1" },
        effective: DEFAULT_SHIFT_CLOSE_POLICY,
        canManage: false,
      },
    });
    expect(html).toContain("Policy reference: location loc_a1.");
    expect(html).toContain("other visible locations or register overrides may differ");
  });

  test("labels an organization default as a reference when organization-wide shifts are shown", () => {
    const html = render({
      view: view(
        [row({ shiftId: "org-open", status: "open", locationId: "loc_a1", locationName: "Accra" })],
        { kind: "organization" },
      ),
      policy: {
        scope: { organizationId: "org_a" },
        effective: DEFAULT_SHIFT_CLOSE_POLICY,
        canManage: true,
      },
    });
    expect(html).toContain("Policy reference: organization default.");
    expect(html).toContain("not necessarily the effective policy for every shift shown");
  });

  test("management screen uses the shift panel instead of the foundation placeholder", () => {
    const html = renderToStaticMarkup(
      <ManagementScreen
        context={{
          actorId: "manager_a",
          displayName: "Ama Mensah",
          organizationId: "org_a",
          controlRole: null,
          managerLocationIds: ["loc_a1"],
          locationRoles: [{ locationId: "loc_a1", role: "manager" }],
          sections: ["overview", "shifts_cash", "policies"],
        }}
        activeSection="shifts_cash"
        onBackToPos={() => undefined}
        shiftCashView={view([row({
          shiftId: "open-1",
          status: "open",
          locationName: "Accra Main Store",
          registerName: "Register A",
        })])}
        onSelectSection={() => undefined}
      />,
    );
    expect(html).toContain("Ama Mensah");
    expect(html).toContain("Accra Main Store");
    expect(html).toContain("Back to POS");
    expect(html).toContain("Shifts &amp; cash");
    expect(html).not.toContain("Foundation screen only");
  });
});

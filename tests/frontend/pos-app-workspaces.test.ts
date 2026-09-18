import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { CustomerPort } from "../../docs/contracts/ports";
import type { CustomerSummary } from "../../docs/contracts/domain.generated";
import { ApprovedWorkspaceScreens } from "../../apps/pos-web/src/app/workspace-runtime";
import type { StaffRuntimeAuthority } from "../../apps/pos-web/src/core/identity";

const PLACEHOLDER = "This workspace is not part of the R4 Sell runtime.";

const authority: StaffRuntimeAuthority = {
  status: "ready",
  session: {
    actorId: "cashier_a",
    displayName: "Cashier A",
    organizationId: "org_a",
    locationIds: ["loc_a1"],
    capabilities: ["ui.hint.only"],
    expiresAt: "2099-01-01T00:00:00.000Z",
  },
  assignedLocationIds: ["loc_a1"],
  assignedRegisterIds: ["reg_a"],
  register: {
    id: "reg_a",
    name: "Front Counter",
    locationId: "loc_a1",
    currency: "GHS",
    status: "active",
  },
  shift: {
    id: "s1111111-1111-4111-8111-111111111111",
    registerId: "reg_a",
    deviceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    cashierId: "cashier_a",
    status: "open",
    openingFloat: { minor: 50000, currency: "GHS" },
    openedAt: "2026-09-17T08:00:00.000Z",
  },
  shiftOpen: true,
};

const customers: CustomerPort = {
  async search() {
    const data: CustomerSummary[] = [{ id: "cust-ada", kind: "retail", displayName: "Ada Boateng" }];
    return { ok: true, data, correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
  },
};

function render(route: "orders" | "customers" | "settings" | "health" | "attention"): string {
  return renderToStaticMarkup(
    createElement(ApprovedWorkspaceScreens, {
      route,
      authority,
      customers,
      online: true,
      catalogAvailability: "fresh",
      onNavigate: () => undefined,
    }),
  );
}

describe("STG-01 mounted approved workspaces", () => {
  test("Orders mounts Ben's screen instead of the R4 placeholder", () => {
    const html = render("orders");
    expect(html).toContain("Orders");
    expect(html).toContain("No sales yet.");
    expect(html).toContain("Completed sales will appear here when order history is available.");
    expect(html).not.toContain(PLACEHOLDER);
  });

  test("Customers mounts Ben's screen instead of the R4 placeholder", () => {
    const html = render("customers");
    expect(html).toContain("Customers");
    expect(html).not.toContain(PLACEHOLDER);
  });

  test("Settings mounts Ben's screen instead of the R4 placeholder", () => {
    const html = render("settings");
    expect(html).toContain("Settings");
    expect(html).toContain("Front Counter");
    expect(html).not.toContain(PLACEHOLDER);
  });

  test("Health mounts System status instead of the R4 placeholder", () => {
    const html = render("health");
    expect(html).toContain("System status");
    expect(html).not.toContain(PLACEHOLDER);
  });

  test("Attention mounts Needs attention instead of the R4 placeholder", () => {
    const html = render("attention");
    expect(html).toContain("Needs attention");
    expect(html).not.toContain(PLACEHOLDER);
  });
});

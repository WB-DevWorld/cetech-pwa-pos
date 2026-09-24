import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { ManagementAuditView } from "../../server/admin/management-audit";
import { AuditPanel } from "./AuditPanel";
import { ManagementScreen } from "./ManagementScreen";

function view(): ManagementAuditView {
  return {
    scope: { kind: "organization" },
    limit: 50,
    truncated: false,
    rows: [{
      id: "11111111-1111-4111-8111-111111111111",
      actorId: "owner_a",
      action: "receipt_settings.set",
      actionLabel: "Receipt settings changed",
      targetType: "receipt_settings",
      targetLabel: "Receipt settings",
      targetId: "loc_a1",
      locationId: "loc_a1",
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      createdAt: "2026-09-22T21:00:00.000Z",
      changes: [
        { label: "Shorten product names", before: "No", after: "Yes" },
        { label: "Show SKU", before: "No", after: "Yes" },
      ],
    }],
  };
}

describe("AuditPanel", () => {
  test("shows who changed what while raw state stays hidden", () => {
    const html = renderToStaticMarkup(<AuditPanel view={view()} />);
    expect(html).toContain("Receipt settings changed");
    expect(html).toContain("Changed by");
    expect(html).toContain("owner_a");
    expect(html).toContain("Shorten product names");
    expect(html).toContain("loc_a1");
    expect(html).toContain("Reference");
    expect(html).toContain('data-layout="management-audit"');
    expect(html).not.toContain("before_state");
    expect(html).not.toContain("after_state");
    expect(html).not.toContain("service_role");
    expect(html).not.toContain("<table");
  });

  test("manager scope does not imply organization-wide visibility", () => {
    const html = renderToStaticMarkup(
      <AuditPanel view={{ ...view(), scope: { kind: "locations", locationIds: ["loc_a1"] } }} />,
    );
    expect(html).toContain("only for locations you manage");
    expect(html).not.toContain("whole organization");
  });

  test("empty, loading and unavailable stay distinct", () => {
    const empty = renderToStaticMarkup(<AuditPanel view={{ ...view(), rows: [] }} />);
    const loading = renderToStaticMarkup(<AuditPanel view={null} loading />);
    const failed = renderToStaticMarkup(
      <AuditPanel view={null} errorMessage="management audit is unavailable" correlationId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" />,
    );
    expect(empty).toContain("No management audit events are available");
    expect(loading).toContain("Loading audit history…");
    expect(failed).toContain("Audit history is temporarily unavailable.");
    expect(failed).toContain("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });

  test("management screen replaces the audit placeholder", () => {
    const html = renderToStaticMarkup(
      <ManagementScreen
        context={{
          actorId: "support_a",
          displayName: "Support Desk",
          organizationId: "org_a",
          controlRole: "support",
          managerLocationIds: [],
          locationRoles: [],
          sections: ["overview", "system_health", "audit"],
        }}
        activeSection="audit"
        onBackToPos={() => undefined}
        auditView={view()}
      />,
    );
    expect(html).toContain("Support Desk");
    expect(html).toContain("Receipt settings changed");
    expect(html).toContain("Back to POS");
    expect(html).not.toContain("Foundation screen only");
  });
});

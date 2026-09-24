import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { ManagementSystemHealthView } from "../../server/admin/management-system-health";
import { ManagementScreen } from "./ManagementScreen";
import { SystemHealthPanel } from "./SystemHealthPanel";

function view(): ManagementSystemHealthView {
  return {
    overall: "unavailable",
    buildId: "build-105-very-long-identifier-for-support-reference-only",
    checks: [
      {
        id: "bridge",
        label: "Commerce connection",
        status: "unavailable",
        summary: "This check could not be completed.",
        detail: "commerce connection could not be reached",
        checkedAt: "2026-09-22T16:00:01.000Z",
      },
      {
        id: "bridge-contract",
        label: "Commerce contract",
        status: "unverified",
        summary: "This check has not been confirmed.",
        checkedAt: "2026-09-22T16:00:02.000Z",
      },
      {
        id: "supabase",
        label: "Store data",
        status: "healthy",
        summary: "This check succeeded.",
        checkedAt: "2026-09-22T16:00:00.000Z",
      },
    ],
  };
}

describe("SystemHealthPanel", () => {
  test("shows unavailable service checks without calling them healthy", () => {
    const html = renderToStaticMarkup(<SystemHealthPanel view={view()} />);
    expect(html).toContain("Commerce connection");
    expect(html).toContain("Store data");
    expect(html).toContain("A required service check is unavailable.");
    expect(html).toContain("This check has not been confirmed.");
    expect(html).toContain('data-layout="system-health"');
    expect(html).toContain('data-health-status="unavailable"');
    expect(html).toContain("build-105-very-long-identifier-for-support-reference-only");
    expect(html).not.toContain("service_role");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("Pay");
  });

  test("a confirmed set of checks is distinct from an unverified set", () => {
    const html = renderToStaticMarkup(
      <SystemHealthPanel
        view={{
          overall: "healthy",
          buildId: "build-ok",
          checks: [{
            id: "supabase",
            label: "Store data",
            status: "healthy",
            summary: "This check succeeded.",
            checkedAt: "2026-09-22T16:00:00.000Z",
          }],
        }}
      />,
    );
    expect(html).toContain("The service checks that ran succeeded.");
    expect(html).toContain("Working");
    expect(html).not.toContain("not confirmed");
  });

  test("loading and failure stay distinct", () => {
    const loading = renderToStaticMarkup(<SystemHealthPanel view={null} loading />);
    const failed = renderToStaticMarkup(
      <SystemHealthPanel
        view={null}
        errorMessage="system health is unavailable"
        correlationId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      />,
    );
    expect(loading).toContain("Loading system health…");
    expect(loading).not.toContain("temporarily unavailable");
    expect(failed).toContain("System health is temporarily unavailable.");
    expect(failed).toContain("Reference aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(failed).not.toContain("The service checks that ran succeeded.");
  });

  test("management screen replaces the system health placeholder", () => {
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
        activeSection="system_health"
        onBackToPos={() => undefined}
        systemHealthView={view()}
      />,
    );
    expect(html).toContain("Support Desk");
    expect(html).toContain("Commerce connection");
    expect(html).toContain("Back to POS");
    expect(html).not.toContain("Foundation screen only");
  });
});

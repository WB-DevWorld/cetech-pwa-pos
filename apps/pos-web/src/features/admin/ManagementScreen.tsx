"use client";

import type { ReactNode } from "react";
import type { ManagementContext, ManagementSection } from "../../server/admin/management-context";
import type { StaffAccessRecord } from "../../server/admin/staff-access-directory";
import type { OperationalPolicyView } from "../../server/admin/handle-operational-policy";
import type { ShiftClosePolicyOverride } from "../../server/auth/policy";
import { StaffAccessPanel } from "./StaffAccessPanel";
import { PolicyPanel } from "./PolicyPanel";

const LABELS: Record<ManagementSection, { label: string; description: string }> = {
  overview: { label: "Overview", description: "Live operational management summary." },
  staff_access: { label: "Staff & access", description: "Staff identities, roles, locations and register assignments." },
  locations: { label: "Locations", description: "Organization locations and operational scope." },
  registers: { label: "Registers", description: "Register status, assignments and configuration." },
  devices: { label: "Devices", description: "POS devices and register/device associations." },
  shifts_cash: { label: "Shifts & cash", description: "Open/closed shifts, X/Z reports, cash policy and variance review." },
  returns_approvals: { label: "Returns & approvals", description: "Returns, refund reconciliation and approval work." },
  system_health: { label: "System health", description: "Integration health, diagnostics and support evidence." },
  audit: { label: "Audit", description: "Who changed what, where and when." },
  policies: { label: "Policies", description: "Operational permissions and inherited organization/location/register policy." },
};

export function ManagementScreen({
  context,
  activeSection = "overview",
  onSelectSection,
  onBackToPos,
  staffRows = [],
  staffLoading = false,
  staffError,
  policyView = null,
  policyLoading = false,
  policySaving = false,
  policyError,
  onSavePolicy,
}: {
  readonly context: ManagementContext;
  readonly activeSection?: ManagementSection;
  readonly onSelectSection?: (section: ManagementSection) => void;
  readonly onBackToPos?: () => void;
  readonly staffRows?: readonly StaffAccessRecord[];
  readonly staffLoading?: boolean;
  readonly staffError?: string;
  readonly policyView?: OperationalPolicyView | null;
  readonly policyLoading?: boolean;
  readonly policySaving?: boolean;
  readonly policyError?: string;
  readonly onSavePolicy?: (override: ShiftClosePolicyOverride) => void;
}) {
  const active = LABELS[activeSection];
  const roleLabel = context.controlRole
    ? context.controlRole[0]!.toUpperCase() + context.controlRole.slice(1)
    : context.managerLocationIds.length > 0
      ? "Manager"
      : "Management";

  return (
    <div className="management-shell" data-management-role={context.controlRole ?? "manager"}>
      <aside className="management-sidebar" aria-label="Management navigation">
        <div className="management-brand">
          <span className="brand-mark">CT</span>
          <div>
            <strong>CETECH POS</strong>
            <span>Management</span>
          </div>
        </div>
        <nav className="management-nav">
          {context.sections.map((section) => (
            <button
              key={section}
              type="button"
              className={activeSection === section ? "management-nav-item active" : "management-nav-item"}
              aria-current={activeSection === section ? "page" : undefined}
              onClick={() => onSelectSection?.(section)}
            >
              {LABELS[section].label}
            </button>
          ))}
        </nav>
        {onBackToPos ? (
          <button className="btn block" type="button" onClick={onBackToPos}>
            Back to POS
          </button>
        ) : null}
      </aside>

      <main className="management-main">
        <header className="management-topbar">
          <div>
            <span className="eyebrow">Management control plane</span>
            <h1>{active.label}</h1>
          </div>
          <div className="management-identity">
            <strong>{context.displayName}</strong>
            <span>{roleLabel}</span>
          </div>
        </header>

        <section className="management-content">
          <p className="management-lead">{active.description}</p>

          {activeSection === "overview" ? (
            <div className="management-grid">
              <ManagementCard title="Authority">
                <p>Organization: {context.organizationId}</p>
                <p>Control role: {context.controlRole ?? "Operational manager"}</p>
                <p>
                  Manager locations: {context.managerLocationIds.length > 0
                    ? context.managerLocationIds.join(", ")
                    : "None"}
                </p>
              </ManagementCard>
              <ManagementCard title="Staff & access">
                <p>Staff access is server-scoped to the current organization and managed locations.</p>
                <p>Organization owner/admin may change operational assignments; managers currently have read-only oversight.</p>
              </ManagementCard>
              <ManagementCard title="Shift-close policy">
                <p>Policy is server-owned and inherits organization → location → register.</p>
                <p>Cashier, manager, or both can be permitted according to the effective policy.</p>
              </ManagementCard>
              <ManagementCard title="Security boundary">
                <p>Cashier POS stays separate. Technical diagnostics and privileged controls belong here.</p>
              </ManagementCard>
            </div>
          ) : activeSection === "staff_access" ? (
            <StaffAccessPanel
              rows={staffRows}
              loading={staffLoading}
              errorMessage={staffError}
            />
          ) : activeSection === "policies" ? (
            <PolicyPanel
              view={policyView}
              loading={policyLoading}
              saving={policySaving}
              errorMessage={policyError}
              onSave={onSavePolicy}
            />
          ) : (
            <section className="card card-pad stack">
              <h2>{active.label}</h2>
              <p>{active.description}</p>
              <div className="banner warning" role="status">
                Foundation screen only. Mutations stay disabled until the corresponding server-owned authorization and audit endpoint is implemented.
              </div>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}

function ManagementCard({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="card card-pad stack management-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

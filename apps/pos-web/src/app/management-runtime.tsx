"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiResult } from "../../../../docs/contracts/ports";
import type { ManagementContext, ManagementSection } from "../server/admin/management-context";
import type { StaffAccessRecord } from "../server/admin/staff-access-directory";
import type { OperationalPolicyView } from "../server/admin/handle-operational-policy";
import type { ShiftClosePolicyOverride } from "../server/auth/policy";
import { ManagementScreen } from "../features/admin/ManagementScreen";
import {
  fetchManagementContext,
  fetchOperationalPolicy,
  fetchStaffAccess,
  updateOperationalPolicy,
} from "./management-client";

export function ManagementRuntime({ fetchImpl = fetch }: { readonly fetchImpl?: typeof fetch }) {
  const router = useRouter();
  const [result, setResult] = useState<ApiResult<ManagementContext> | null>(null);
  const [section, setSection] = useState<ManagementSection>("overview");
  const [staffResult, setStaffResult] = useState<ApiResult<readonly StaffAccessRecord[]> | null>(null);
  const [policyResult, setPolicyResult] = useState<ApiResult<OperationalPolicyView> | null>(null);
  const [policySaving, setPolicySaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    void fetchManagementContext(fetchImpl).then((next) => {
      if (!cancelled) setResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchImpl]);

  const context = result?.ok ? result.data : null;
  const allowedSection = context
    ? context.sections.includes(section)
      ? section
      : context.sections[0] ?? "overview"
    : "overview";

  const policyScope = useMemo(() => {
    if (!context) return {};
    if (context.controlRole === "owner" || context.controlRole === "admin") {
      return {};
    }
    const locationId = context.managerLocationIds[0];
    return locationId ? { locationId } : {};
  }, [context]);

  useEffect(() => {
    if (!context || allowedSection !== "staff_access") return;
    let cancelled = false;
    setStaffResult(null);
    void fetchStaffAccess(fetchImpl).then((next) => {
      if (!cancelled) setStaffResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [allowedSection, context, fetchImpl]);

  useEffect(() => {
    if (!context || allowedSection !== "policies") return;
    let cancelled = false;
    setPolicyResult(null);
    void fetchOperationalPolicy(policyScope, fetchImpl).then((next) => {
      if (!cancelled) setPolicyResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [allowedSection, context, fetchImpl, policyScope]);

  async function savePolicy(override: ShiftClosePolicyOverride) {
    if (!context) return;
    setPolicySaving(true);
    try {
      setPolicyResult(await updateOperationalPolicy({ scope: policyScope, override }, fetchImpl));
    } finally {
      setPolicySaving(false);
    }
  }

  if (!result) {
    return (
      <main className="management-standalone-state">
        <div className="card card-pad">
          <h1>Management</h1>
          <p>Loading authorized management workspace…</p>
        </div>
      </main>
    );
  }

  if (!result.ok) {
    return (
      <main className="management-standalone-state">
        <div className="card card-pad stack">
          <h1>Management</h1>
          <div className="banner danger" role="alert">
            {result.error.code === "FORBIDDEN"
              ? "This staff account is not authorized for management."
              : result.error.code === "AUTH_REQUIRED"
                ? "Sign in to the POS before opening Management."
                : "Management is temporarily unavailable."}
          </div>
          <button className="btn" type="button" onClick={() => router.push("/sell")}>
            Back to POS
          </button>
        </div>
      </main>
    );
  }

  return (
    <ManagementScreen
      context={result.data}
      activeSection={allowedSection}
      onSelectSection={setSection}
      onBackToPos={() => router.push("/sell")}
      staffRows={staffResult?.ok ? staffResult.data : []}
      staffLoading={allowedSection === "staff_access" && staffResult === null}
      staffError={
        allowedSection === "staff_access" && staffResult && !staffResult.ok
          ? staffResult.error.message
          : undefined
      }
      policyView={policyResult?.ok ? policyResult.data : null}
      policyLoading={allowedSection === "policies" && policyResult === null}
      policySaving={policySaving}
      policyError={
        allowedSection === "policies" && policyResult && !policyResult.ok
          ? policyResult.error.message
          : undefined
      }
      onSavePolicy={
        policyResult?.ok && policyResult.data.canManage
          ? (override) => {
              void savePolicy(override);
            }
          : undefined
      }
    />
  );
}

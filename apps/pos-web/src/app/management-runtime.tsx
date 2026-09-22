"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiResult } from "../../../../docs/contracts/ports";
import type { ManagementContext, ManagementSection } from "../server/admin/management-context";
import type { StaffAccessRecord } from "../server/admin/staff-access-directory";
import type { OperationalPolicyView } from "../server/admin/handle-operational-policy";
import type { ManagementLocation } from "../server/admin/management-topology-directory";
import type { ShiftClosePolicyOverride } from "../server/auth/policy";
import { ManagementScreen } from "../features/admin/ManagementScreen";
import {
  fetchManagementContext,
  fetchManagementTopology,
  fetchOperationalPolicy,
  fetchStaffAccess,
  updateOperationalPolicy,
  updateStaffAssignment,
} from "./management-client";

export function ManagementRuntime({ fetchImpl = fetch }: { readonly fetchImpl?: typeof fetch }) {
  const router = useRouter();
  const [result, setResult] = useState<ApiResult<ManagementContext> | null>(null);
  const [section, setSection] = useState<ManagementSection>("overview");
  const [staffResult, setStaffResult] = useState<ApiResult<readonly StaffAccessRecord[]> | null>(null);
  const [policyResult, setPolicyResult] = useState<ApiResult<OperationalPolicyView> | null>(null);
  const [policySaving, setPolicySaving] = useState(false);
  const [topologyResult, setTopologyResult] = useState<ApiResult<readonly ManagementLocation[]> | null>(null);
  const [staffSavingActorId, setStaffSavingActorId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
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
    void fetchStaffAccess(fetchImpl).then((next) => {
      if (!cancelled) setStaffResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [allowedSection, context, fetchImpl]);

  useEffect(() => {
    if (
      !context ||
      !["staff_access", "locations", "registers", "devices"].includes(allowedSection)
    ) {
      return;
    }
    let cancelled = false;
    void fetchManagementTopology(fetchImpl).then((next) => {
      if (!cancelled) setTopologyResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [allowedSection, context, fetchImpl]);

  useEffect(() => {
    if (!context || allowedSection !== "policies") return;
    let cancelled = false;
    void fetchOperationalPolicy(policyScope, fetchImpl).then((next) => {
      if (!cancelled) setPolicyResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [allowedSection, context, fetchImpl, policyScope]);

  async function saveStaffAssignment(input: {
    readonly actorId: string;
    readonly locationId: string;
    readonly role: "cashier" | "manager";
    readonly registerIds: readonly string[];
  }) {
    setStaffSavingActorId(input.actorId);
    try {
      const saved = await updateStaffAssignment(input, fetchImpl);
      if (!saved.ok) {
        setStaffResult(saved as ApiResult<readonly StaffAccessRecord[]>);
        return;
      }
      const [staff, topology] = await Promise.all([
        fetchStaffAccess(fetchImpl),
        fetchManagementTopology(fetchImpl),
      ]);
      setStaffResult(staff);
      setTopologyResult(topology);
    } finally {
      setStaffSavingActorId(null);
    }
  }

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
      onSelectSection={(next) => {
        if (next === "staff_access") setStaffResult(null);
        if (["staff_access", "locations", "registers", "devices"].includes(next)) {
          setTopologyResult(null);
        }
        if (next === "policies") setPolicyResult(null);
        setSection(next);
      }}
      onBackToPos={() => router.push("/sell")}
      staffRows={staffResult?.ok ? staffResult.data : []}
      staffLoading={allowedSection === "staff_access" && staffResult === null}
      staffError={
        allowedSection === "staff_access" && staffResult && !staffResult.ok
          ? staffResult.error.message
          : undefined
      }
      topologyRows={topologyResult?.ok ? topologyResult.data : []}
      topologyLoading={
        ["staff_access", "locations", "registers", "devices"].includes(allowedSection) &&
        topologyResult === null
      }
      topologyError={
        ["staff_access", "locations", "registers", "devices"].includes(allowedSection) &&
        topologyResult &&
        !topologyResult.ok
          ? topologyResult.error.message
          : undefined
      }
      staffSavingActorId={staffSavingActorId}
      onSaveStaffAssignment={
        context.controlRole === "owner" || context.controlRole === "admin"
          ? (input) => {
              void saveStaffAssignment(input);
            }
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

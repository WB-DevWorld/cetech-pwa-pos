"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiResult } from "../../../../docs/contracts/ports";
import type { ManagementContext, ManagementSection } from "../server/admin/management-context";
import type { StaffAccessRecord } from "../server/admin/staff-access-directory";
import type { OperationalPolicyView } from "../server/admin/handle-operational-policy";
import type { ManagementLocation } from "../server/admin/management-topology-directory";
import type { ManagementShiftCashView } from "../server/admin/management-shift-cash-directory";
import type { ManagementReturnsAttentionView } from "../server/admin/management-returns-attention-directory";
import type { ManagementReceiptSettingsView } from "../server/admin/handle-management-receipt-settings";
import type { ManagementSystemHealthView } from "../server/admin/management-system-health";
import type { ManagementAuditView } from "../server/admin/management-audit";
import type { ReceiptSettings } from "../../../../docs/contracts/domain.generated";
import type { ShiftClosePolicyOverride } from "../server/auth/policy";
import { ManagementScreen } from "../features/admin/ManagementScreen";
import {
  fetchManagementAudit,
  fetchManagementContext,
  fetchManagementReceiptSettings,
  fetchManagementReturnsAttention,
  fetchManagementShiftsCash,
  fetchManagementSystemHealth,
  fetchManagementTopology,
  fetchOperationalPolicy,
  fetchStaffAccess,
  inviteStaff,
  updateControlMembership,
  updateManagementReceiptSettings,
  updateOperationalPolicy,
  updateStaffAccessStatus,
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
  const [shiftCashResult, setShiftCashResult] = useState<ApiResult<ManagementShiftCashView> | null>(null);
  const [shiftCashRefresh, setShiftCashRefresh] = useState(0);
  const [returnsAttentionResult, setReturnsAttentionResult] = useState<ApiResult<ManagementReturnsAttentionView> | null>(null);
  const [returnsAttentionRefresh, setReturnsAttentionRefresh] = useState(0);
  const [receiptSettingsResult, setReceiptSettingsResult] = useState<ApiResult<ManagementReceiptSettingsView> | null>(null);
  const [systemHealthResult, setSystemHealthResult] = useState<ApiResult<ManagementSystemHealthView> | null>(null);
  const [auditResult, setAuditResult] = useState<ApiResult<ManagementAuditView> | null>(null);
  const [receiptLocationId, setReceiptLocationId] = useState<string | null>(null);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [receiptSaveError, setReceiptSaveError] = useState<string | null>(null);
  const [receiptSaveMessage, setReceiptSaveMessage] = useState<string | null>(null);
  const [staffSavingActorId, setStaffSavingActorId] = useState<string | null>(null);
  const [staffMutationError, setStaffMutationError] = useState<string | null>(null);
  const [invitingStaff, setInvitingStaff] = useState(false);

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
      !["staff_access", "locations", "registers", "devices", "receipt_settings"].includes(allowedSection)
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
    if (!context || allowedSection !== "shifts_cash") return;
    let cancelled = false;
    void fetchManagementShiftsCash(fetchImpl).then((next) => {
      if (!cancelled) setShiftCashResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [allowedSection, context, fetchImpl, shiftCashRefresh]);

  useEffect(() => {
    if (!context || allowedSection !== "system_health") return;
    let cancelled = false;
    void fetchManagementSystemHealth(fetchImpl).then((next) => {
      if (!cancelled) setSystemHealthResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [allowedSection, context, fetchImpl]);

  useEffect(() => {
    if (!context || allowedSection !== "audit") return;
    let cancelled = false;
    void fetchManagementAudit(fetchImpl).then((next) => {
      if (!cancelled) setAuditResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [allowedSection, context, fetchImpl]);

  useEffect(() => {
    if (!context || allowedSection !== "returns_approvals") return;
    let cancelled = false;
    void fetchManagementReturnsAttention(fetchImpl).then((next) => {
      if (!cancelled) setReturnsAttentionResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [allowedSection, context, fetchImpl, returnsAttentionRefresh]);

  const receiptLocations = useMemo(() => {
    if (!context || !topologyResult?.ok) return [];
    const rows = topologyResult.data.map((row) => ({ id: row.id, name: row.name }));
    if (context.controlRole === "owner" || context.controlRole === "admin") return rows;
    return rows.filter((row) => context.managerLocationIds.includes(row.id));
  }, [context, topologyResult]);
  const selectedReceiptLocationId = receiptLocations.some((row) => row.id === receiptLocationId)
    ? receiptLocationId
    : receiptLocations[0]?.id ?? null;

  useEffect(() => {
    if (!context || allowedSection !== "receipt_settings" || !selectedReceiptLocationId) return;
    let cancelled = false;
    void fetchManagementReceiptSettings(selectedReceiptLocationId, fetchImpl).then((next) => {
      if (!cancelled) setReceiptSettingsResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [allowedSection, context, fetchImpl, selectedReceiptLocationId]);

  useEffect(() => {
    if (!context || (allowedSection !== "policies" && allowedSection !== "shifts_cash")) return;
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
    setStaffMutationError(null);
    try {
      const saved = await updateStaffAssignment(input, fetchImpl);
      if (!saved.ok) {
        setStaffMutationError(saved.error.message);
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

  async function sendStaffInvite(input: {
    readonly email: string;
    readonly displayName: string;
  }) {
    setInvitingStaff(true);
    setStaffMutationError(null);
    try {
      const invited = await inviteStaff(input, fetchImpl);
      if (!invited.ok) {
        setStaffMutationError(invited.error.message);
        return;
      }
      const staff = await fetchStaffAccess(fetchImpl);
      setStaffResult(staff);
    } finally {
      setInvitingStaff(false);
    }
  }

  async function saveStaffAccessStatus(input: {
    readonly actorId: string;
    readonly status: "active" | "disabled";
    readonly reason?: string;
  }) {
    setStaffSavingActorId(input.actorId);
    setStaffMutationError(null);
    try {
      const saved = await updateStaffAccessStatus(input, fetchImpl);
      if (!saved.ok) {
        setStaffMutationError(saved.error.message);
        return;
      }
      const staff = await fetchStaffAccess(fetchImpl);
      setStaffResult(staff);
    } finally {
      setStaffSavingActorId(null);
    }
  }

  async function saveControlMembership(input: {
    readonly actorId: string;
    readonly controlRole: "owner" | "admin" | "support";
    readonly status: "active" | "disabled";
  }) {
    setStaffSavingActorId(input.actorId);
    setStaffMutationError(null);
    try {
      const saved = await updateControlMembership(input, fetchImpl);
      if (!saved.ok) {
        setStaffMutationError(saved.error.message);
        return;
      }
      const [staff, contextNext] = await Promise.all([
        fetchStaffAccess(fetchImpl),
        fetchManagementContext(fetchImpl),
      ]);
      setStaffResult(staff);
      setResult(contextNext);
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

  async function saveReceiptSettings(settings: ReceiptSettings) {
    if (!selectedReceiptLocationId) return;
    setReceiptSaving(true);
    setReceiptSaveError(null);
    setReceiptSaveMessage(null);
    try {
      const saved = await updateManagementReceiptSettings({
        locationId: selectedReceiptLocationId,
        settings,
      }, fetchImpl);
      if (!saved.ok) {
        setReceiptSaveError(saved.error.message);
        return;
      }
      setReceiptSettingsResult(saved);
      setReceiptSaveMessage("Receipt settings saved.");
    } finally {
      setReceiptSaving(false);
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
        if (["staff_access", "locations", "registers", "devices", "receipt_settings"].includes(next)) {
          setTopologyResult(null);
        }
        if (next === "policies" || next === "shifts_cash") setPolicyResult(null);
        if (next === "shifts_cash") setShiftCashResult(null);
        if (next === "returns_approvals") setReturnsAttentionResult(null);
        if (next === "system_health") setSystemHealthResult(null);
        if (next === "audit") setAuditResult(null);
        if (next === "receipt_settings") {
          setReceiptSettingsResult(null);
          setReceiptSaveError(null);
          setReceiptSaveMessage(null);
        }
        setSection(next);
      }}
      onBackToPos={() => router.push("/sell")}
      staffRows={staffResult?.ok ? staffResult.data : []}
      staffLoading={allowedSection === "staff_access" && staffResult === null}
      staffError={
        staffMutationError ??
        (allowedSection === "staff_access" && staffResult && !staffResult.ok
          ? staffResult.error.message
          : undefined)
      }
      topologyRows={topologyResult?.ok ? topologyResult.data : []}
      topologyLoading={
        ["staff_access", "locations", "registers", "devices", "receipt_settings"].includes(allowedSection) &&
        topologyResult === null
      }
      topologyError={
        ["staff_access", "locations", "registers", "devices", "receipt_settings"].includes(allowedSection) &&
        topologyResult &&
        !topologyResult.ok
          ? topologyResult.error.message
          : undefined
      }
      staffSavingActorId={staffSavingActorId}
      onSaveStaffAssignment={
        result.data.controlRole === "owner" ||
        result.data.controlRole === "admin" ||
        result.data.managerLocationIds.length > 0
          ? (input) => {
              void saveStaffAssignment(input);
            }
          : undefined
      }
      onSaveControlMembership={
        result.data.controlRole === "owner" || result.data.controlRole === "admin"
          ? (input) => {
              void saveControlMembership(input);
            }
          : undefined
      }
      onSaveAccessStatus={
        result.data.controlRole === "owner" || result.data.controlRole === "admin"
          ? (input) => {
              void saveStaffAccessStatus(input);
            }
          : undefined
      }
      invitingStaff={invitingStaff}
      onInviteStaff={
        result.data.controlRole === "owner" || result.data.controlRole === "admin"
          ? (input) => {
              void sendStaffInvite(input);
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
      shiftCashView={shiftCashResult?.ok ? shiftCashResult.data : null}
      shiftCashLoading={allowedSection === "shifts_cash" && shiftCashResult === null}
      shiftCashError={
        allowedSection === "shifts_cash" && shiftCashResult && !shiftCashResult.ok
          ? shiftCashResult.error.message
          : undefined
      }
      shiftCashCorrelationId={
        allowedSection === "shifts_cash" && shiftCashResult && !shiftCashResult.ok
          ? shiftCashResult.correlationId
          : undefined
      }
      shiftCashPolicyLoading={allowedSection === "shifts_cash" && policyResult === null}
      returnsAttentionView={returnsAttentionResult?.ok ? returnsAttentionResult.data : null}
      returnsAttentionLoading={allowedSection === "returns_approvals" && returnsAttentionResult === null}
      returnsAttentionError={
        allowedSection === "returns_approvals" && returnsAttentionResult && !returnsAttentionResult.ok
          ? returnsAttentionResult.error.message
          : undefined
      }
      returnsAttentionCorrelationId={
        allowedSection === "returns_approvals" && returnsAttentionResult && !returnsAttentionResult.ok
          ? returnsAttentionResult.correlationId
          : undefined
      }
      onReturnsChanged={() => {
        setReturnsAttentionRefresh((value) => value + 1);
      }}
      onShiftsChanged={() => {
        setShiftCashRefresh((value) => value + 1);
      }}
      receiptLocations={receiptLocations}
      receiptLocationId={selectedReceiptLocationId ?? undefined}
      onSelectReceiptLocation={(locationId) => {
        setReceiptLocationId(locationId);
        setReceiptSettingsResult(null);
        setReceiptSaveError(null);
        setReceiptSaveMessage(null);
      }}
      receiptSettingsView={receiptSettingsResult?.ok ? receiptSettingsResult.data : null}
      receiptSettingsLoading={
        allowedSection === "receipt_settings" && (
          topologyResult === null ||
          (selectedReceiptLocationId !== null && receiptSettingsResult === null)
        )
      }
      receiptSettingsSaving={receiptSaving}
      receiptSettingsError={
        allowedSection === "receipt_settings" && topologyResult && !topologyResult.ok
          ? topologyResult.error.message
          : allowedSection === "receipt_settings" && receiptSettingsResult && !receiptSettingsResult.ok
            ? receiptSettingsResult.error.message
            : undefined
      }
      receiptSettingsSaveError={receiptSaveError ?? undefined}
      receiptSettingsSaveMessage={receiptSaveMessage ?? undefined}
      systemHealthView={systemHealthResult?.ok ? systemHealthResult.data : null}
      systemHealthLoading={allowedSection === "system_health" && systemHealthResult === null}
      systemHealthError={
        allowedSection === "system_health" && systemHealthResult && !systemHealthResult.ok
          ? systemHealthResult.error.message
          : undefined
      }
      systemHealthCorrelationId={
        allowedSection === "system_health" && systemHealthResult && !systemHealthResult.ok
          ? systemHealthResult.correlationId
          : undefined
      }
      auditView={auditResult?.ok ? auditResult.data : null}
      auditLoading={allowedSection === "audit" && auditResult === null}
      auditError={
        allowedSection === "audit" && auditResult && !auditResult.ok
          ? auditResult.error.message
          : undefined
      }
      auditCorrelationId={
        allowedSection === "audit" && auditResult && !auditResult.ok
          ? auditResult.correlationId
          : undefined
      }
      onSaveReceiptSettings={
        receiptSettingsResult?.ok && receiptSettingsResult.data.canManage
          ? (settings) => {
              void saveReceiptSettings(settings);
            }
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

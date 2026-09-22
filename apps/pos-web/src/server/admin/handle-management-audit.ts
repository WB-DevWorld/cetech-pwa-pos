import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { authFailure } from "../auth/errors";
import type { StaffSessionStore } from "../auth/session-store";
import {
  MANAGEMENT_AUDIT_RESULT_LIMIT,
  selectAdminAuditRecords,
  type AdminAuditDirectory,
} from "./admin-audit-directory";
import type { ControlPlaneDirectory } from "./control-plane-directory";
import { loadManagementAuthority } from "./management-authority";
import {
  presentManagementAuditRecord,
  type ManagementAuditScope,
  type ManagementAuditView,
} from "./management-audit";

export type { ManagementAuditView };

export async function handleGetManagementAudit(input: {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessions: StaffSessionStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly controlPlane: ControlPlaneDirectory;
  readonly audit: AdminAuditDirectory;
}): Promise<ApiResult<ManagementAuditView>> {
  const authority = await loadManagementAuthority(input);
  if (!authority.ok) return authority;
  if (!authority.data.sections.includes("audit")) {
    return authFailure("FORBIDDEN", "audit is outside management authority", input.correlationId);
  }

  const organizationWide =
    authority.data.controlRole === "owner" ||
    authority.data.controlRole === "admin" ||
    authority.data.controlRole === "support";
  const locationIds = organizationWide ? undefined : authority.data.managerLocationIds;
  const scope: ManagementAuditScope = organizationWide
    ? { kind: "organization" }
    : { kind: "locations", locationIds };

  if (locationIds && locationIds.length === 0) {
    return {
      ok: true,
      data: { scope, limit: MANAGEMENT_AUDIT_RESULT_LIMIT, truncated: false, rows: [] },
      correlationId: input.correlationId,
    };
  }

  let listed;
  try {
    listed = await input.audit.listOrganization({
      organizationId: authority.data.organizationId,
      locationIds,
    });
  } catch {
    listed = "unavailable" as const;
  }
  if (listed === "unavailable") {
    return authFailure("INTEGRATION_UNAVAILABLE", "management audit is unavailable", input.correlationId);
  }

  const selected = selectAdminAuditRecords({
    rows: listed.rows,
    organizationId: authority.data.organizationId,
    locationIds,
  });
  return {
    ok: true,
    data: {
      scope,
      limit: MANAGEMENT_AUDIT_RESULT_LIMIT,
      truncated: listed.truncated || selected.truncated,
      rows: selected.rows.map(presentManagementAuditRecord),
    },
    correlationId: input.correlationId,
  };
}

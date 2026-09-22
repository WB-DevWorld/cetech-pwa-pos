import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { authFailure } from "../auth/errors";
import type { StaffSessionStore } from "../auth/session-store";
import type { ControlPlaneDirectory } from "./control-plane-directory";
import { loadManagementAuthority } from "./management-authority";
import {
  MANAGEMENT_SHIFT_CASH_RESULT_LIMIT,
  selectManagementShiftCashRows,
  type ManagementShiftCashDirectory,
  type ManagementShiftCashScope,
  type ManagementShiftCashView,
} from "./management-shift-cash-directory";

const LOCATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export type { ManagementShiftCashView };

export async function handleGetManagementShiftsCash(input: {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessions: StaffSessionStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly controlPlane: ControlPlaneDirectory;
  readonly shifts: ManagementShiftCashDirectory;
  readonly locationId?: string;
}): Promise<ApiResult<ManagementShiftCashView>> {
  const authority = await loadManagementAuthority(input);
  if (!authority.ok) return authority;
  if (!authority.data.sections.includes("shifts_cash")) {
    return authFailure(
      "FORBIDDEN",
      "shift and cash oversight is outside management authority",
      input.correlationId,
    );
  }

  const locationId = input.locationId?.trim() || undefined;
  if (locationId && !LOCATION_ID.test(locationId)) {
    return authFailure("VALIDATION_ERROR", "location filter is invalid", input.correlationId);
  }

  const organizationWide =
    authority.data.controlRole === "owner" || authority.data.controlRole === "admin";
  if (
    locationId &&
    !organizationWide &&
    !authority.data.managerLocationIds.includes(locationId)
  ) {
    return authFailure(
      "FORBIDDEN",
      "location is outside shift and cash management authority",
      input.correlationId,
    );
  }

  const locationIds = organizationWide
    ? locationId
      ? [locationId]
      : undefined
    : locationId
      ? [locationId]
      : authority.data.managerLocationIds;
  const scope: ManagementShiftCashScope = organizationWide && !locationId
    ? { kind: "organization" }
    : { kind: "locations", locationIds: locationIds ?? [] };

  if (locationIds && locationIds.length === 0) {
    return {
      ok: true,
      data: {
        scope,
        limit: MANAGEMENT_SHIFT_CASH_RESULT_LIMIT,
        truncated: false,
        rows: [],
      },
      correlationId: input.correlationId,
    };
  }

  let listed;
  try {
    listed = await input.shifts.listOrganization({
      organizationId: authority.data.organizationId,
      locationIds,
    });
  } catch {
    return authFailure(
      "INTEGRATION_UNAVAILABLE",
      "shift and cash oversight is unavailable",
      input.correlationId,
    );
  }
  if (listed === "unavailable") {
    return authFailure(
      "INTEGRATION_UNAVAILABLE",
      "shift and cash oversight is unavailable",
      input.correlationId,
    );
  }

  const selected = selectManagementShiftCashRows({
    rows: listed.rows,
    organizationId: authority.data.organizationId,
    locationIds,
  });
  return {
    ok: true,
      data: {
      scope,
      limit: MANAGEMENT_SHIFT_CASH_RESULT_LIMIT,
      truncated: listed.truncated || selected.truncated,
      rows: selected.rows,
    },
    correlationId: input.correlationId,
  };
}

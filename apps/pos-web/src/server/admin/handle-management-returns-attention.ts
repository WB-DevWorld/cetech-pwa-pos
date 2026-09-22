import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { authFailure } from "../auth/errors";
import type { StaffSessionStore } from "../auth/session-store";
import type { ControlPlaneDirectory } from "./control-plane-directory";
import { loadManagementAuthority } from "./management-authority";
import {
  MANAGEMENT_RETURNS_ATTENTION_RESULT_LIMIT,
  selectManagementReturnsAttention,
  type ManagementReturnsAttentionDirectory,
  type ManagementReturnsAttentionScope,
  type ManagementReturnsAttentionView,
} from "./management-returns-attention-directory";

const LOCATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export type { ManagementReturnsAttentionView };

export async function handleGetManagementReturnsAttention(input: {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessions: StaffSessionStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly controlPlane: ControlPlaneDirectory;
  readonly returnsAttention: ManagementReturnsAttentionDirectory;
  readonly locationId?: string;
}): Promise<ApiResult<ManagementReturnsAttentionView>> {
  const authority = await loadManagementAuthority(input);
  if (!authority.ok) return authority;
  if (!authority.data.sections.includes("returns_approvals")) {
    return authFailure(
      "FORBIDDEN",
      "returns and approvals are outside management authority",
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
      "location is outside returns and approvals authority",
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
  const scope: ManagementReturnsAttentionScope = organizationWide && !locationId
    ? { kind: "organization" }
    : { kind: "locations", locationIds: locationIds ?? [] };

  if (locationIds && locationIds.length === 0) {
    return {
      ok: true,
      data: {
        scope,
        limit: MANAGEMENT_RETURNS_ATTENTION_RESULT_LIMIT,
        truncated: false,
        rows: [],
      },
      correlationId: input.correlationId,
    };
  }

  let listed;
  try {
    listed = await input.returnsAttention.listOrganization({
      organizationId: authority.data.organizationId,
      locationIds,
    });
  } catch {
    return authFailure(
      "INTEGRATION_UNAVAILABLE",
      "returns and approvals are unavailable",
      input.correlationId,
    );
  }
  if (listed === "unavailable") {
    return authFailure(
      "INTEGRATION_UNAVAILABLE",
      "returns and approvals are unavailable",
      input.correlationId,
    );
  }

  const selected = selectManagementReturnsAttention({
    rows: listed.rows,
    organizationId: authority.data.organizationId,
    locationIds,
  });
  return {
    ok: true,
    data: {
      scope,
      limit: MANAGEMENT_RETURNS_ATTENTION_RESULT_LIMIT,
      truncated: listed.truncated || selected.truncated,
      rows: selected.rows,
    },
    correlationId: input.correlationId,
  };
}

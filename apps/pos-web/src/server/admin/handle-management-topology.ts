import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import type { StaffSessionStore } from "../auth/session-store";
import type { ControlPlaneDirectory } from "./control-plane-directory";
import { loadManagementAuthority } from "./management-authority";
import type {
  ManagementLocation,
  ManagementTopologyDirectory,
} from "./management-topology-directory";
import { authFailure } from "../auth/errors";

export async function handleGetManagementTopology(input: {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessions: StaffSessionStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly controlPlane: ControlPlaneDirectory;
  readonly topology: ManagementTopologyDirectory;
}): Promise<ApiResult<readonly ManagementLocation[]>> {
  const authority = await loadManagementAuthority(input);
  if (!authority.ok) return authority;

  const mayRead =
    authority.data.controlRole === "owner" ||
    authority.data.controlRole === "admin" ||
    authority.data.managerLocationIds.length > 0;
  if (!mayRead) {
    return authFailure("FORBIDDEN", "location/register topology is outside management authority", input.correlationId);
  }

  const rows = await input.topology.listOrganization({
    organizationId: authority.data.organizationId,
  });
  if (rows === "unavailable") {
    return authFailure("INTEGRATION_UNAVAILABLE", "management topology is unavailable", input.correlationId);
  }

  const visible =
    authority.data.controlRole === "owner" || authority.data.controlRole === "admin"
      ? rows
      : rows.filter((row) => authority.data.managerLocationIds.includes(row.id));

  return {
    ok: true,
    data: visible,
    correlationId: input.correlationId,
  };
}

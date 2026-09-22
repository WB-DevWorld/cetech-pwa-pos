import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { ReturnApprovalBinding, Uuid } from "../../../../../docs/contracts/domain.generated";
import type { ReturnStore } from "../../core/returns/types";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { assertMutationProtection, type MutationProtectionInput } from "../auth/csrf";
import { authFailure } from "../auth/errors";
import { isUuid } from "../auth/ids";
import type { StaffSessionStore } from "../auth/session-store";
import { apiFailure } from "../http/api-failure";
import type { ControlPlaneDirectory } from "./control-plane-directory";
import { loadManagementAuthority } from "./management-authority";
import type { ReturnApprovalAdminStore } from "./return-approval-admin-store";

const APPROVAL_TTL_MS = 15 * 60 * 1000;

export async function handleManagementReturnApproval(input: {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessions: StaffSessionStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly controlPlane: ControlPlaneDirectory;
  readonly returns: ReturnStore;
  readonly approvals: ReturnApprovalAdminStore;
  readonly returnId: string;
  readonly protection: MutationProtectionInput;
}): Promise<ApiResult<ReturnApprovalBinding>> {
  const protection = assertMutationProtection(input.protection);
  if (!protection.ok) {
    return authFailure(
      "FORBIDDEN",
      protection.reason === "csrf"
        ? "mutation requires matching CSRF cookie and header"
        : "mutation origin is not allowed",
      input.correlationId,
    );
  }

  const authority = await loadManagementAuthority(input);
  if (!authority.ok) return authority;
  if (!authority.data.sections.includes("returns_approvals")) {
    return authFailure(
      "FORBIDDEN",
      "returns and approvals are outside management authority",
      input.correlationId,
    );
  }
  if (!isUuid(input.returnId)) {
    return authFailure("VALIDATION_ERROR", "return id is invalid", input.correlationId);
  }

  let stored;
  try {
    stored = await input.returns.getReturn(input.returnId);
  } catch {
    return authFailure(
      "INTEGRATION_UNAVAILABLE",
      "return approval store is unavailable",
      input.correlationId,
    );
  }
  if (!stored || stored.organizationId !== authority.data.organizationId) {
    return apiFailure("NOT_FOUND", "return was not found", input.correlationId);
  }
  if (!authority.data.managerLocationIds.includes(stored.locationId)) {
    return authFailure(
      "FORBIDDEN",
      "operational manager authority is required at the return location",
      input.correlationId,
    );
  }
  if (!stored.approvalRequired || stored.status !== "approval_required") {
    return authFailure(
      "VALIDATION_ERROR",
      "return is not awaiting manager approval",
      input.correlationId,
    );
  }

  const previewExpiry = Date.parse(stored.previewExpiresAt);
  if (!Number.isFinite(previewExpiry) || previewExpiry <= input.now.getTime()) {
    return authFailure("VALIDATION_ERROR", "return preview has expired", input.correlationId);
  }
  const expiresAt = new Date(
    Math.min(previewExpiry, input.now.getTime() + APPROVAL_TTL_MS),
  ).toISOString();

  const saved = await input.approvals.bind({
    organizationId: authority.data.organizationId,
    returnId: stored.returnId,
    fingerprint: stored.fingerprint,
    locationId: stored.locationId,
    actorId: authority.data.actorId,
    correlationId: input.correlationId,
    approvalId: crypto.randomUUID(),
    expiresAt,
    now: input.now,
  });
  if (saved === "unavailable") {
    return authFailure(
      "INTEGRATION_UNAVAILABLE",
      "return approval could not be committed",
      input.correlationId,
    );
  }

  return {
    ok: true,
    data: saved,
    correlationId: input.correlationId,
  };
}

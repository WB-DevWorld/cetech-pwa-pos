import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { RefundState, Uuid } from "../../../../../docs/contracts/domain.generated";
import type { StaffActor } from "../../core/checkout/types";
import type { CheckoutStore } from "../../core/checkout/types";
import type { ReturnStore } from "../../core/returns/types";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { assertMutationProtection, type MutationProtectionInput } from "../auth/csrf";
import { authFailure } from "../auth/errors";
import { isUuid } from "../auth/ids";
import type { StaffSessionStore } from "../auth/session-store";
import { apiFailure } from "../http/api-failure";
import { resolveTenderRefund } from "../payments/refund";
import type { ElectronicRefundProvider } from "../payments/refund-provider";
import type { ControlPlaneDirectory } from "./control-plane-directory";
import { loadManagementAuthority } from "./management-authority";

/**
 * Management entry for checking an existing tender refund.
 * Reuses resolveTenderRefund. It does not create a refund.
 * Organization control roles do not grant this without operational manager assignment.
 */
export async function handleManagementRefundReconciliation(input: {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessions: StaffSessionStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly controlPlane: ControlPlaneDirectory;
  readonly checkoutStore: CheckoutStore;
  readonly returns: ReturnStore;
  readonly provider: ElectronicRefundProvider;
  readonly refundId: string;
  readonly protection: MutationProtectionInput;
}): Promise<ApiResult<RefundState>> {
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
  if (!isUuid(input.refundId)) {
    return authFailure("VALIDATION_ERROR", "refund id is invalid", input.correlationId);
  }
  const refund = await input.returns.getTenderRefund(input.refundId);
  if (!refund || refund.organizationId !== authority.data.organizationId) {
    return apiFailure("NOT_FOUND", "refund was not found", input.correlationId);
  }
  if (!authority.data.managerLocationIds.includes(refund.locationId)) {
    return authFailure(
      "FORBIDDEN",
      "operational manager authority is required at the refund location",
      input.correlationId,
    );
  }
  const actor: StaffActor = {
    actorId: authority.data.actorId,
    displayName: authority.data.displayName,
    organizationId: authority.data.organizationId,
    locationIds: authority.data.managerLocationIds,
  };
  return resolveTenderRefund({
    checkoutStore: input.checkoutStore,
    returnStore: input.returns,
    provider: input.provider,
    actor,
    refundId: input.refundId,
    correlationId: input.correlationId,
    now: input.now,
  });
}

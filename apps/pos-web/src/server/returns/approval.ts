import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { ReturnApprovalBinding, Uuid } from "../../../../../docs/contracts/domain.generated";
import { toIsoTimestamp } from "../auth/ids";
import { apiFailure } from "../http/api-failure";
import type { StaffActor } from "../../core/checkout/types";
import type { ReturnStore } from "../../core/returns/types";

export async function bindReturnApproval(input: {
  readonly returnStore: ReturnStore;
  readonly actor: StaffActor;
  readonly returnId: Uuid;
  readonly correlationId: Uuid;
  readonly now: Date;
  readonly ttlMs?: number;
}): Promise<ApiResult<ReturnApprovalBinding>> {
  const stored = await input.returnStore.getReturn(input.returnId);
  if (!stored) {
    return apiFailure("NOT_FOUND", "return was not found", input.correlationId);
  }
  if (stored.organizationId !== input.actor.organizationId || !input.actor.locationIds.includes(stored.locationId)) {
    return apiFailure("FORBIDDEN", "return is outside staff scope", input.correlationId);
  }
  const binding: ReturnApprovalBinding = {
    approvalId: crypto.randomUUID(),
    returnId: stored.returnId,
    fingerprint: stored.fingerprint,
    actorId: input.actor.actorId,
    expiresAt: toIsoTimestamp(new Date(input.now.getTime() + (input.ttlMs ?? 15 * 60 * 1000))),
  };
  await input.returnStore.bindApproval({
    ...binding,
    organizationId: stored.organizationId,
    locationId: stored.locationId,
  });
  return { ok: true, data: binding, correlationId: input.correlationId };
}

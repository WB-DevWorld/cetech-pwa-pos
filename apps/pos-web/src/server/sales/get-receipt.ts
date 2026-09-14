import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { CommandContext, ReceiptSnapshot, Uuid } from "../../../../../docs/contracts/domain.generated";
import { apiFailure } from "../http/api-failure";
import type { CheckoutStore, StaffActor } from "../../core/checkout/types";
import { validateCanonicalDef } from "../quotes/canonical-schema";

export async function getReceiptByTransaction(input: {
  readonly store: CheckoutStore;
  readonly actor: StaffActor;
  readonly transactionId: Uuid;
  readonly context: Pick<CommandContext, "correlationId">;
}): Promise<ApiResult<ReceiptSnapshot>> {
  const { store, actor, transactionId, context } = input;
  const sale = await store.getSale(transactionId);
  const receipt = await store.getReceipt(transactionId);
  if (!sale || !receipt) {
    return apiFailure("NOT_FOUND", "receipt was not found", context.correlationId);
  }
  if (sale.organizationId !== actor.organizationId || !actor.locationIds.includes(sale.locationId)) {
    return apiFailure("FORBIDDEN", "receipt is out of staff scope", context.correlationId);
  }
  if (sale.status !== "completed" || !sale.receipt) {
    return apiFailure("NOT_FOUND", "receipt is not available until POS completion", context.correlationId);
  }
  if (!validateCanonicalDef("ReceiptSnapshot", receipt)) {
    return apiFailure("INTEGRATION_UNAVAILABLE", "stored receipt is invalid", context.correlationId);
  }
  return { ok: true, data: receipt, correlationId: context.correlationId };
}

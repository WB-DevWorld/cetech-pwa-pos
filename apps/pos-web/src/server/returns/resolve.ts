import type { ApiResult, BridgeReturnEffectsPort } from "../../../../../docs/contracts/ports";
import type { ReturnResolution, Uuid } from "../../../../../docs/contracts/domain.generated";
import { toIsoTimestamp } from "../auth/ids";
import { apiFailure } from "../http/api-failure";
import type { CheckoutStore, StaffActor } from "../../core/checkout/types";
import { monotonicIndependent } from "../../core/returns/aggregate";
import type { ReturnStore } from "../../core/returns/types";
import { resolveTenderRefund } from "../payments/refund";
import type { ElectronicRefundProvider } from "../payments/refund-provider";
import { resolutionFromRecord } from "./resolution";

export async function resolveReturn(input: {
  readonly checkoutStore: CheckoutStore;
  readonly returnStore: ReturnStore;
  readonly provider: ElectronicRefundProvider;
  readonly bridge: BridgeReturnEffectsPort;
  readonly actor: StaffActor;
  readonly returnId: Uuid;
  readonly correlationId: Uuid;
  readonly now: Date;
}): Promise<ApiResult<ReturnResolution>> {
  const stored = await input.returnStore.getReturn(input.returnId);
  if (!stored) {
    return apiFailure("NOT_FOUND", "return was not found", input.correlationId);
  }
  if (stored.organizationId !== input.actor.organizationId || !input.actor.locationIds.includes(stored.locationId)) {
    return apiFailure("FORBIDDEN", "return is outside staff scope", input.correlationId);
  }

  const money = stored.cashRefund ?? stored.providerRefund;
  if (money && money.status !== "verified") {
    await resolveTenderRefund({
      checkoutStore: input.checkoutStore,
      returnStore: input.returnStore,
      provider: input.provider,
      actor: input.actor,
      refundId: money.refundId,
      correlationId: input.correlationId,
      now: input.now,
    });
  }

  if (stored.commercialRefund && stored.commercialRefund.status !== "completed" && stored.commercialRefund.status !== "not_required") {
    const resolved = await input.bridge.resolveCommercialRefund(stored.commercialRefund.commercialRefundId);
    if (resolved.ok) {
      await input.returnStore.saveCommercialRefund({
        ...stored.commercialRefund,
        status: monotonicIndependent(stored.commercialRefund.status, resolved.data.status),
        message: resolved.data.message,
      });
    }
  }

  if (stored.stockDisposition && stored.stockDisposition.status !== "completed" && stored.stockDisposition.status !== "not_required") {
    const resolved = await input.bridge.resolveStockDisposition(stored.stockDisposition.stockDispositionId);
    if (resolved.ok) {
      await input.returnStore.saveStockDisposition({
        ...stored.stockDisposition,
        status: monotonicIndependent(stored.stockDisposition.status, resolved.data.status),
        message: resolved.data.message,
      });
    }
  }

  const latest = await input.returnStore.getReturn(input.returnId);
  if (!latest) {
    return apiFailure("NOT_FOUND", "return was not found", input.correlationId);
  }
  const resolution = resolutionFromRecord(latest);
  latest.status = resolution.status;
  await input.returnStore.saveReturn(latest);
  await input.returnStore.appendAudit({
    id: crypto.randomUUID(),
    returnId: latest.returnId,
    organizationId: latest.organizationId,
    eventType: "return.resolved",
    payload: { status: resolution.status },
    createdAt: toIsoTimestamp(input.now),
  });
  return { ok: true, data: resolution, correlationId: input.correlationId };
}

import type { ApiResult, SalesPort } from "../../../../../docs/contracts/ports";
import type { SaleResolution, Uuid } from "../../../../../docs/contracts/domain.generated";
import { apiFailure } from "../http/api-failure";
import type { CheckoutStore, PosSaleRecord, StaffActor } from "../../core/checkout/types";
import { isSaleResolution } from "./schema";

export async function resolveSale(input: {
  readonly store: CheckoutStore;
  readonly salesPort: Pick<SalesPort, "resolve">;
  readonly actor: StaffActor;
  readonly transactionId: Uuid;
  readonly correlationId: Uuid;
}): Promise<ApiResult<SaleResolution>> {
  const local = await input.store.getSale(input.transactionId);
  if (local) {
    if (local.organizationId !== input.actor.organizationId) {
      return apiFailure("FORBIDDEN", "sale organization is out of staff scope", input.correlationId);
    }
    if (!input.actor.locationIds.includes(local.locationId)) {
      return apiFailure("FORBIDDEN", "sale location is out of staff scope", input.correlationId);
    }
    return { ok: true, data: resolutionFromRecord(local), correlationId: input.correlationId };
  }

  const remote = await input.salesPort.resolve(input.transactionId);
  if (!remote.ok) {
    return remote;
  }
  if (!isSaleResolution(remote.data)) {
    return apiFailure("INTEGRATION_UNAVAILABLE", "bridge returned an invalid SaleResolution", input.correlationId);
  }
  return remote;
}

export function resolutionFromRecord(sale: PosSaleRecord): SaleResolution {
  const paymentId = sale.assignedPaymentId;
  if (sale.status === "completed" && sale.receipt) {
    return {
      transactionId: sale.prepared.transactionId,
      status: "completed",
      saleId: sale.prepared.saleId,
      orderReference: sale.prepared.orderReference,
      receiptId: sale.receipt.id,
      paymentId,
    };
  }
  if (sale.status === "cancelled") {
    return {
      transactionId: sale.prepared.transactionId,
      status: "cancelled",
      saleId: sale.prepared.saleId,
      orderReference: sale.prepared.orderReference,
      paymentId,
    };
  }
  if (sale.status === "requires_attention") {
    return {
      transactionId: sale.prepared.transactionId,
      status: "requires_attention",
      saleId: sale.prepared.saleId,
      orderReference: sale.prepared.orderReference,
      paymentId,
      message: "This transaction needs manager review. Do not start another sale.",
    };
  }
  if (sale.commercialConfirmed || sale.status === "finalizing") {
    return {
      transactionId: sale.prepared.transactionId,
      status: "finalizing",
      saleId: sale.prepared.saleId,
      orderReference: sale.prepared.orderReference,
      paymentId,
    };
  }
  if (paymentId) {
    return {
      transactionId: sale.prepared.transactionId,
      status: "payment_pending",
      saleId: sale.prepared.saleId,
      orderReference: sale.prepared.orderReference,
      paymentId,
    };
  }
  return {
    transactionId: sale.prepared.transactionId,
    status: "prepared",
    saleId: sale.prepared.saleId,
    orderReference: sale.prepared.orderReference,
  };
}

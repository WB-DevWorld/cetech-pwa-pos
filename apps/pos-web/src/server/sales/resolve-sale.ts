import type { ApiResult, SalesPort } from "../../../../../docs/contracts/ports";
import type { SaleResolution, Uuid } from "../../../../../docs/contracts/domain.generated";
import { apiFailure } from "../http/api-failure";
import type { CheckoutStore, PosSaleRecord, StaffActor } from "../../core/checkout/types";
import { isSaleResolution } from "./schema";
import { assertActorCanAccessSale, assertBindingMatchesActor } from "./transaction-scope";

export async function resolveSale(input: {
  readonly store: CheckoutStore;
  readonly salesPort: Pick<SalesPort, "resolve">;
  readonly actor: StaffActor;
  readonly transactionId: Uuid;
  readonly correlationId: Uuid;
}): Promise<ApiResult<SaleResolution>> {
  const local = await input.store.getSale(input.transactionId);
  if (local) {
    const access = assertActorCanAccessSale({
      sale: local,
      actor: input.actor,
      correlationId: input.correlationId,
    });
    if (!access.ok) {
      return access;
    }
    return { ok: true, data: resolutionFromRecord(local), correlationId: input.correlationId };
  }

  const binding = await input.store.lookupCommandScope({
    transactionId: input.transactionId,
    operation: "sale.prepare",
  });
  if (!binding) {
    return apiFailure("NOT_FOUND", "sale was not found", input.correlationId);
  }
  const allowed = assertBindingMatchesActor({
    binding,
    actor: input.actor,
    correlationId: input.correlationId,
  });
  if (!allowed.ok) {
    return allowed;
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

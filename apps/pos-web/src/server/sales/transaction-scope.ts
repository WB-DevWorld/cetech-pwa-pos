import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { PrepareSaleRequest, Uuid } from "../../../../../docs/contracts/domain.generated";
import { apiFailure } from "../http/api-failure";
import type { CommandScopeBinding, PosSaleRecord, StaffActor } from "../../core/checkout/types";

export function assertActorCanAccessSale(input: {
  readonly sale: PosSaleRecord;
  readonly actor: StaffActor;
  readonly correlationId: Uuid;
}): ApiResult<PosSaleRecord> {
  if (input.sale.organizationId !== input.actor.organizationId) {
    return apiFailure("FORBIDDEN", "sale organization is out of staff scope", input.correlationId);
  }
  if (!input.actor.locationIds.includes(input.sale.locationId)) {
    return apiFailure("FORBIDDEN", "sale location is out of staff scope", input.correlationId);
  }
  return { ok: true, data: input.sale, correlationId: input.correlationId };
}

export function assertSaleMatchesPrepareRequest(input: {
  readonly sale: PosSaleRecord;
  readonly actor: StaffActor;
  readonly request: PrepareSaleRequest;
  readonly correlationId: Uuid;
}): ApiResult<PosSaleRecord> {
  const access = assertActorCanAccessSale(input);
  if (!access.ok) {
    return access;
  }
  if (input.sale.prepared.transactionId !== input.request.transactionId) {
    return apiFailure("FORBIDDEN", "transaction is not bound to this prepare request", input.correlationId);
  }
  if (input.sale.registerId !== input.request.registerId) {
    return apiFailure("FORBIDDEN", "sale register is out of this prepare request scope", input.correlationId);
  }
  if (input.sale.shiftId !== input.request.shiftId) {
    return apiFailure("FORBIDDEN", "sale shift is out of this prepare request scope", input.correlationId);
  }
  if (input.sale.deviceId !== input.request.deviceId) {
    return apiFailure("FORBIDDEN", "sale device is out of this prepare request scope", input.correlationId);
  }
  return access;
}

export function assertBindingMatchesActor(input: {
  readonly binding: CommandScopeBinding;
  readonly actor: StaffActor;
  readonly correlationId: Uuid;
}): ApiResult<CommandScopeBinding> {
  if (input.binding.organizationId !== input.actor.organizationId) {
    return apiFailure("FORBIDDEN", "sale organization is out of staff scope", input.correlationId);
  }
  if (!input.actor.locationIds.includes(input.binding.locationId)) {
    return apiFailure("FORBIDDEN", "sale location is out of staff scope", input.correlationId);
  }
  return { ok: true, data: input.binding, correlationId: input.correlationId };
}

export function assertBindingMatchesPrepareRequest(input: {
  readonly binding: CommandScopeBinding;
  readonly actor: StaffActor;
  readonly request: PrepareSaleRequest;
  readonly correlationId: Uuid;
}): ApiResult<CommandScopeBinding> {
  const access = assertBindingMatchesActor(input);
  if (!access.ok) {
    return access;
  }
  if (input.binding.transactionId !== input.request.transactionId) {
    return apiFailure("FORBIDDEN", "transaction is not bound to this prepare request", input.correlationId);
  }
  if (!input.binding.registerId || input.binding.registerId !== input.request.registerId) {
    return apiFailure("FORBIDDEN", "sale register is out of this prepare request scope", input.correlationId);
  }
  if (!input.binding.shiftId || input.binding.shiftId !== input.request.shiftId) {
    return apiFailure("FORBIDDEN", "sale shift is out of this prepare request scope", input.correlationId);
  }
  return access;
}

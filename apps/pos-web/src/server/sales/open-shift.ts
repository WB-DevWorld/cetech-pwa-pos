import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { CashMovement, CommandContext, OpenShiftRequest, Shift } from "../../../../../docs/contracts/domain.generated";
import { canonicalJson, sha256Hex } from "../../local/canonical";
import { toIsoTimestamp } from "../auth/ids";
import { apiFailure } from "../http/api-failure";
import type { CheckoutStore, StaffActor, StoredShift } from "../../core/checkout/types";
import { validateCanonicalDef } from "../quotes/canonical-schema";

export async function openShift(input: {
  readonly store: CheckoutStore;
  readonly actor: StaffActor;
  readonly request: OpenShiftRequest;
  readonly context: CommandContext;
  readonly now: Date;
}): Promise<ApiResult<Shift>> {
  const { store, actor, request, context, now } = input;
  return store.withLock(`shift:${request.registerId}`, async () => {
    const hash = await sha256Hex(canonicalJson(request));
    const claim = await store.claimIdempotency(actor.organizationId, "shift.open", context.idempotencyKey, hash);
    if (claim.kind === "conflict") {
      return apiFailure(
        "IDEMPOTENCY_CONFLICT",
        "Idempotency-Key was reused with a different open-shift request",
        context.correlationId,
      );
    }
    if (claim.kind === "in_progress") {
      return apiFailure("OPERATION_IN_PROGRESS", "open shift is already in progress for this key", context.correlationId);
    }
    if (claim.kind === "replay" || claim.kind === "repair") {
      return replayShift(claim.outcome, context.correlationId);
    }

    const register = await store.getRegister(request.registerId);
    if (!register || register.status !== "active") {
      return apiFailure("NOT_FOUND", "register is not available", context.correlationId);
    }
    if (register.organizationId !== actor.organizationId) {
      return apiFailure("FORBIDDEN", "register is out of staff organization scope", context.correlationId);
    }
    if (!actor.locationIds.includes(register.locationId)) {
      return apiFailure("FORBIDDEN", "register location is out of staff scope", context.correlationId);
    }
    if (request.openingFloat.currency !== register.currency) {
      return apiFailure("VALIDATION_ERROR", "opening float currency must match register", context.correlationId);
    }
    const device = await store.getDevice(request.deviceId);
    if (
      !device ||
      device.status !== "active" ||
      device.organizationId !== register.organizationId ||
      device.locationId !== register.locationId
    ) {
      return apiFailure("VALIDATION_ERROR", "device is not at the register location", context.correlationId);
    }

    await store.markIdempotencySent(actor.organizationId, "shift.open", context.idempotencyKey);
    const openedAt = toIsoTimestamp(now);
    const shift: StoredShift = {
      id: crypto.randomUUID(),
      registerId: request.registerId,
      deviceId: request.deviceId,
      cashierId: actor.actorId,
      status: "open",
      openingFloat: request.openingFloat,
      expectedCash: request.openingFloat,
      openedAt,
      organizationId: register.organizationId,
      locationId: register.locationId,
    };
    const inserted = await store.insertOpenShift(shift);
    if (inserted === "conflict") {
      await store.releaseIdempotency(actor.organizationId, "shift.open", context.idempotencyKey);
      return apiFailure("SHIFT_CONFLICT", "register already has an active shift", context.correlationId);
    }
    if (request.openingFloat.minor > 0) {
      const movement: CashMovement = {
        id: crypto.randomUUID(),
        shiftId: shift.id,
        kind: "opening_float",
        signedAmount: { minor: request.openingFloat.minor, currency: request.openingFloat.currency },
        actorId: actor.actorId,
        createdAt: openedAt,
        reason: "opening float",
      };
      const appended = await store.appendCashMovement({ ...movement, organizationId: register.organizationId });
      if (appended !== "ok") {
        await store.releaseIdempotency(actor.organizationId, "shift.open", context.idempotencyKey);
        return apiFailure("SHIFT_CONFLICT", "opening float could not be journaled", context.correlationId);
      }
    }
    const publicShift = toPublicShift(shift);
    if (!validateCanonicalDef("Shift", publicShift)) {
      await store.releaseIdempotency(actor.organizationId, "shift.open", context.idempotencyKey);
      return apiFailure("INTEGRATION_UNAVAILABLE", "open shift produced an invalid Shift", context.correlationId);
    }
    await store.acknowledgeIdempotency(actor.organizationId, "shift.open", context.idempotencyKey, publicShift);
    return { ok: true, data: publicShift, correlationId: context.correlationId };
  });
}

function toPublicShift(shift: StoredShift): Shift {
  return {
    id: shift.id,
    registerId: shift.registerId,
    deviceId: shift.deviceId,
    cashierId: shift.cashierId,
    status: shift.status,
    openingFloat: shift.openingFloat,
    expectedCash: shift.expectedCash,
    openedAt: shift.openedAt,
  };
}

function replayShift(outcome: unknown, correlationId: CommandContext["correlationId"]): ApiResult<Shift> {
  if (!validateCanonicalDef("Shift", outcome)) {
    return apiFailure("INTEGRATION_UNAVAILABLE", "stored open-shift outcome is not a valid Shift", correlationId);
  }
  return { ok: true, data: outcome as Shift, correlationId };
}

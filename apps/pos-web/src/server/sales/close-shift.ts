import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { CloseShiftRequest, CommandContext, Shift } from "../../../../../docs/contracts/domain.generated";
import { canonicalJson, sha256Hex } from "../../local/canonical";
import { toIsoTimestamp } from "../auth/ids";
import { apiFailure } from "../http/api-failure";
import type { CheckoutStore, StaffActor } from "../../core/checkout/types";
import { validateCanonicalDef } from "../quotes/canonical-schema";
import { toPublicShift } from "./shift-public";

/**
 * Server-owned close. Counted cash is staff input. Expected cash and variance
 * are computed from durable shift state, never taken from the browser.
 */
export async function closeShift(input: {
  readonly store: CheckoutStore;
  readonly actor: StaffActor;
  readonly request: CloseShiftRequest;
  readonly context: CommandContext;
  readonly now: Date;
}): Promise<ApiResult<Shift>> {
  const { store, actor, request, context, now } = input;
  return store.withLock(`shift-close:${request.shiftId}`, async () => {
    const hash = await sha256Hex(canonicalJson(request));
    const existing = await store.getShift(request.shiftId);
    const claim = await store.claimIdempotency(
      actor.organizationId,
      "shift.close",
      context.idempotencyKey,
      hash,
      existing?.locationId ?? actor.locationIds[0],
      { registerId: existing?.registerId, shiftId: request.shiftId },
    );
    if (claim.kind === "conflict") {
      return apiFailure(
        "IDEMPOTENCY_CONFLICT",
        "Idempotency-Key was reused with a different CloseShiftRequest",
        context.correlationId,
      );
    }
    if (claim.kind === "in_progress") {
      return apiFailure("OPERATION_IN_PROGRESS", "close shift is already in progress for this key", context.correlationId);
    }
    if (claim.kind === "replay" || claim.kind === "repair") {
      if (!validateCanonicalDef("Shift", claim.outcome)) {
        return apiFailure("INTEGRATION_UNAVAILABLE", "stored close-shift outcome is not a valid Shift", context.correlationId);
      }
      return { ok: true, data: claim.outcome as Shift, correlationId: context.correlationId };
    }

    const shift = existing ?? (await store.getShift(request.shiftId));
    if (!shift) {
      await store.releaseIdempotency(actor.organizationId, "shift.close", context.idempotencyKey);
      return apiFailure("NOT_FOUND", "shift was not found", context.correlationId);
    }
    if (shift.organizationId !== actor.organizationId || !actor.locationIds.includes(shift.locationId)) {
      await store.releaseIdempotency(actor.organizationId, "shift.close", context.idempotencyKey);
      return apiFailure("FORBIDDEN", "shift is outside staff scope", context.correlationId);
    }
    if (shift.status === "closed") {
      const publicShift = toPublicShift(shift);
      await store.acknowledgeIdempotency(actor.organizationId, "shift.close", context.idempotencyKey, publicShift);
      return { ok: true, data: publicShift, correlationId: context.correlationId };
    }
    if (request.countedCash.currency !== shift.openingFloat.currency) {
      await store.releaseIdempotency(actor.organizationId, "shift.close", context.idempotencyKey);
      return apiFailure("VALIDATION_ERROR", "counted cash currency must match the register", context.correlationId);
    }

    const expected = (await store.expectedCash(shift.id)) ?? shift.expectedCash ?? shift.openingFloat;
    const varianceMinor = request.countedCash.minor - expected.minor;
    const nextStatus = varianceMinor === 0 || request.approvalId ? "closed" : "requires_attention";
    const closed = await store.closeShift({
      shiftId: shift.id,
      countedCash: request.countedCash,
      status: nextStatus,
      closedAt: nextStatus === "closed" ? toIsoTimestamp(now) : undefined,
    });
    if (closed !== "ok") {
      await store.releaseIdempotency(actor.organizationId, "shift.close", context.idempotencyKey);
      return apiFailure("SHIFT_CONFLICT", "shift could not be closed", context.correlationId);
    }
    const latest = await store.getShift(shift.id);
    if (!latest) {
      await store.releaseIdempotency(actor.organizationId, "shift.close", context.idempotencyKey);
      return apiFailure("NOT_FOUND", "shift was not found after close", context.correlationId);
    }
    const publicShift = toPublicShift(latest);
    if (!validateCanonicalDef("Shift", publicShift)) {
      await store.releaseIdempotency(actor.organizationId, "shift.close", context.idempotencyKey);
      return apiFailure("INTEGRATION_UNAVAILABLE", "close shift produced an invalid Shift", context.correlationId);
    }
    await store.acknowledgeIdempotency(actor.organizationId, "shift.close", context.idempotencyKey, publicShift);
    return { ok: true, data: publicShift, correlationId: context.correlationId };
  });
}

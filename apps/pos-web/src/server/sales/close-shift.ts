import type { ApiResult } from "../../../../../docs/contracts/ports";
import type {
  CloseShiftRequest,
  CommandContext,
  Shift,
  ShiftReport,
} from "../../../../../docs/contracts/domain.generated";
import { canonicalJson, sha256Hex } from "../../local/canonical";
import { toIsoTimestamp } from "../auth/ids";
import { apiFailure } from "../http/api-failure";
import type { CheckoutStore, StaffActor } from "../../core/checkout/types";
import { validateCanonicalDef } from "../quotes/canonical-schema";
import type { OperationalCloseStore } from "../register/operational-close-store";
import { toPublicShift } from "./shift-public";

export function durableZReportId(shiftId: string): string {
  return `Z:${shiftId}`;
}

/**
 * Server-owned close. Counted cash is staff input. Expected cash and variance
 * are computed from durable shift state, never taken from the browser.
 * Production uses the atomic OperationalCloseStore RPC. In-memory tests keep
 * the CheckoutStore path with the same R8 variance and exactly-once Z rules.
 */
export async function closeShift(input: {
  readonly store: CheckoutStore;
  readonly closeStore?: OperationalCloseStore;
  readonly actor: StaffActor;
  readonly request: CloseShiftRequest;
  readonly context: CommandContext;
  readonly now: Date;
}): Promise<ApiResult<Shift>> {
  if (input.closeStore) {
    return closeShiftAtomically(input);
  }
  return closeShiftViaCheckoutStore(input);
}

async function closeShiftAtomically(input: {
  readonly store: CheckoutStore;
  readonly closeStore?: OperationalCloseStore;
  readonly actor: StaffActor;
  readonly request: CloseShiftRequest;
  readonly context: CommandContext;
}): Promise<ApiResult<Shift>> {
  const { store, closeStore, actor, request, context } = input;
  if (!closeStore) {
    return apiFailure("INTEGRATION_UNAVAILABLE", "atomic close store is required", context.correlationId);
  }
  const shift = await store.getShift(request.shiftId);
  if (!shift) {
    return apiFailure("NOT_FOUND", "shift was not found", context.correlationId);
  }
  if (shift.organizationId !== actor.organizationId || !actor.locationIds.includes(shift.locationId)) {
    return apiFailure("FORBIDDEN", "shift is outside staff scope", context.correlationId);
  }
  if (
    shift.status !== "open" &&
    shift.status !== "closing" &&
    shift.status !== "closed" &&
    shift.status !== "requires_attention"
  ) {
    return apiFailure("SHIFT_CONFLICT", "shift is not closable", context.correlationId);
  }
  const expectedCurrency = shift.expectedCash?.currency ?? shift.openingFloat.currency;
  if (request.countedCash.currency !== expectedCurrency) {
    return apiFailure("VALIDATION_ERROR", "counted cash currency must match shift", context.correlationId);
  }
  if (!Number.isSafeInteger(request.countedCash.minor) || request.countedCash.minor < 0) {
    return apiFailure("VALIDATION_ERROR", "counted cash must be a nonnegative safe integer", context.correlationId);
  }

  const requestHash = await sha256Hex(canonicalJson(request));
  const result = await closeStore.close({
    organizationId: actor.organizationId,
    shiftId: request.shiftId,
    countedCash: request.countedCash,
    context,
    requestHash,
  });

  if (result.kind === "not_found") {
    return apiFailure("NOT_FOUND", "shift was not found during close", context.correlationId);
  }
  if (result.kind === "forbidden") {
    return apiFailure("FORBIDDEN", "shift close was denied", context.correlationId);
  }
  if (result.kind === "conflict") {
    return apiFailure(
      "IDEMPOTENCY_CONFLICT",
      "Idempotency-Key was reused with a different CloseShiftRequest",
      context.correlationId,
    );
  }
  if (result.kind === "unavailable") {
    return apiFailure(
      "INTEGRATION_UNAVAILABLE",
      "shift close outcome is unavailable; resolve before retrying with a new key",
      context.correlationId,
    );
  }

  if (!validateCanonicalDef("Shift", result.shift)) {
    return apiFailure("INTEGRATION_UNAVAILABLE", "shift close produced an invalid Shift", context.correlationId);
  }
  if (result.kind === "closed") {
    if (
      !result.report ||
      !validateCanonicalDef("ShiftReport", result.report) ||
      result.shift.status !== "closed" ||
      result.report.kind !== "Z" ||
      result.shift.zReportId !== result.report.id ||
      result.report.shiftId !== result.shift.id ||
      !result.shift.closedAt
    ) {
      return apiFailure("INTEGRATION_UNAVAILABLE", "closed shift and durable Z report do not agree", context.correlationId);
    }
  } else if (
    result.shift.status !== "requires_attention" ||
    result.shift.closedAt !== undefined ||
    result.shift.zReportId !== undefined ||
    result.report !== undefined
  ) {
    return apiFailure(
      "INTEGRATION_UNAVAILABLE",
      "requires_attention close must not mint a Z report or closedAt",
      context.correlationId,
    );
  }

  return { ok: true, data: result.shift, correlationId: context.correlationId };
}

async function closeShiftViaCheckoutStore(input: {
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
    // R8: optional approvalId is schema-reserved and non-authoritative. There is
    // no durable shift-variance approval subsystem, so an invented UUID cannot close.
    const nextStatus = varianceMinor === 0 ? "closed" : "requires_attention";
    const zReportId = nextStatus === "closed" ? durableZReportId(shift.id) : undefined;
    const closedAt = nextStatus === "closed" ? toIsoTimestamp(now) : undefined;
    const closed = await store.closeShift({
      shiftId: shift.id,
      countedCash: request.countedCash,
      status: nextStatus,
      closedAt,
      zReportId,
    });
    if (closed !== "ok") {
      await store.releaseIdempotency(actor.organizationId, "shift.close", context.idempotencyKey);
      return apiFailure("SHIFT_CONFLICT", "shift could not be closed", context.correlationId);
    }
    if (nextStatus === "closed" && zReportId && closedAt) {
      const report: ShiftReport = {
        id: zReportId,
        shiftId: shift.id,
        kind: "Z",
        expectedCash: expected,
        countedCash: request.countedCash,
        variance: { minor: 0, currency: expected.currency },
        createdAt: closedAt,
      };
      const saved = await store.saveShiftReport(report);
      if (saved === "duplicate") {
        await store.releaseIdempotency(actor.organizationId, "shift.close", context.idempotencyKey);
        return apiFailure("SHIFT_CONFLICT", "shift already has a different durable Z report", context.correlationId);
      }
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

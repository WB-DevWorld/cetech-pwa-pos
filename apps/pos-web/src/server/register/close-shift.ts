import type { ApiResult } from "../../../../../docs/contracts/ports";
import type {
  CloseShiftRequest,
  CommandContext,
  Shift,
  ShiftReport,
} from "../../../../../docs/contracts/domain.generated";
import type { CheckoutStore, StaffActor } from "../../core/checkout/types";
import { canonicalJson, sha256Hex } from "../../local/canonical";
import { apiFailure } from "../http/api-failure";
import { validateCanonicalDef } from "../quotes/canonical-schema";
import type { OperationalCloseStore } from "./operational-close-store";

export type CloseShiftOutcome = {
  readonly shift: Shift;
  readonly report: ShiftReport;
};

/**
 * Server-only blind close use case. The caller supplies counted cash; expected cash
 * is never accepted from the browser and is derived atomically by the database.
 */
export async function closeShift(input: {
  readonly store: CheckoutStore;
  readonly closeStore: OperationalCloseStore;
  readonly actor: StaffActor;
  readonly request: CloseShiftRequest;
  readonly context: CommandContext;
}): Promise<ApiResult<CloseShiftOutcome>> {
  const { store, closeStore, actor, request, context } = input;
  const shift = await store.getShift(request.shiftId);
  if (!shift) {
    return apiFailure("NOT_FOUND", "shift was not found", context.correlationId);
  }
  if (shift.organizationId !== actor.organizationId || !actor.locationIds.includes(shift.locationId)) {
    return apiFailure("FORBIDDEN", "shift is outside staff scope", context.correlationId);
  }
  if (shift.status !== "open" && shift.status !== "closing" && shift.status !== "closed") {
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
      "shift close conflicts with an existing close attempt",
      context.correlationId,
    );
  }
  if (result.kind === "unavailable") {
    return apiFailure(
      "INTEGRATION_UNAVAILABLE",
      "shift close outcome is unavailable; resolve before retrying with a new key",
      context.correlationId,
      true,
      "resolve",
    );
  }

  if (!validateCanonicalDef("Shift", result.shift) || !validateCanonicalDef("ShiftReport", result.report)) {
    return apiFailure(
      "INTEGRATION_UNAVAILABLE",
      "shift close produced an invalid canonical result",
      context.correlationId,
    );
  }
  if (
    result.shift.status !== "closed" ||
    result.report.kind !== "Z" ||
    result.shift.zReportId !== result.report.id ||
    result.report.shiftId !== result.shift.id
  ) {
    return apiFailure(
      "REQUIRES_ATTENTION",
      "closed shift and Z report do not agree",
      context.correlationId,
      false,
      "contact_manager",
    );
  }

  return {
    ok: true,
    data: { shift: result.shift, report: result.report },
    correlationId: context.correlationId,
  };
}

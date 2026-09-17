import type { Register, Shift } from "../../../../../docs/contracts/domain.generated";
import type { StoredRegister, StoredShift } from "../../core/checkout/types";

export function toPublicShift(shift: StoredShift): Shift {
  return {
    id: shift.id,
    registerId: shift.registerId,
    deviceId: shift.deviceId,
    cashierId: shift.cashierId,
    status: shift.status,
    openingFloat: shift.openingFloat,
    openedAt: shift.openedAt,
    ...(shift.expectedCash ? { expectedCash: shift.expectedCash } : {}),
    ...(shift.countedCash ? { countedCash: shift.countedCash } : {}),
    ...(shift.variance ? { variance: shift.variance } : {}),
    ...(shift.closedAt ? { closedAt: shift.closedAt } : {}),
    ...(shift.zReportId ? { zReportId: shift.zReportId } : {}),
  };
}

export function toPublicRegister(register: StoredRegister): Register {
  return {
    id: register.id,
    name: register.name,
    locationId: register.locationId,
    currency: register.currency,
    status: register.status,
  };
}

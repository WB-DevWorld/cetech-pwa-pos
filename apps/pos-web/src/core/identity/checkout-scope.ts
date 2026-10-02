import type { CashCheckoutScope } from "../../features/sell/runtime/cashCheckoutController";
import type { StaffRuntimeAuthority } from "./staff-runtime";

/**
 * Checkout identity comes only from the selected authoritative register and
 * open server-owned shift. Browser-local device ids are never checkout authority.
 */
export function checkoutScopeFromStaffAuthority(
  authority: StaffRuntimeAuthority,
): CashCheckoutScope | undefined {
  if (authority.presentationOnly) {
    return undefined;
  }
  const registerId = authority.register?.id ?? authority.selectedRegisterId;
  const shift = authority.shift;
  if (!registerId || !authority.shiftOpen || !shift?.id || !shift.deviceId) {
    return undefined;
  }
  if (shift.registerId !== registerId) {
    return undefined;
  }
  if (authority.register && authority.register.id !== registerId) {
    return undefined;
  }
  return {
    registerId,
    shiftId: shift.id,
    deviceId: shift.deviceId,
  };
}

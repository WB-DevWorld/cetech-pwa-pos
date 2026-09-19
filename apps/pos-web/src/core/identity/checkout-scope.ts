import type { CashCheckoutScope } from "../../features/sell/runtime/cashCheckoutController";
import type { StaffRuntimeAuthority } from "./staff-runtime";

/**
 * Checkout identity comes from the selected authoritative register/shift.
 * No selected register, closed shift, or a shift belonging to another register
 * means fail-closed (no hardcoded LOCAL_CHECKOUT_SCOPE).
 */
export function checkoutScopeFromStaffAuthority(
  authority: StaffRuntimeAuthority,
  fallbackDeviceId: string,
): CashCheckoutScope | undefined {
  const registerId = authority.register?.id ?? authority.selectedRegisterId;
  const shift = authority.shift;
  if (!registerId || !authority.shiftOpen || !shift?.id) {
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
    deviceId: shift.deviceId || fallbackDeviceId,
  };
}

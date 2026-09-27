/**
 * Cashier-facing staff notices. Classification happens before this module.
 * Login and register UI render these strings; they do not inspect provider text.
 *
 * Session envelopes distinguish cases with the existing ApiFailure details.field:
 * - "assignments" on INTEGRATION_UNAVAILABLE
 * - "pos_access" on FORBIDDEN
 * - "session" on AUTH_REQUIRED when an established session ended
 */

export type StaffPresentationNotice =
  | "invalid_credentials"
  | "credentials_required"
  | "access_disabled"
  | "session_expired"
  | "assignments_unavailable"
  | "provider_unavailable"
  | "offline_sign_in"
  | "register_forbidden"
  | "offline_grace_expired"
  | "remote_sign_out_unconfirmed";

export const STAFF_PRESENTATION_COPY: Record<StaffPresentationNotice, string> = {
  invalid_credentials: "Incorrect email or password.",
  credentials_required: "Enter your email and password.",
  access_disabled: "Your POS access is disabled. Contact a manager.",
  session_expired: "Your session ended. Sign in again.",
  assignments_unavailable: "Register assignments couldn't be checked. Try again.",
  provider_unavailable: "Sign-in is temporarily unavailable. Try again.",
  offline_sign_in: "Internet connection required to sign in.",
  register_forbidden: "That register isn't available to this account.",
  offline_grace_expired: "Offline access expired.",
  remote_sign_out_unconfirmed: "Signed out on this device.",
};

export function staffPresentationCopy(notice: StaffPresentationNotice): string {
  return STAFF_PRESENTATION_COPY[notice];
}

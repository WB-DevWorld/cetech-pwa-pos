export { AUTH_COOKIE_OPTIONS, STAFF_CSRF_COOKIE, STAFF_CSRF_HEADER, STAFF_SESSION_COOKIE } from "../../config/auth";
export {
  createMemoryAssignmentDirectory,
  roleAtLocation,
  type StaffAssignmentDirectory,
  type StaffAssignments,
} from "./assignments";
export {
  authorizeStaffAction,
  authorizeStaffMutation,
  authorizeStaffRead,
  type AuthorizeStaffActionInput,
  type AuthorizeStaffMutationInput,
  type AuthorizeStaffReadInput,
  type AuthorizedStaffContext,
} from "./authorize";
export { parseStaffIdentityClaims, toSession, type StaffIdentityClaims } from "./claims";
export {
  csrfClearCookie,
  csrfSetCookie,
  parseCookieHeader,
  sessionClearCookie,
  sessionSetCookie,
} from "./cookies";
export { assertMutationProtection } from "./csrf";
export { authFailure } from "./errors";
export {
  createStaffIdentityVerifier,
  type IdentityVerifyResult,
  type StaffIdentityVerifier,
  type TokenIntrospector,
} from "./identity-verifier";
export {
  assignmentRolePermits,
  isStaffAssignmentRole,
  isStaffPermission,
  STAFF_ASSIGNMENT_ROLES,
  STAFF_PERMISSIONS,
  type StaffAssignmentRole,
  type StaffPermission,
} from "./roles";
export { establishStaffSession, revokeStaffSession } from "./staff-session";
export {
  createSupabaseAuthIntrospector,
  credentialLooksLikeServiceRole,
  mapSupabaseUserToStaffClaims,
} from "./supabase-auth";
export {
  assertEphemeralSessionStoreAllowed,
  createEphemeralInMemoryStaffSessionStore,
  getEphemeralDevStaffSessionStore,
  type StaffSessionStore,
} from "./session-store";

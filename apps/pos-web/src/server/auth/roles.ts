/**
 * CORE-01 staff assignment roles. Do not invent a parallel role system.
 * Source: pos_staff_location_assignments.role CHECK (role IN ('cashier', 'manager')).
 */
export const STAFF_ASSIGNMENT_ROLES = ["cashier", "manager"] as const;
export type StaffAssignmentRole = (typeof STAFF_ASSIGNMENT_ROLES)[number];

/**
 * Server permission names. These are not Session.capabilities and are never
 * taken from the client or JWT capability lists.
 */
export const STAFF_PERMISSIONS = [
  "session.read",
  "health.read",
  "shift.open",
  "shift.close",
  "cash.movement",
  "cash.correction",
  "sale.prepare",
  "sale.finalize",
  "sale.cancel",
  "payment.cash",
  "payment.initialize",
  "payment.resolve",
  "refund.resolve",
] as const;
export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

const CASHIER_PERMISSIONS: ReadonlySet<StaffPermission> = new Set([
  "session.read",
  "health.read",
  "shift.open",
  "cash.movement",
  "sale.prepare",
  "sale.finalize",
  "sale.cancel",
  "payment.cash",
  "payment.initialize",
  "payment.resolve",
]);

/** Manager includes cashier operations plus close/correction/refund approval. */
const MANAGER_PERMISSIONS: ReadonlySet<StaffPermission> = new Set([
  ...CASHIER_PERMISSIONS,
  "shift.close",
  "cash.correction",
  "refund.resolve",
]);

export function isStaffAssignmentRole(value: unknown): value is StaffAssignmentRole {
  return value === "cashier" || value === "manager";
}

export function isStaffPermission(value: unknown): value is StaffPermission {
  return typeof value === "string" && (STAFF_PERMISSIONS as readonly string[]).includes(value);
}

export function assignmentRolePermits(role: StaffAssignmentRole, permission: StaffPermission): boolean {
  if (role === "manager") {
    return MANAGER_PERMISSIONS.has(permission);
  }
  return CASHIER_PERMISSIONS.has(permission);
}

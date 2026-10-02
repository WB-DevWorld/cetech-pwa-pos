import { isStaffAssignmentRole, type StaffAssignmentRole } from "./roles";

export type StaffLocationRole = {
  readonly locationId: string;
  readonly role: StaffAssignmentRole;
};

export type StaffRegisterAssignment = {
  readonly registerId: string;
  readonly locationId: string;
};

export type StaffAssignments = {
  readonly locationIds: readonly string[];
  readonly registerIds: readonly string[];
  /**
   * Optional register-to-location mapping for callers that must intersect
   * durable assignments with a narrower verified session location scope.
   */
  readonly registerAssignments?: readonly StaffRegisterAssignment[];
  /** Trusted per-location role from pos_staff_location_assignments. */
  readonly locationRoles: readonly StaffLocationRole[];
};

export interface StaffAssignmentDirectory {
  lookup(input: {
    readonly actorId: string;
    readonly organizationId: string;
  }): Promise<StaffAssignments | "unavailable">;
}

export function roleAtLocation(
  assignments: StaffAssignments,
  locationId: string,
): StaffAssignmentRole | null {
  const match = assignments.locationRoles.find((row) => row.locationId === locationId);
  return match?.role ?? null;
}

export function createMemoryAssignmentDirectory(
  rows: ReadonlyArray<{
    readonly actorId: string;
    readonly organizationId: string;
    readonly locationRoles: readonly StaffLocationRole[];
    readonly registerIds: readonly string[];
    readonly registerAssignments?: readonly StaffRegisterAssignment[];
  }>,
): StaffAssignmentDirectory {
  return {
    async lookup({ actorId, organizationId }) {
      const match = rows.find(
        (row) => row.actorId === actorId && row.organizationId === organizationId,
      );
      if (!match) {
        return { locationIds: [], registerIds: [], locationRoles: [] };
      }
      const locationRoles = match.locationRoles.filter((row) => isStaffAssignmentRole(row.role));
      return {
        locationIds: locationRoles.map((row) => row.locationId),
        registerIds: match.registerIds,
        ...(match.registerAssignments ? { registerAssignments: match.registerAssignments } : {}),
        locationRoles,
      };
    },
  };
}

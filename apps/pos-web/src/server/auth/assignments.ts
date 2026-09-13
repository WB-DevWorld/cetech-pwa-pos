import { isStaffAssignmentRole, type StaffAssignmentRole } from "./roles";

export type StaffLocationRole = {
  readonly locationId: string;
  readonly role: StaffAssignmentRole;
};

export type StaffAssignments = {
  readonly locationIds: readonly string[];
  readonly registerIds: readonly string[];
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
        locationRoles,
      };
    },
  };
}

export type StaffAssignments = {
  readonly locationIds: readonly string[];
  readonly registerIds: readonly string[];
};

export interface StaffAssignmentDirectory {
  lookup(input: {
    readonly actorId: string;
    readonly organizationId: string;
  }): Promise<StaffAssignments | "unavailable">;
}

export function createMemoryAssignmentDirectory(
  rows: ReadonlyArray<{
    readonly actorId: string;
    readonly organizationId: string;
    readonly locationIds: readonly string[];
    readonly registerIds: readonly string[];
  }>,
): StaffAssignmentDirectory {
  return {
    async lookup({ actorId, organizationId }) {
      const match = rows.find(
        (row) => row.actorId === actorId && row.organizationId === organizationId,
      );
      return match
        ? { locationIds: match.locationIds, registerIds: match.registerIds }
        : { locationIds: [], registerIds: [] };
    },
  };
}

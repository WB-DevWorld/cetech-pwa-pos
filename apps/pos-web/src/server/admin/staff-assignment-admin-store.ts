import type { StaffAssignmentRole } from "../auth/roles";
import type { PosRestFetch } from "../http/server-fetch";

export type StaffAssignmentMutationResult = {
  readonly actorId: string;
  readonly organizationId: string;
  readonly locationId: string;
  readonly role: StaffAssignmentRole;
  readonly registerIds: readonly string[];
};

export interface StaffAssignmentAdminStore {
  setAssignment(input: {
    readonly organizationId: string;
    readonly targetActorId: string;
    readonly locationId: string;
    readonly role: StaffAssignmentRole;
    readonly registerIds: readonly string[];
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<StaffAssignmentMutationResult | "unavailable">;
}

export function createMemoryStaffAssignmentAdminStore(): StaffAssignmentAdminStore & {
  readonly rows: StaffAssignmentMutationResult[];
} {
  const rows: StaffAssignmentMutationResult[] = [];
  return {
    rows,
    async setAssignment(input) {
      const next: StaffAssignmentMutationResult = {
        actorId: input.targetActorId,
        organizationId: input.organizationId,
        locationId: input.locationId,
        role: input.role,
        registerIds: [...new Set(input.registerIds)].sort(),
      };
      const index = rows.findIndex(
        (row) =>
          row.actorId === next.actorId &&
          row.organizationId === next.organizationId &&
          row.locationId === next.locationId,
      );
      if (index >= 0) rows[index] = next;
      else rows.push(next);
      return next;
    },
  };
}

export function createSupabaseStaffAssignmentAdminStore(input: {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
}): StaffAssignmentAdminStore {
  const root = `${input.url.replace(/\/+$/, "")}/rest/v1`;
  const timeoutMs = input.timeoutMs ?? 8_000;
  const headers = {
    apikey: input.serviceRoleKey,
    Authorization: `Bearer ${input.serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  return {
    async setAssignment(value) {
      try {
        const response = await input.fetchImpl(
          `${root}/rpc/pos_admin_set_staff_assignment`,
          {
            method: "POST",
            headers,
            signal: AbortSignal.timeout(timeoutMs),
            body: JSON.stringify({
              p_organization_id: value.organizationId,
              p_target_actor_id: value.targetActorId,
              p_location_id: value.locationId,
              p_role: value.role,
              p_register_ids: [...new Set(value.registerIds)],
              p_actor_id: value.actorId,
              p_correlation_id: value.correlationId,
            }),
          },
        );
        if (!response.ok) return "unavailable";
        const body = await response.json();
        const row =
          Array.isArray(body) && body.length === 1
            ? body[0]
            : body;
        return parseResult(row) ?? "unavailable";
      } catch {
        return "unavailable";
      }
    },
  };
}

function parseResult(value: unknown): StaffAssignmentMutationResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.actorId !== "string" ||
    typeof row.organizationId !== "string" ||
    typeof row.locationId !== "string" ||
    (row.role !== "cashier" && row.role !== "manager") ||
    !Array.isArray(row.registerIds) ||
    row.registerIds.some((id) => typeof id !== "string")
  ) {
    return null;
  }
  return {
    actorId: row.actorId,
    organizationId: row.organizationId,
    locationId: row.locationId,
    role: row.role,
    registerIds: row.registerIds as string[],
  };
}

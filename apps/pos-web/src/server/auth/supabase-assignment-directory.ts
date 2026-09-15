import { isStaffAssignmentRole } from "./roles";
import type { StaffAssignmentDirectory, StaffLocationRole } from "./assignments";
import type { PosRestFetch } from "../http/server-fetch";

export type SupabaseStaffAssignmentDirectoryOptions = {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Durable StaffAssignmentDirectory backed by POS assignment tables.
 * Browser-supplied roles/capabilities are never trusted. Buyer identity is
 * not staff identity. service_role is infrastructure access, not cashier auth.
 */
export function createSupabaseStaffAssignmentDirectory(
  options: SupabaseStaffAssignmentDirectoryOptions,
): StaffAssignmentDirectory {
  const root = `${options.url.replace(/\/+$/, "")}/rest/v1`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers = {
    apikey: options.serviceRoleKey,
    Authorization: `Bearer ${options.serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  return {
    async lookup({ actorId, organizationId }) {
      try {
        const [locationRows, registerRows] = await Promise.all([
          getRows(
            `${root}/pos_staff_location_assignments?actor_id=eq.${encodeURIComponent(actorId)}&organization_id=eq.${encodeURIComponent(organizationId)}&select=location_id,role,organization_id,actor_id`,
          ),
          getRows(
            `${root}/pos_staff_register_assignments?actor_id=eq.${encodeURIComponent(actorId)}&organization_id=eq.${encodeURIComponent(organizationId)}&select=register_id,location_id,organization_id,actor_id`,
          ),
        ]);
        if (locationRows === "unavailable" || registerRows === "unavailable") {
          return "unavailable";
        }
        const locationRoles: StaffLocationRole[] = [];
        const locationIds: string[] = [];
        for (const row of locationRows) {
          if (row.actor_id !== actorId || row.organization_id !== organizationId) {
            continue;
          }
          if (typeof row.location_id !== "string" || !isStaffAssignmentRole(row.role)) {
            continue;
          }
          locationRoles.push({ locationId: row.location_id, role: row.role });
          locationIds.push(row.location_id);
        }
        const allowedLocations = new Set(locationIds);
        const registerIds: string[] = [];
        for (const row of registerRows) {
          if (row.actor_id !== actorId || row.organization_id !== organizationId) {
            continue;
          }
          if (typeof row.register_id !== "string" || typeof row.location_id !== "string") {
            continue;
          }
          if (!allowedLocations.has(row.location_id)) {
            continue;
          }
          registerIds.push(row.register_id);
        }
        return { locationIds, registerIds, locationRoles };
      } catch {
        return "unavailable";
      }
    },
  };

  async function getRows(url: string): Promise<ReadonlyArray<Record<string, unknown>> | "unavailable"> {
    const response = await options.fetchImpl(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 401 || response.status === 403) {
      return "unavailable";
    }
    if (!response.ok) {
      return "unavailable";
    }
    const body = await response.json();
    if (!Array.isArray(body)) {
      return "unavailable";
    }
    return body.filter((row): row is Record<string, unknown> => row !== null && typeof row === "object");
  }
}

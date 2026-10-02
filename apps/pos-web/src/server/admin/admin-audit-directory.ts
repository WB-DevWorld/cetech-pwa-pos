import type { PosRestFetch } from "../http/server-fetch";

export const MANAGEMENT_AUDIT_RESULT_LIMIT = 50;

export type AdminAuditRecord = {
  readonly id: string;
  readonly organizationId: string;
  readonly actorId: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId?: string;
  readonly locationId?: string;
  readonly registerId?: string;
  readonly beforeState?: unknown;
  readonly afterState?: unknown;
  readonly correlationId?: string;
  readonly createdAt: string;
};

export type AdminAuditListing = {
  readonly rows: readonly AdminAuditRecord[];
  readonly truncated: boolean;
};

export interface AdminAuditDirectory {
  listOrganization(input: {
    readonly organizationId: string;
    readonly locationIds?: readonly string[];
  }): Promise<AdminAuditListing | "unavailable">;
}

export function selectAdminAuditRecords(input: {
  readonly rows: readonly AdminAuditRecord[];
  readonly organizationId: string;
  readonly locationIds?: readonly string[];
  readonly limit?: number;
}): AdminAuditListing {
  const limit = input.limit ?? MANAGEMENT_AUDIT_RESULT_LIMIT;
  const allowed = input.locationIds ? new Set(input.locationIds) : null;
  const rows = input.rows
    .filter((row) => {
      if (row.organizationId !== input.organizationId) return false;
      if (allowed && (!row.locationId || !allowed.has(row.locationId))) return false;
      return true;
    })
    .sort((left, right) => {
      const time = right.createdAt.localeCompare(left.createdAt);
      return time !== 0 ? time : right.id.localeCompare(left.id);
    });
  return { rows: rows.slice(0, limit), truncated: rows.length > limit };
}

export function createMemoryAdminAuditDirectory(
  rows: readonly AdminAuditRecord[] = [],
): AdminAuditDirectory {
  return {
    async listOrganization(input) {
      return selectAdminAuditRecords({
        rows,
        organizationId: input.organizationId,
        locationIds: input.locationIds,
      });
    },
  };
}

export function createSupabaseAdminAuditDirectory(input: {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
}): AdminAuditDirectory {
  const root = `${input.url.replace(/\/+$/, "")}/rest/v1`;
  const timeoutMs = input.timeoutMs ?? 8_000;
  const headers = {
    apikey: input.serviceRoleKey,
    Authorization: `Bearer ${input.serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  return {
    async listOrganization({ organizationId, locationIds }) {
      if (locationIds && locationIds.length === 0) return { rows: [], truncated: false };
      const locationFilter = locationIds?.length
        ? `&location_id=in.(${locationIds.map((id) => encodeURIComponent(id)).join(",")})`
        : "";
      const select = [
        "id","organization_id","actor_id","action","target_type","target_id",
        "location_id","register_id","before_state","after_state","correlation_id","created_at",
      ].join(",");
      const path =
        `pos_admin_audit_events?organization_id=eq.${encodeURIComponent(organizationId)}` +
        locationFilter +
        `&select=${select}&order=created_at.desc,id.desc&limit=${MANAGEMENT_AUDIT_RESULT_LIMIT + 1}`;
      try {
        const response = await input.fetchImpl(`${root}/${path}`, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) return "unavailable";
        const body = await response.json();
        if (!Array.isArray(body)) return "unavailable";
        const rows = body.flatMap(parseAuditRecord);
        return {
          rows: rows.slice(0, MANAGEMENT_AUDIT_RESULT_LIMIT),
          truncated: body.length > MANAGEMENT_AUDIT_RESULT_LIMIT,
        };
      } catch {
        return "unavailable";
      }
    },
  };
}

function parseAuditRecord(value: unknown): readonly AdminAuditRecord[] {
  if (!record(value)) return [];
  if (
    typeof value.id !== "string" ||
    typeof value.organization_id !== "string" ||
    typeof value.actor_id !== "string" ||
    typeof value.action !== "string" ||
    typeof value.target_type !== "string" ||
    typeof value.created_at !== "string"
  ) return [];
  return [{
    id: value.id,
    organizationId: value.organization_id,
    actorId: value.actor_id,
    action: value.action,
    targetType: value.target_type,
    ...(typeof value.target_id === "string" ? { targetId: value.target_id } : {}),
    ...(typeof value.location_id === "string" ? { locationId: value.location_id } : {}),
    ...(typeof value.register_id === "string" ? { registerId: value.register_id } : {}),
    ...(value.before_state !== null && value.before_state !== undefined ? { beforeState: value.before_state } : {}),
    ...(value.after_state !== null && value.after_state !== undefined ? { afterState: value.after_state } : {}),
    ...(typeof value.correlation_id === "string" ? { correlationId: value.correlation_id } : {}),
    createdAt: value.created_at,
  }];
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

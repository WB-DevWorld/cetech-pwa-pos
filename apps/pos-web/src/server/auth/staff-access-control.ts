import type { PosRestFetch } from "../http/server-fetch";

export type StaffAccessStatus = "active" | "disabled";

export interface StaffAccessControl {
  status(input: {
    readonly organizationId: string;
    readonly actorId: string;
  }): Promise<StaffAccessStatus | "unavailable">;
}

export function createMemoryStaffAccessControl(
  rows: Readonly<Record<string, StaffAccessStatus>> = {},
): StaffAccessControl {
  return {
    async status({ organizationId, actorId }) {
      return rows[`${organizationId}:${actorId}`] ?? "active";
    },
  };
}

export function createSupabaseStaffAccessControl(input: {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
}): StaffAccessControl {
  const root = `${input.url.replace(/\/+$/, "")}/rest/v1`;
  const timeoutMs = input.timeoutMs ?? 5_000;
  const headers = {
    apikey: input.serviceRoleKey,
    Authorization: `Bearer ${input.serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  return {
    async status({ organizationId, actorId }) {
      try {
        const response = await input.fetchImpl(
          `${root}/pos_staff_access_controls?organization_id=eq.${encodeURIComponent(
            organizationId,
          )}&actor_id=eq.${encodeURIComponent(actorId)}&select=status&limit=1`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(timeoutMs),
          },
        );
        if (response.status === 401 || response.status === 403 || !response.ok) {
          return "unavailable";
        }
        const body = await response.json();
        if (!Array.isArray(body)) return "unavailable";
        if (body.length === 0) return "active";
        const row = body[0] as Record<string, unknown>;
        return row.status === "disabled" ? "disabled" : row.status === "active" ? "active" : "unavailable";
      } catch {
        return "unavailable";
      }
    },
  };
}

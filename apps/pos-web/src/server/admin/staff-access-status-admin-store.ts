import type { PosRestFetch } from "../http/server-fetch";

export type StaffAccessStatusMutationResult = {
  readonly organizationId: string;
  readonly actorId: string;
  readonly status: "active" | "disabled";
  readonly reason?: string;
  readonly revokedSessionCount: number;
};

export interface StaffAccessStatusAdminStore {
  setStatus(input: {
    readonly organizationId: string;
    readonly targetActorId: string;
    readonly status: "active" | "disabled";
    readonly reason?: string;
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<StaffAccessStatusMutationResult | "unavailable">;
}

export function createMemoryStaffAccessStatusAdminStore(): StaffAccessStatusAdminStore & {
  readonly rows: StaffAccessStatusMutationResult[];
} {
  const rows: StaffAccessStatusMutationResult[] = [];
  return {
    rows,
    async setStatus(input) {
      const next: StaffAccessStatusMutationResult = {
        organizationId: input.organizationId,
        actorId: input.targetActorId,
        status: input.status,
        ...(input.reason ? { reason: input.reason } : {}),
        revokedSessionCount: input.status === "disabled" ? 1 : 0,
      };
      const index = rows.findIndex(
        (row) =>
          row.organizationId === next.organizationId &&
          row.actorId === next.actorId,
      );
      if (index >= 0) rows[index] = next;
      else rows.push(next);
      return next;
    },
  };
}

export function createSupabaseStaffAccessStatusAdminStore(input: {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
}): StaffAccessStatusAdminStore {
  const root = `${input.url.replace(/\/+$/, "")}/rest/v1`;
  const timeoutMs = input.timeoutMs ?? 8_000;
  const headers = {
    apikey: input.serviceRoleKey,
    Authorization: `Bearer ${input.serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  return {
    async setStatus(value) {
      try {
        const response = await input.fetchImpl(
          `${root}/rpc/pos_admin_set_staff_access_status`,
          {
            method: "POST",
            headers,
            signal: AbortSignal.timeout(timeoutMs),
            body: JSON.stringify({
              p_organization_id: value.organizationId,
              p_target_actor_id: value.targetActorId,
              p_status: value.status,
              p_reason: value.reason ?? null,
              p_actor_id: value.actorId,
              p_correlation_id: value.correlationId,
            }),
          },
        );
        if (!response.ok) return "unavailable";
        const body = await response.json();
        const row = Array.isArray(body) && body.length === 1 ? body[0] : body;
        return parseResult(row) ?? "unavailable";
      } catch {
        return "unavailable";
      }
    },
  };
}

function parseResult(value: unknown): StaffAccessStatusMutationResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.organizationId !== "string" ||
    typeof row.actorId !== "string" ||
    (row.status !== "active" && row.status !== "disabled") ||
    typeof row.revokedSessionCount !== "number"
  ) {
    return null;
  }
  return {
    organizationId: row.organizationId,
    actorId: row.actorId,
    status: row.status,
    ...(typeof row.reason === "string" ? { reason: row.reason } : {}),
    revokedSessionCount: row.revokedSessionCount,
  };
}

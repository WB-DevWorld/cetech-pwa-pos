import { isOrganizationControlRole, type OrganizationControlRole } from "../auth/policy";
import type { PosRestFetch } from "../http/server-fetch";

export type ControlMembershipMutationResult = {
  readonly organizationId: string;
  readonly actorId: string;
  readonly controlRole: OrganizationControlRole;
  readonly status: "active" | "disabled";
};

export interface ControlMembershipAdminStore {
  setMembership(input: {
    readonly organizationId: string;
    readonly targetActorId: string;
    readonly controlRole: OrganizationControlRole;
    readonly status: "active" | "disabled";
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<ControlMembershipMutationResult | "unavailable">;
}

export function createMemoryControlMembershipAdminStore(): ControlMembershipAdminStore & {
  readonly rows: ControlMembershipMutationResult[];
} {
  const rows: ControlMembershipMutationResult[] = [];
  return {
    rows,
    async setMembership(input) {
      const next: ControlMembershipMutationResult = {
        organizationId: input.organizationId,
        actorId: input.targetActorId,
        controlRole: input.controlRole,
        status: input.status,
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

export function createSupabaseControlMembershipAdminStore(input: {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
}): ControlMembershipAdminStore {
  const root = `${input.url.replace(/\/+$/, "")}/rest/v1`;
  const timeoutMs = input.timeoutMs ?? 8_000;
  const headers = {
    apikey: input.serviceRoleKey,
    Authorization: `Bearer ${input.serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  return {
    async setMembership(value) {
      try {
        const response = await input.fetchImpl(
          `${root}/rpc/pos_admin_set_control_membership`,
          {
            method: "POST",
            headers,
            signal: AbortSignal.timeout(timeoutMs),
            body: JSON.stringify({
              p_organization_id: value.organizationId,
              p_target_actor_id: value.targetActorId,
              p_control_role: value.controlRole,
              p_status: value.status,
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

function parseResult(value: unknown): ControlMembershipMutationResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.organizationId !== "string" ||
    typeof row.actorId !== "string" ||
    !isOrganizationControlRole(row.controlRole) ||
    (row.status !== "active" && row.status !== "disabled")
  ) {
    return null;
  }
  return {
    organizationId: row.organizationId,
    actorId: row.actorId,
    controlRole: row.controlRole,
    status: row.status,
  };
}

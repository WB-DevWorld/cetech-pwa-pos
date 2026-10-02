import { isOrganizationControlRole, type OrganizationControlRole } from "../auth/policy";
import type { PosRestFetch } from "../http/server-fetch";

export type OrganizationMembership = {
  readonly organizationId: string;
  readonly actorId: string;
  readonly controlRole: OrganizationControlRole;
  readonly status: "active" | "disabled";
};

export interface ControlPlaneDirectory {
  lookup(input: {
    readonly organizationId: string;
    readonly actorId: string;
  }): Promise<OrganizationMembership | null | "unavailable">;
}

export function createMemoryControlPlaneDirectory(
  rows: readonly OrganizationMembership[] = [],
): ControlPlaneDirectory {
  return {
    async lookup(input) {
      return (
        rows.find(
          (row) =>
            row.organizationId === input.organizationId &&
            row.actorId === input.actorId,
        ) ?? null
      );
    },
  };
}

export function createSupabaseControlPlaneDirectory(input: {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
}): ControlPlaneDirectory {
  const root = `${input.url.replace(/\/+$/, "")}/rest/v1`;
  const timeoutMs = input.timeoutMs ?? 5_000;
  const headers = {
    apikey: input.serviceRoleKey,
    Authorization: `Bearer ${input.serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  return {
    async lookup({ organizationId, actorId }) {
      try {
        const response = await input.fetchImpl(
          `${root}/pos_organization_memberships?organization_id=eq.${encodeURIComponent(
            organizationId,
          )}&actor_id=eq.${encodeURIComponent(
            actorId,
          )}&select=organization_id,actor_id,control_role,status&limit=1`,
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
        if (!Array.isArray(body) || body.length === 0) {
          return null;
        }
        const row = body[0] as Record<string, unknown>;
        if (
          row.organization_id !== organizationId ||
          row.actor_id !== actorId ||
          !isOrganizationControlRole(row.control_role) ||
          (row.status !== "active" && row.status !== "disabled")
        ) {
          return "unavailable";
        }
        return {
          organizationId,
          actorId,
          controlRole: row.control_role,
          status: row.status,
        };
      } catch {
        return "unavailable";
      }
    },
  };
}

import type { ReturnApprovalBinding, Uuid } from "../../../../../docs/contracts/domain.generated";
import type { ReturnStore } from "../../core/returns/types";
import type { PosRestFetch } from "../http/server-fetch";
import type { AdminAuditStore } from "./admin-audit-store";

export interface ReturnApprovalAdminStore {
  bind(input: {
    readonly organizationId: string;
    readonly returnId: Uuid;
    readonly fingerprint: string;
    readonly locationId: string;
    readonly actorId: string;
    readonly correlationId: Uuid;
    readonly approvalId: Uuid;
    readonly expiresAt: string;
    readonly now: Date;
  }): Promise<ReturnApprovalBinding | "unavailable">;
}

export function createMemoryReturnApprovalAdminStore(input: {
  readonly returns: ReturnStore;
  readonly audit: AdminAuditStore;
}): ReturnApprovalAdminStore {
  return {
    async bind(value) {
      return input.returns.withLock(`return-approval:${value.returnId}`, async () => {
        const existing = await input.returns.getApprovalForReturn(value.returnId, value.fingerprint);
        if (existing && Date.parse(existing.expiresAt) > value.now.getTime()) {
          return existing;
        }
        const binding: ReturnApprovalBinding = {
          approvalId: value.approvalId,
          returnId: value.returnId,
          fingerprint: value.fingerprint,
          actorId: value.actorId,
          expiresAt: value.expiresAt,
        };
        const audited = await input.audit.append({
          organizationId: value.organizationId,
          actorId: value.actorId,
          action: "return.approval.bound",
          targetType: "return_approval",
          targetId: value.returnId,
          locationId: value.locationId,
          afterState: {
            approvalId: value.approvalId,
            expiresAt: value.expiresAt,
          },
          correlationId: value.correlationId,
        });
        if (audited === "unavailable") return "unavailable";
        await input.returns.bindApproval({
          ...binding,
          organizationId: value.organizationId,
          locationId: value.locationId,
        });
        return binding;
      });
    },
  };
}

export function createSupabaseReturnApprovalAdminStore(input: {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
}): ReturnApprovalAdminStore {
  const root = `${input.url.replace(/\/+$/, "")}/rest/v1`;
  const timeoutMs = input.timeoutMs ?? 8_000;
  const headers = {
    apikey: input.serviceRoleKey,
    Authorization: `Bearer ${input.serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  return {
    async bind(value) {
      try {
        const response = await input.fetchImpl(`${root}/rpc/pos_admin_bind_return_approval`, {
          method: "POST",
          headers,
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            p_organization_id: value.organizationId,
            p_return_id: value.returnId,
            p_fingerprint: value.fingerprint,
            p_actor_id: value.actorId,
            p_correlation_id: value.correlationId,
            p_approval_id: value.approvalId,
            p_expires_at: value.expiresAt,
          }),
        });
        if (!response.ok) return "unavailable";
        const body = await response.json();
        const row = Array.isArray(body) && body.length === 1 ? body[0] : body;
        return parseBinding(row) ?? "unavailable";
      } catch {
        return "unavailable";
      }
    },
  };
}

function parseBinding(value: unknown): ReturnApprovalBinding | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.approvalId !== "string" ||
    typeof row.returnId !== "string" ||
    typeof row.fingerprint !== "string" ||
    typeof row.actorId !== "string" ||
    typeof row.expiresAt !== "string"
  ) return null;
  return {
    approvalId: row.approvalId,
    returnId: row.returnId,
    fingerprint: row.fingerprint,
    actorId: row.actorId,
    expiresAt: row.expiresAt,
  };
}

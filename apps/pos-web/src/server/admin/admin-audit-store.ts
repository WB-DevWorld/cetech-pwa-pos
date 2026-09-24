import type { PosRestFetch } from "../http/server-fetch";

export type AdminAuditEvent = {
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
};

export interface AdminAuditStore {
  append(event: AdminAuditEvent): Promise<"ok" | "unavailable">;
}

export function createMemoryAdminAuditStore(): AdminAuditStore & {
  readonly events: AdminAuditEvent[];
} {
  const events: AdminAuditEvent[] = [];
  return {
    events,
    async append(event) {
      events.push(event);
      return "ok";
    },
  };
}

export function createSupabaseAdminAuditStore(input: {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
}): AdminAuditStore {
  const root = `${input.url.replace(/\/+$/, "")}/rest/v1`;
  const timeoutMs = input.timeoutMs ?? 5_000;
  const headers = {
    apikey: input.serviceRoleKey,
    Authorization: `Bearer ${input.serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
  return {
    async append(event) {
      try {
        const response = await input.fetchImpl(`${root}/pos_admin_audit_events`, {
          method: "POST",
          headers,
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            organization_id: event.organizationId,
            actor_id: event.actorId,
            action: event.action,
            target_type: event.targetType,
            target_id: event.targetId ?? null,
            location_id: event.locationId ?? null,
            register_id: event.registerId ?? null,
            before_state: event.beforeState ?? null,
            after_state: event.afterState ?? null,
            correlation_id: event.correlationId ?? null,
          }),
        });
        return response.ok ? "ok" : "unavailable";
      } catch {
        return "unavailable";
      }
    },
  };
}

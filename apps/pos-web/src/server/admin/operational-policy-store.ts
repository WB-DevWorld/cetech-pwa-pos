import type { PosRestFetch } from "../http/server-fetch";
import {
  DEFAULT_SHIFT_CLOSE_POLICY,
  resolveShiftClosePolicy,
  type OperationalPolicyLayers,
  type ShiftClosePolicy,
  type ShiftClosePolicyOverride,
} from "../auth/policy";

export type PolicyScope = {
  readonly organizationId: string;
  readonly locationId?: string;
  readonly registerId?: string;
};

export type StoredPolicyOverride = ShiftClosePolicyOverride & {
  readonly id: string;
  readonly organizationId: string;
  readonly locationId?: string;
  readonly registerId?: string;
  readonly updatedByActorId: string;
  readonly updatedAt: string;
};

export interface OperationalPolicyStore {
  readLayers(scope: PolicyScope): Promise<OperationalPolicyLayers | "unavailable">;
  readEffective(scope: PolicyScope): Promise<ShiftClosePolicy | "unavailable">;
  writeOverride(input: {
    readonly scope: PolicyScope;
    readonly override: ShiftClosePolicyOverride;
    readonly actorId: string;
  }): Promise<StoredPolicyOverride | "unavailable">;
}

export function createMemoryOperationalPolicyStore(
  initial: readonly StoredPolicyOverride[] = [],
): OperationalPolicyStore {
  let rows = [...initial];

  function match(scope: PolicyScope, row: StoredPolicyOverride): boolean {
    return (
      row.organizationId === scope.organizationId &&
      row.locationId === scope.locationId &&
      row.registerId === scope.registerId
    );
  }

  async function layers(scope: PolicyScope): Promise<OperationalPolicyLayers> {
    const organization = rows.find(
      (row) =>
        row.organizationId === scope.organizationId &&
        row.locationId === undefined &&
        row.registerId === undefined,
    );
    const location = scope.locationId
      ? rows.find(
          (row) =>
            row.organizationId === scope.organizationId &&
            row.locationId === scope.locationId &&
            row.registerId === undefined,
        )
      : undefined;
    const register = scope.locationId && scope.registerId
      ? rows.find(
          (row) =>
            row.organizationId === scope.organizationId &&
            row.locationId === scope.locationId &&
            row.registerId === scope.registerId,
        )
      : undefined;
    return {
      organization: asOverride(organization),
      location: asOverride(location),
      register: asOverride(register),
    };
  }

  return {
    readLayers: layers,
    async readEffective(scope) {
      return resolveShiftClosePolicy(await layers(scope));
    },
    async writeOverride({ scope, override, actorId }) {
      const now = new Date().toISOString();
      const existing = rows.find((row) => match(scope, row));
      const next: StoredPolicyOverride = {
        ...(existing ?? {
          id: crypto.randomUUID(),
          organizationId: scope.organizationId,
          locationId: scope.locationId,
          registerId: scope.registerId,
          updatedByActorId: actorId,
          updatedAt: now,
        }),
        ...override,
        updatedByActorId: actorId,
        updatedAt: now,
      };
      rows = [...rows.filter((row) => !match(scope, row)), next];
      return next;
    },
  };
}

export function createSupabaseOperationalPolicyStore(input: {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
}): OperationalPolicyStore {
  const root = `${input.url.replace(/\/+$/, "")}/rest/v1`;
  const timeoutMs = input.timeoutMs ?? 5_000;
  const headers = {
    apikey: input.serviceRoleKey,
    Authorization: `Bearer ${input.serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  async function request(path: string, init: { method: string; body?: unknown; prefer?: string }) {
    const response = await input.fetchImpl(`${root}/${path}`, {
      method: init.method,
      headers: init.prefer ? { ...headers, Prefer: init.prefer } : headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, body };
  }

  async function readRows(organizationId: string): Promise<StoredPolicyOverride[] | "unavailable"> {
    const result = await request(
      `pos_operational_policies?organization_id=eq.${encodeURIComponent(
        organizationId,
      )}&select=id,organization_id,location_id,register_id,cashier_can_close_shift,manager_can_close_shift,cashier_own_shift_only,manager_can_close_others_shift,non_zero_variance_requires_manager,variance_tolerance_minor,variance_currency,updated_by_actor_id,updated_at`,
      { method: "GET" },
    );
    if (result.status >= 400 || !Array.isArray(result.body)) return "unavailable";
    const mapped: StoredPolicyOverride[] = [];
    for (const row of result.body) {
      const parsed = parseRow(row);
      if (parsed) mapped.push(parsed);
    }
    return mapped;
  }

  async function layers(scope: PolicyScope): Promise<OperationalPolicyLayers | "unavailable"> {
    const rows = await readRows(scope.organizationId);
    if (rows === "unavailable") return "unavailable";
    const organization = rows.find((row) => !row.locationId && !row.registerId);
    const location = scope.locationId
      ? rows.find((row) => row.locationId === scope.locationId && !row.registerId)
      : undefined;
    const register = scope.locationId && scope.registerId
      ? rows.find((row) => row.locationId === scope.locationId && row.registerId === scope.registerId)
      : undefined;
    return {
      organization: asOverride(organization),
      location: asOverride(location),
      register: asOverride(register),
    };
  }

  return {
    readLayers: layers,
    async readEffective(scope) {
      const resolved = await layers(scope);
      return resolved === "unavailable" ? "unavailable" : resolveShiftClosePolicy(resolved);
    },
    async writeOverride({ scope, override, actorId }) {
      const query = scopeQuery(scope);
      const existing = await request(
        `pos_operational_policies?${query}&select=id&limit=1`,
        { method: "GET" },
      );
      if (existing.status >= 400 || !Array.isArray(existing.body)) return "unavailable";

      const payload = toRowPayload(scope, override, actorId);
      if (existing.body.length > 0) {
        const id = (existing.body[0] as Record<string, unknown>).id;
        if (typeof id !== "string") return "unavailable";
        const patched = await request(
          `pos_operational_policies?id=eq.${encodeURIComponent(id)}`,
          { method: "PATCH", body: payload, prefer: "return=representation" },
        );
        if (patched.status >= 400 || !Array.isArray(patched.body) || patched.body.length !== 1) {
          return "unavailable";
        }
        return parseRow(patched.body[0]) ?? "unavailable";
      }

      const inserted = await request("pos_operational_policies", {
        method: "POST",
        body: payload,
        prefer: "return=representation",
      });
      if (inserted.status >= 400 || !Array.isArray(inserted.body) || inserted.body.length !== 1) {
        return "unavailable";
      }
      return parseRow(inserted.body[0]) ?? "unavailable";
    },
  };
}

function scopeQuery(scope: PolicyScope): string {
  const parts = [`organization_id=eq.${encodeURIComponent(scope.organizationId)}`];
  parts.push(scope.locationId ? `location_id=eq.${encodeURIComponent(scope.locationId)}` : "location_id=is.null");
  parts.push(scope.registerId ? `register_id=eq.${encodeURIComponent(scope.registerId)}` : "register_id=is.null");
  return parts.join("&");
}

function toRowPayload(
  scope: PolicyScope,
  override: ShiftClosePolicyOverride,
  actorId: string,
): Record<string, unknown> {
  return {
    organization_id: scope.organizationId,
    location_id: scope.locationId ?? null,
    register_id: scope.registerId ?? null,
    cashier_can_close_shift: override.cashierCanCloseShift ?? null,
    manager_can_close_shift: override.managerCanCloseShift ?? null,
    cashier_own_shift_only: override.cashierOwnShiftOnly ?? null,
    manager_can_close_others_shift: override.managerCanCloseOthersShift ?? null,
    non_zero_variance_requires_manager: override.nonZeroVarianceRequiresManager ?? null,
    variance_tolerance_minor: override.varianceToleranceMinor ?? null,
    variance_currency: override.varianceCurrency ?? null,
    updated_by_actor_id: actorId,
    updated_at: new Date().toISOString(),
  };
}

function parseRow(value: unknown): StoredPolicyOverride | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.organization_id !== "string" ||
    typeof row.updated_by_actor_id !== "string" ||
    typeof row.updated_at !== "string"
  ) {
    return null;
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    ...(typeof row.location_id === "string" ? { locationId: row.location_id } : {}),
    ...(typeof row.register_id === "string" ? { registerId: row.register_id } : {}),
    ...booleanField(row, "cashier_can_close_shift", "cashierCanCloseShift"),
    ...booleanField(row, "manager_can_close_shift", "managerCanCloseShift"),
    ...booleanField(row, "cashier_own_shift_only", "cashierOwnShiftOnly"),
    ...booleanField(row, "manager_can_close_others_shift", "managerCanCloseOthersShift"),
    ...booleanField(row, "non_zero_variance_requires_manager", "nonZeroVarianceRequiresManager"),
    ...(typeof row.variance_tolerance_minor === "number"
      ? { varianceToleranceMinor: row.variance_tolerance_minor }
      : {}),
    ...(typeof row.variance_currency === "string"
      ? { varianceCurrency: row.variance_currency }
      : {}),
    updatedByActorId: row.updated_by_actor_id,
    updatedAt: row.updated_at,
  };
}

function booleanField(
  row: Record<string, unknown>,
  source: string,
  target: keyof ShiftClosePolicy,
): Record<string, boolean> {
  return typeof row[source] === "boolean" ? { [target]: row[source] } : {};
}

function asOverride(row: StoredPolicyOverride | undefined): ShiftClosePolicyOverride | undefined {
  if (!row) return undefined;
  const {
    cashierCanCloseShift,
    managerCanCloseShift,
    cashierOwnShiftOnly,
    managerCanCloseOthersShift,
    nonZeroVarianceRequiresManager,
    varianceToleranceMinor,
    varianceCurrency,
  } = row;
  return {
    ...(cashierCanCloseShift !== undefined ? { cashierCanCloseShift } : {}),
    ...(managerCanCloseShift !== undefined ? { managerCanCloseShift } : {}),
    ...(cashierOwnShiftOnly !== undefined ? { cashierOwnShiftOnly } : {}),
    ...(managerCanCloseOthersShift !== undefined ? { managerCanCloseOthersShift } : {}),
    ...(nonZeroVarianceRequiresManager !== undefined ? { nonZeroVarianceRequiresManager } : {}),
    ...(varianceToleranceMinor !== undefined ? { varianceToleranceMinor } : {}),
    ...(varianceCurrency !== undefined ? { varianceCurrency } : {}),
  };
}

export { DEFAULT_SHIFT_CLOSE_POLICY };

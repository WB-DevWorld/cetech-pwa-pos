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
    readonly correlationId?: string;
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
    async writeOverride({ scope, override, actorId, correlationId }) {
      const result = await request("rpc/pos_admin_set_operational_policy", {
        method: "POST",
        body: {
          p_organization_id: scope.organizationId,
          p_location_id: scope.locationId ?? null,
          p_register_id: scope.registerId ?? null,
          p_actor_id: actorId,
          p_correlation_id: correlationId ?? null,
          p_cashier_can_close_shift: override.cashierCanCloseShift ?? null,
          p_manager_can_close_shift: override.managerCanCloseShift ?? null,
          p_cashier_own_shift_only: override.cashierOwnShiftOnly ?? null,
          p_manager_can_close_others_shift: override.managerCanCloseOthersShift ?? null,
          p_non_zero_variance_requires_manager: override.nonZeroVarianceRequiresManager ?? null,
          p_variance_tolerance_minor: override.varianceToleranceMinor ?? null,
          p_variance_currency: override.varianceCurrency ?? null,
        },
      });
      if (result.status >= 400) return "unavailable";
      const row =
        Array.isArray(result.body) && result.body.length === 1
          ? result.body[0]
          : result.body;
      return parseRow(row) ?? "unavailable";
    },
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

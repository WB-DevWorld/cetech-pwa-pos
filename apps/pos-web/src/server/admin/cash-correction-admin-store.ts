import type { PosRestFetch } from "../http/server-fetch";

export type CashCorrectionResult = {
  readonly movementId: string;
  readonly shiftId: string;
  readonly correctsMovementId: string;
  readonly signedAmountMinor: number;
  readonly currency: string;
  readonly approvalId: string;
  readonly replayed: boolean;
};

export type ManagementCashMovement = {
  readonly id: string;
  readonly shiftId: string;
  readonly kind: string;
  readonly signedAmountMinor: number;
  readonly currency: string;
  readonly reason?: string;
  readonly correctsMovementId?: string;
  readonly createdAt: string;
};

export interface CashCorrectionAdminStore {
  listShift(input: {
    readonly organizationId: string;
    readonly shiftId: string;
  }): Promise<readonly ManagementCashMovement[] | "unavailable">;
  reverse(input: {
    readonly organizationId: string;
    readonly movementId: string;
    readonly reason: string;
    readonly actorId: string;
    readonly correlationId: string;
    readonly approvalId: string;
  }): Promise<CashCorrectionResult | "unavailable">;
}

export function createMemoryCashCorrectionAdminStore(
  initial: readonly ManagementCashMovement[] = [],
): CashCorrectionAdminStore & { readonly rows: ManagementCashMovement[] } {
  const rows = [...initial];
  return {
    rows,
    async listShift({ organizationId, shiftId }) {
      return rows.filter((row) => row.shiftId === shiftId && organizationId.length > 0);
    },
    async reverse(input) {
      const original = rows.find((row) => row.id === input.movementId);
      if (!original || original.kind === "correction") return "unavailable";
      const existing = rows.find(
        (row) => row.kind === "correction" && row.correctsMovementId === original.id,
      );
      if (existing?.correctsMovementId) {
        return {
          movementId: existing.id,
          shiftId: existing.shiftId,
          correctsMovementId: existing.correctsMovementId,
          signedAmountMinor: existing.signedAmountMinor,
          currency: existing.currency,
          approvalId: input.approvalId,
          replayed: true,
        };
      }
      const created: ManagementCashMovement = {
        id: input.approvalId,
        shiftId: original.shiftId,
        kind: "correction",
        signedAmountMinor: -original.signedAmountMinor,
        currency: original.currency,
        reason: input.reason.trim(),
        correctsMovementId: original.id,
        createdAt: new Date().toISOString(),
      };
      rows.push(created);
      return {
        movementId: created.id,
        shiftId: created.shiftId,
        correctsMovementId: original.id,
        signedAmountMinor: created.signedAmountMinor,
        currency: created.currency,
        approvalId: input.approvalId,
        replayed: false,
      };
    },
  };
}

export function createSupabaseCashCorrectionAdminStore(input: {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
}): CashCorrectionAdminStore {
  const root = `${input.url.replace(/\/+$/, "")}/rest/v1`;
  const timeoutMs = input.timeoutMs ?? 8_000;
  const headers = {
    apikey: input.serviceRoleKey,
    Authorization: `Bearer ${input.serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  return {
    async listShift({ organizationId, shiftId }) {
      try {
        const response = await input.fetchImpl(
          `${root}/pos_cash_movements?organization_id=eq.${encodeURIComponent(organizationId)}&shift_id=eq.${encodeURIComponent(shiftId)}&select=id,shift_id,kind,signed_amount_minor,currency,reason,corrects_movement_id,created_at&order=created_at.asc`,
          { method: "GET", headers, signal: AbortSignal.timeout(timeoutMs) },
        );
        if (!response.ok) return "unavailable";
        const body = await response.json();
        if (!Array.isArray(body)) return "unavailable";
        return body.flatMap(parseMovement);
      } catch {
        return "unavailable";
      }
    },
    async reverse(value) {
      try {
        const response = await input.fetchImpl(`${root}/rpc/pos_admin_reverse_cash_movement`, {
          method: "POST",
          headers,
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            p_organization_id: value.organizationId,
            p_movement_id: value.movementId,
            p_reason: value.reason,
            p_actor_id: value.actorId,
            p_correlation_id: value.correlationId,
            p_approval_id: value.approvalId,
          }),
        });
        if (!response.ok) return "unavailable";
        const body = await response.json();
        return parseReverse(body) ?? "unavailable";
      } catch {
        return "unavailable";
      }
    },
  };
}

function parseMovement(value: unknown): readonly ManagementCashMovement[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.shift_id !== "string" ||
    typeof row.kind !== "string" ||
    typeof row.signed_amount_minor !== "number" ||
    typeof row.currency !== "string" ||
    typeof row.created_at !== "string"
  ) {
    return [];
  }
  return [{
    id: row.id,
    shiftId: row.shift_id,
    kind: row.kind,
    signedAmountMinor: row.signed_amount_minor,
    currency: row.currency,
    ...(typeof row.reason === "string" && row.reason.length > 0 ? { reason: row.reason } : {}),
    ...(typeof row.corrects_movement_id === "string" ? { correctsMovementId: row.corrects_movement_id } : {}),
    createdAt: row.created_at,
  }];
}

function parseReverse(value: unknown): CashCorrectionResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.movementId !== "string" ||
    typeof row.shiftId !== "string" ||
    typeof row.correctsMovementId !== "string" ||
    typeof row.signedAmountMinor !== "number" ||
    typeof row.currency !== "string" ||
    typeof row.approvalId !== "string" ||
    typeof row.replayed !== "boolean"
  ) {
    return null;
  }
  return {
    movementId: row.movementId,
    shiftId: row.shiftId,
    correctsMovementId: row.correctsMovementId,
    signedAmountMinor: row.signedAmountMinor,
    currency: row.currency,
    approvalId: row.approvalId,
    replayed: row.replayed,
  };
}

import type {
  CommandContext,
  Money,
  Shift,
  ShiftReport,
  Uuid,
} from "../../../../../docs/contracts/domain.generated";
import type { PosRestFetch } from "../http/server-fetch";

export type OperationalCloseResult =
  | { readonly kind: "closed"; readonly shift: Shift; readonly report: ShiftReport }
  | { readonly kind: "requires_attention"; readonly shift: Shift; readonly report?: undefined }
  | { readonly kind: "not_found" }
  | { readonly kind: "forbidden" }
  | { readonly kind: "conflict" }
  | { readonly kind: "unavailable" };

export interface OperationalCloseStore {
  close(input: {
    readonly organizationId: string;
    readonly shiftId: Uuid;
    readonly countedCash: Money;
    readonly context: CommandContext;
    readonly requestHash: string;
  }): Promise<OperationalCloseResult>;
}

export type SupabaseOperationalCloseStoreOptions = {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 8_000;

export function createSupabaseOperationalCloseStore(
  options: SupabaseOperationalCloseStoreOptions,
): OperationalCloseStore {
  const root = options.url.replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers = {
    apikey: options.serviceRoleKey,
    Authorization: `Bearer ${options.serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  return {
    async close(input): Promise<OperationalCloseResult> {
      let response: Awaited<ReturnType<PosRestFetch>>;
      try {
        response = await options.fetchImpl(`${root}/rest/v1/rpc/pos_close_shift_blind`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            p_organization_id: input.organizationId,
            p_shift_id: input.shiftId,
            p_counted_cash_minor: input.countedCash.minor,
            p_currency: input.countedCash.currency,
            p_idempotency_key: input.context.idempotencyKey,
            p_correlation_id: input.context.correlationId,
            p_request_hash: input.requestHash,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        return { kind: "unavailable" };
      }

      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (!response.ok) {
        return mapFailure(response.status, body);
      }

      const mapped = mapCloseOutcome(body);
      return mapped ?? { kind: "unavailable" };
    },
  };
}

function mapFailure(status: number, body: unknown): OperationalCloseResult {
  const error = asRecord(body);
  const code = typeof error?.code === "string" ? error.code : "";
  const message = typeof error?.message === "string" ? error.message : "";

  if (status === 404 || code === "P0002" || message.includes("shift not found")) {
    return { kind: "not_found" };
  }
  if (status === 401 || status === 403 || code === "42501") {
    return { kind: "forbidden" };
  }
  if (status === 409 || code === "23505" || message.includes("idempotency conflict")) {
    return { kind: "conflict" };
  }
  return { kind: "unavailable" };
}

function mapCloseOutcome(body: unknown): OperationalCloseResult | null {
  const root = asRecord(body);
  const shiftRow = asRecord(root?.shift);
  if (!shiftRow) {
    return null;
  }

  const shift = mapShift(shiftRow);
  if (!shift) {
    return null;
  }
  if (shift.status === "requires_attention") {
    if (shift.closedAt !== undefined || shift.zReportId !== undefined || root?.report != null) {
      return null;
    }
    return { kind: "requires_attention", shift };
  }
  if (shift.status !== "closed") {
    return null;
  }
  const reportRow = asRecord(root?.report);
  if (!reportRow) {
    return null;
  }
  const report = mapReport(reportRow);
  if (!report || report.shiftId !== shift.id || shift.zReportId !== report.id) {
    return null;
  }
  return { kind: "closed", shift, report };
}

function mapShift(row: Record<string, unknown>): Shift | null {
  if (
    typeof row.id !== "string" ||
    typeof row.register_id !== "string" ||
    typeof row.device_id !== "string" ||
    typeof row.cashier_id !== "string" ||
    (row.status !== "closed" && row.status !== "requires_attention") ||
    typeof row.opening_float_minor !== "number" ||
    row.opening_float_currency !== "GHS" ||
    typeof row.expected_cash_minor !== "number" ||
    row.expected_cash_currency !== "GHS" ||
    typeof row.counted_cash_minor !== "number" ||
    row.counted_cash_currency !== "GHS" ||
    typeof row.variance_minor !== "number" ||
    row.variance_currency !== "GHS" ||
    typeof row.opened_at !== "string"
  ) {
    return null;
  }
  if (row.status === "closed") {
    if (typeof row.closed_at !== "string" || typeof row.z_report_id !== "string") {
      return null;
    }
    return {
      id: row.id,
      registerId: row.register_id,
      deviceId: row.device_id,
      cashierId: row.cashier_id,
      status: "closed",
      openingFloat: { minor: row.opening_float_minor, currency: "GHS" },
      expectedCash: { minor: row.expected_cash_minor, currency: "GHS" },
      countedCash: { minor: row.counted_cash_minor, currency: "GHS" },
      variance: { minor: row.variance_minor, currency: "GHS" },
      openedAt: normalizeTimestamp(row.opened_at),
      closedAt: normalizeTimestamp(row.closed_at),
      zReportId: row.z_report_id,
    };
  }
  if (row.closed_at != null || row.z_report_id != null) {
    return null;
  }
  return {
    id: row.id,
    registerId: row.register_id,
    deviceId: row.device_id,
    cashierId: row.cashier_id,
    status: "requires_attention",
    openingFloat: { minor: row.opening_float_minor, currency: "GHS" },
    expectedCash: { minor: row.expected_cash_minor, currency: "GHS" },
    countedCash: { minor: row.counted_cash_minor, currency: "GHS" },
    variance: { minor: row.variance_minor, currency: "GHS" },
    openedAt: normalizeTimestamp(row.opened_at),
  };
}

function mapReport(row: Record<string, unknown>): ShiftReport | null {
  if (
    typeof row.id !== "string" ||
    typeof row.shift_id !== "string" ||
    row.kind !== "Z" ||
    typeof row.expected_cash_minor !== "number" ||
    typeof row.counted_cash_minor !== "number" ||
    typeof row.variance_minor !== "number" ||
    row.currency !== "GHS" ||
    typeof row.created_at !== "string"
  ) {
    return null;
  }
  return {
    id: row.id,
    shiftId: row.shift_id,
    kind: "Z",
    expectedCash: { minor: row.expected_cash_minor, currency: "GHS" },
    countedCash: { minor: row.counted_cash_minor, currency: "GHS" },
    variance: { minor: row.variance_minor, currency: "GHS" },
    createdAt: normalizeTimestamp(row.created_at),
  };
}

function normalizeTimestamp(value: string): string {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

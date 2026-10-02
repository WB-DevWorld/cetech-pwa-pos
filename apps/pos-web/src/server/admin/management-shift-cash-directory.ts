import type { Money, SignedMoney } from "../../../../../docs/contracts/domain.generated";
import type { PosRestFetch } from "../http/server-fetch";

/**
 * Management oversight reads stored shift aggregates. It does not recalculate
 * expected cash and it does not call the operational X/Z report endpoint.
 *
 * Report availability:
 * - open / closing: live X report can be produced from the stored shift;
 *   Z is pending because the shift is not closed.
 * - closed with a stored z_report_id: durable Z identity is available.
 * - closed without that identity, or requires_attention: no Z is manufactured.
 *
 * Result limit is explicit. Status priority is requires_attention, closing,
 * open, then recent closed. Active statuses order by opened time ascending.
 * Closed shifts order by closed time descending.
 */
export const MANAGEMENT_SHIFT_CASH_RESULT_LIMIT = 40;
const ACTIVE_STATUS_FETCH_LIMIT = 40;
const CLOSED_STATUS_FETCH_LIMIT = 20;

export const MANAGEMENT_SHIFT_STATUSES = [
  "open",
  "closing",
  "requires_attention",
  "closed",
] as const;

export type ManagementShiftStatus = (typeof MANAGEMENT_SHIFT_STATUSES)[number];

export type ManagementShiftReportAvailability = {
  readonly xAvailable: boolean;
  readonly zAvailable: boolean;
  readonly zReportId?: string;
};

export type ManagementShiftCashScope =
  | { readonly kind: "organization" }
  | { readonly kind: "locations"; readonly locationIds: readonly string[] };

export type ManagementShiftCashRow = {
  readonly shiftId: string;
  readonly organizationId: string;
  readonly locationId: string;
  readonly locationName?: string;
  readonly registerId: string;
  readonly registerName?: string;
  readonly deviceId: string;
  readonly cashierId: string;
  readonly status: ManagementShiftStatus;
  readonly openedAt: string;
  readonly closedAt?: string;
  readonly openingFloat: Money;
  readonly expectedCash: Money;
  readonly countedCash?: Money;
  readonly variance?: SignedMoney;
  readonly zReportId?: string;
  readonly report: ManagementShiftReportAvailability;
};

export type ManagementShiftCashListing = {
  readonly rows: readonly ManagementShiftCashRow[];
  readonly truncated: boolean;
};

export type ManagementShiftCashView = {
  readonly scope: ManagementShiftCashScope;
  readonly limit: number;
  readonly truncated: boolean;
  readonly rows: readonly ManagementShiftCashRow[];
};

export interface ManagementShiftCashDirectory {
  listOrganization(input: {
    readonly organizationId: string;
    readonly locationIds?: readonly string[];
  }): Promise<ManagementShiftCashListing | "unavailable">;
}

const STATUS_RANK: Record<ManagementShiftStatus, number> = {
  requires_attention: 0,
  closing: 1,
  open: 2,
  closed: 3,
};

export function managementShiftReportAvailability(input: {
  readonly status: ManagementShiftStatus;
  readonly zReportId?: string;
}): ManagementShiftReportAvailability {
  if (input.status === "closed" && input.zReportId) {
    return { xAvailable: false, zAvailable: true, zReportId: input.zReportId };
  }
  if (input.status === "open" || input.status === "closing") {
    return { xAvailable: true, zAvailable: false };
  }
  return { xAvailable: false, zAvailable: false };
}

export function compareManagementShifts(
  left: ManagementShiftCashRow,
  right: ManagementShiftCashRow,
): number {
  const rank = STATUS_RANK[left.status] - STATUS_RANK[right.status];
  if (rank !== 0) return rank;
  if (left.status === "closed") {
    const time = (right.closedAt ?? right.openedAt).localeCompare(left.closedAt ?? left.openedAt);
    if (time !== 0) return time;
  } else {
    const time = left.openedAt.localeCompare(right.openedAt);
    if (time !== 0) return time;
  }
  return left.shiftId.localeCompare(right.shiftId);
}

export function selectManagementShiftCashRows(input: {
  readonly rows: readonly ManagementShiftCashRow[];
  readonly organizationId: string;
  readonly locationIds?: readonly string[];
  readonly limit?: number;
}): ManagementShiftCashListing {
  const limit = input.limit ?? MANAGEMENT_SHIFT_CASH_RESULT_LIMIT;
  const allowed = input.locationIds ? new Set(input.locationIds) : null;
  const filtered = input.rows.filter((row) => {
    if (row.organizationId !== input.organizationId) return false;
    if (allowed && !allowed.has(row.locationId)) return false;
    return true;
  });
  const sorted = [...filtered].sort(compareManagementShifts);
  return {
    rows: sorted.slice(0, limit),
    truncated: sorted.length > limit,
  };
}

export function createMemoryManagementShiftCashDirectory(
  rows: readonly ManagementShiftCashRow[] = [],
): ManagementShiftCashDirectory {
  return {
    async listOrganization(input) {
      return selectManagementShiftCashRows({
        rows,
        organizationId: input.organizationId,
        locationIds: input.locationIds,
      });
    },
  };
}

const SHIFT_SELECT = [
  "id",
  "organization_id",
  "location_id",
  "register_id",
  "device_id",
  "cashier_id",
  "status",
  "opening_float_minor",
  "opening_float_currency",
  "expected_cash_minor",
  "expected_cash_currency",
  "counted_cash_minor",
  "counted_cash_currency",
  "variance_minor",
  "variance_currency",
  "opened_at",
  "closed_at",
  "z_report_id",
].join(",");

export function createSupabaseManagementShiftCashDirectory(input: {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
}): ManagementShiftCashDirectory {
  const root = `${input.url.replace(/\/+$/, "")}/rest/v1`;
  const timeoutMs = input.timeoutMs ?? 8_000;
  const headers = {
    apikey: input.serviceRoleKey,
    Authorization: `Bearer ${input.serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  async function get(path: string): Promise<unknown | "unavailable"> {
    try {
      const response = await input.fetchImpl(`${root}/${path}`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return "unavailable";
      return await response.json();
    } catch {
      return "unavailable";
    }
  }

  return {
    async listOrganization({ organizationId, locationIds }) {
      if (locationIds && locationIds.length === 0) {
        return { rows: [], truncated: false };
      }
      const locationFilter = locationIds?.length
        ? `&location_id=in.(${locationIds.map((id) => encodeURIComponent(id)).join(",")})`
        : "";
      const org = `organization_id=eq.${encodeURIComponent(organizationId)}`;
      const shiftQuery = (status: ManagementShiftStatus, order: string, limit: number) =>
        `pos_shifts?${org}&status=eq.${status}${locationFilter}&select=${SHIFT_SELECT}&order=${order}&limit=${limit}`;

      const [locationsBody, registersBody, attentionBody, closingBody, openBody, closedBody] =
        await Promise.all([
          get(`pos_locations?${org}&select=id,name`),
          get(`pos_registers?${org}&select=id,location_id,name`),
          get(shiftQuery("requires_attention", "opened_at.asc", ACTIVE_STATUS_FETCH_LIMIT + 1)),
          get(shiftQuery("closing", "opened_at.asc", ACTIVE_STATUS_FETCH_LIMIT + 1)),
          get(shiftQuery("open", "opened_at.asc", ACTIVE_STATUS_FETCH_LIMIT + 1)),
          get(shiftQuery("closed", "closed_at.desc", CLOSED_STATUS_FETCH_LIMIT + 1)),
        ]);

      if (
        !Array.isArray(locationsBody) ||
        !Array.isArray(registersBody) ||
        !Array.isArray(attentionBody) ||
        !Array.isArray(closingBody) ||
        !Array.isArray(openBody) ||
        !Array.isArray(closedBody)
      ) {
        return "unavailable";
      }

      const locationNames = new Map<string, string>();
      for (const row of locationsBody) {
        if (record(row) && typeof row.id === "string" && typeof row.name === "string" && row.name.trim()) {
          locationNames.set(row.id, row.name);
        }
      }
      const registerNames = new Map<string, string>();
      for (const row of registersBody) {
        if (record(row) && typeof row.id === "string" && typeof row.name === "string" && row.name.trim()) {
          registerNames.set(row.id, row.name);
        }
      }

      const bounded = [
        boundBucket(attentionBody, ACTIVE_STATUS_FETCH_LIMIT),
        boundBucket(closingBody, ACTIVE_STATUS_FETCH_LIMIT),
        boundBucket(openBody, ACTIVE_STATUS_FETCH_LIMIT),
        boundBucket(closedBody, CLOSED_STATUS_FETCH_LIMIT),
      ];
      const rows = bounded.flatMap((bucket) =>
        bucket.rows.flatMap((row) => normalizeShiftRow(row, locationNames, registerNames)),
      );
      const selected = selectManagementShiftCashRows({
        rows,
        organizationId,
        locationIds,
      });
      return {
        rows: selected.rows,
        truncated: selected.truncated || bounded.some((bucket) => bucket.truncated),
      };
    },
  };
}

function boundBucket(rows: readonly unknown[], limit: number): {
  readonly rows: readonly unknown[];
  readonly truncated: boolean;
} {
  return {
    rows: rows.slice(0, limit),
    truncated: rows.length > limit,
  };
}

function normalizeShiftRow(
  value: unknown,
  locationNames: ReadonlyMap<string, string>,
  registerNames: ReadonlyMap<string, string>,
): readonly ManagementShiftCashRow[] {
  if (!record(value)) return [];
  if (
    typeof value.id !== "string" ||
    typeof value.organization_id !== "string" ||
    typeof value.location_id !== "string" ||
    typeof value.register_id !== "string" ||
    typeof value.device_id !== "string" ||
    typeof value.cashier_id !== "string" ||
    !isStatus(value.status) ||
    typeof value.opened_at !== "string"
  ) {
    return [];
  }

  const openingFloat = money(value.opening_float_minor, value.opening_float_currency, false);
  const expectedCash = money(value.expected_cash_minor, value.expected_cash_currency, false);
  if (!openingFloat || !expectedCash || openingFloat.currency !== expectedCash.currency) return [];

  const countedCash = optionalMoney(value.counted_cash_minor, value.counted_cash_currency);
  if (countedCash === "invalid") return [];
  const variance = optionalSignedMoney(value.variance_minor, value.variance_currency);
  if (variance === "invalid") return [];
  const zReportId = typeof value.z_report_id === "string" && value.z_report_id.length > 0
    ? value.z_report_id
    : undefined;
  const closedAt = typeof value.closed_at === "string" && value.closed_at.length > 0
    ? value.closed_at
    : undefined;
  const locationName = locationNames.get(value.location_id);
  const registerName = registerNames.get(value.register_id);

  return [{
    shiftId: value.id,
    organizationId: value.organization_id,
    locationId: value.location_id,
    ...(locationName ? { locationName } : {}),
    registerId: value.register_id,
    ...(registerName ? { registerName } : {}),
    deviceId: value.device_id,
    cashierId: value.cashier_id,
    status: value.status,
    openedAt: value.opened_at,
    ...(closedAt ? { closedAt } : {}),
    openingFloat,
    expectedCash,
    ...(countedCash ? { countedCash } : {}),
    ...(variance ? { variance } : {}),
    ...(zReportId ? { zReportId } : {}),
    report: managementShiftReportAvailability({ status: value.status, zReportId }),
  }];
}

function optionalMoney(minorValue: unknown, currencyValue: unknown): Money | undefined | "invalid" {
  if (minorValue === null || minorValue === undefined) return undefined;
  const parsed = money(minorValue, currencyValue, false);
  return parsed ?? "invalid";
}

function optionalSignedMoney(
  minorValue: unknown,
  currencyValue: unknown,
): SignedMoney | undefined | "invalid" {
  if (minorValue === null || minorValue === undefined) return undefined;
  const parsed = money(minorValue, currencyValue, true);
  return parsed ?? "invalid";
}

function money(minorValue: unknown, currencyValue: unknown, signed: boolean): Money | undefined {
  const minor = integerMinor(minorValue);
  const currency = currencyCode(currencyValue);
  if (minor === undefined || !currency) return undefined;
  if (!signed && minor < 0) return undefined;
  return { minor, currency };
}

function integerMinor(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return undefined;
}

function currencyCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const currency = value.trim();
  return /^[A-Z]{3}$/.test(currency) ? currency : undefined;
}

function isStatus(value: unknown): value is ManagementShiftStatus {
  return typeof value === "string" && (MANAGEMENT_SHIFT_STATUSES as readonly string[]).includes(value);
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

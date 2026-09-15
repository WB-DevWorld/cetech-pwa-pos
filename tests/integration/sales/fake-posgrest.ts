import type { PosRestFetch } from "../../../apps/pos-web/src/server/http/server-fetch";

type Row = Record<string, unknown>;

export type FakePosgrest = {
  readonly fetchImpl: PosRestFetch;
  readonly tables: Record<string, Row[]>;
};

export function createFakePosgrest(options?: {
  readonly deny?: boolean;
  readonly unavailable?: boolean;
}): FakePosgrest {
  const tables: Record<string, Row[]> = {
    pos_locations: [
      { id: "loc_a1", organization_id: "org_a", name: "Location A1" },
      { id: "loc_a2", organization_id: "org_a", name: "Location A2" },
      { id: "loc_b1", organization_id: "org_b", name: "Location B1" },
    ],
    pos_registers: [],
    pos_devices: [],
    pos_shifts: [],
    pos_cash_movements: [],
    pos_pending_operations: [],
    pos_outbox_events: [],
    pos_quote_snapshots: [],
    pos_checkout_sales: [],
    pos_checkout_payments: [],
    pos_checkout_receipts: [],
    pos_provider_payment_events: [],
    pos_staff_location_assignments: [],
    pos_staff_register_assignments: [],
  };

  const fetchImpl: PosRestFetch = async (input, init) => {
    if (options?.unavailable) {
      throw new Error("network down");
    }
    if (options?.deny) {
      return jsonResponse(403, { message: "denied" });
    }
    const url = new URL(input);
    const table = url.pathname.split("/").filter(Boolean).pop() ?? "";
    const method = (init.method ?? "GET").toUpperCase();
    const prefer = init.headers.Prefer ?? "";
    const merge = prefer.includes("merge-duplicates");
    const filters = parseFilters(url.searchParams);
    const onConflict = url.searchParams.get("on_conflict");
    if (!tables[table]) {
      tables[table] = [];
    }
    if (method === "GET") {
      return jsonResponse(200, tables[table].filter((row) => matches(row, filters)));
    }
    if (method === "PATCH") {
      const body = init.body ? (JSON.parse(String(init.body)) as Row) : {};
      for (const row of tables[table]) {
        if (matches(row, filters)) {
          Object.assign(row, body);
        }
      }
      return jsonResponse(204, null);
    }
    if (method === "POST") {
      const body = init.body ? (JSON.parse(String(init.body)) as Row) : {};
      const conflict = findConflict(table, tables, body, onConflict);
      if (conflict) {
        if (merge && onConflict) {
          Object.assign(conflict, body);
          return jsonResponse(200, [conflict]);
        }
        return jsonResponse(409, {
          code: "23505",
          message: `duplicate key value violates unique constraint "${conflictName(table, body)}"`,
        });
      }
      if (table === "pos_shifts") {
        const inserted = insertShift(tables, body);
        if (inserted === "conflict") {
          return jsonResponse(409, {
            code: "23505",
            message: 'duplicate key value violates unique constraint "pos_shifts_one_active_per_register"',
          });
        }
        return jsonResponse(201, [inserted]);
      }
      if (table === "pos_cash_movements") {
        const inserted = insertCash(tables, body);
        if (inserted.kind === "error") {
          return jsonResponse(400, { code: inserted.code, message: inserted.message });
        }
        return jsonResponse(201, [inserted.row]);
      }
      const row = { ...body };
      tables[table].push(row);
      return jsonResponse(201, [row]);
    }
    return jsonResponse(405, { message: "method not allowed" });
  };

  return { fetchImpl, tables };
}

function jsonResponse(status: number, body: unknown): Awaited<ReturnType<PosRestFetch>> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function parseFilters(params: URLSearchParams): Array<{ column: string; op: string; value: string }> {
  const filters: Array<{ column: string; op: string; value: string }> = [];
  for (const [key, raw] of params.entries()) {
    if (key === "select" || key === "on_conflict") {
      continue;
    }
    const match = /^(eq|in)\.(.*)$/.exec(raw);
    if (!match) {
      continue;
    }
    filters.push({ column: key, op: match[1], value: match[2] });
  }
  return filters;
}

function matches(row: Row, filters: Array<{ column: string; op: string; value: string }>): boolean {
  return filters.every((filter) => {
    const actual = row[filter.column];
    if (filter.op === "eq") {
      return String(actual ?? "") === decodeURIComponent(filter.value);
    }
    const inner = filter.value.replace(/^\(/, "").replace(/\)$/, "");
    const allowed = inner.split(",").map((part) => decodeURIComponent(part.trim()));
    return allowed.includes(String(actual ?? ""));
  });
}

function findConflict(table: string, tables: Record<string, Row[]>, body: Row, onConflict: string | null): Row | undefined {
  if (onConflict) {
    return tables[table].find((row) => row[onConflict] === body[onConflict]);
  }
  if (table === "pos_pending_operations") {
    const idemp = tables[table].find(
      (row) =>
        row.organization_id === body.organization_id &&
        row.operation === body.operation &&
        row.idempotency_key === body.idempotency_key,
    );
    if (idemp) {
      return idemp;
    }
    if (body.operation === "sale.prepare" && body.transaction_id) {
      return tables[table].find(
        (row) => row.operation === "sale.prepare" && row.transaction_id === body.transaction_id,
      );
    }
    return undefined;
  }
  if (table === "pos_checkout_payments") {
    return tables[table].find(
      (row) =>
        row.payment_id === body.payment_id ||
        row.transaction_id === body.transaction_id ||
        (Boolean(body.provider) &&
          Boolean(body.provider_reference) &&
          row.provider === body.provider &&
          row.provider_reference === body.provider_reference),
    );
  }
  if (table === "pos_provider_payment_events") {
    return tables[table].find(
      (row) =>
        row.id === body.id ||
        (row.provider === body.provider && row.event_fingerprint === body.event_fingerprint),
    );
  }
  if (table === "pos_checkout_receipts") {
    return tables[table].find((row) => row.id === body.id || row.transaction_id === body.transaction_id);
  }
  if (table === "pos_checkout_sales") {
    return tables[table].find((row) => row.transaction_id === body.transaction_id);
  }
  if (table === "pos_quote_snapshots") {
    return tables[table].find((row) => row.id === body.id);
  }
  return undefined;
}

function conflictName(table: string, body: Row): string {
  if (table === "pos_pending_operations") {
    return "pos_pending_idempotency";
  }
  if (table === "pos_checkout_payments" && body.transaction_id) {
    return "pos_checkout_payments_one_per_transaction";
  }
  if (table === "pos_checkout_receipts") {
    return "pos_checkout_receipts_one_per_transaction";
  }
  if (table === "pos_cash_movements") {
    return "pos_cash_one_sale_per_transaction";
  }
  return `${table}_pkey`;
}

function insertShift(tables: Record<string, Row[]>, body: Row): Row | "conflict" {
  const register = tables.pos_registers.find((row) => row.id === body.register_id);
  const device = tables.pos_devices.find((row) => row.id === body.device_id);
  const active = tables.pos_shifts.find(
    (row) => row.register_id === body.register_id && (row.status === "open" || row.status === "closing"),
  );
  if (active) {
    return "conflict";
  }
  const row: Row = {
    ...body,
    organization_id: register?.organization_id,
    location_id: register?.location_id,
    status: "open",
    expected_cash_minor: body.opening_float_minor,
    expected_cash_currency: body.opening_float_currency,
    opened_at: typeof body.opened_at === "string" ? body.opened_at : "2026-09-15T08:00:00.000Z",
    device_ok: Boolean(device),
  };
  tables.pos_shifts.push(row);
  const opening = Number(body.opening_float_minor ?? 0);
  if (opening > 0) {
    tables.pos_cash_movements.push({
      id: "opening-float-generated",
      organization_id: row.organization_id,
      location_id: row.location_id,
      register_id: row.register_id,
      shift_id: row.id,
      kind: "opening_float",
      signed_amount_minor: opening,
      currency: body.opening_float_currency,
      actor_id: body.cashier_id,
      created_at: "2026-09-15T08:00:00.000Z",
      reason: "opening float",
    });
  }
  return row;
}

function insertCash(
  tables: Record<string, Row[]>,
  body: Row,
): { kind: "ok"; row: Row } | { kind: "error"; code: string; message: string } {
  const shift = tables.pos_shifts.find((row) => row.id === body.shift_id);
  if (!shift || shift.status !== "open") {
    return { kind: "error", code: "55000", message: "cash movements require an open shift" };
  }
  if (body.kind === "opening_float") {
    const existing = tables.pos_cash_movements.find(
      (row) => row.shift_id === body.shift_id && row.kind === "opening_float",
    );
    if (existing) {
      return {
        kind: "error",
        code: "23505",
        message: 'duplicate key value violates unique constraint "pos_cash_one_opening_float_per_shift"',
      };
    }
  }
  if (body.kind === "cash_sale" && body.transaction_id) {
    const existing = tables.pos_cash_movements.find(
      (row) =>
        row.kind === "cash_sale" &&
        row.organization_id === shift.organization_id &&
        row.transaction_id === body.transaction_id,
    );
    if (existing) {
      return {
        kind: "error",
        code: "23505",
        message: 'duplicate key value violates unique constraint "pos_cash_one_sale_per_transaction"',
      };
    }
  }
  const signed = Number(body.signed_amount_minor ?? 0);
  if (body.kind !== "opening_float") {
    const next = Number(shift.expected_cash_minor ?? 0) + signed;
    if (next < 0) {
      return { kind: "error", code: "23514", message: "expected cash cannot be negative" };
    }
    shift.expected_cash_minor = next;
  }
  const row: Row = {
    ...body,
    organization_id: shift.organization_id,
    location_id: shift.location_id,
    register_id: shift.register_id,
    created_at: typeof body.created_at === "string" ? body.created_at : "2026-09-15T08:00:00.000Z",
  };
  tables.pos_cash_movements.push(row);
  return { kind: "ok", row };
}

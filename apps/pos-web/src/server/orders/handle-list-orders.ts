import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { authFailure } from "../auth/errors";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import { guardStaffCommand, type CommandHttpHeaders } from "../sales/guard-staff-command";
import {
  isHistorySale,
  matchesOrderQuery,
  presentOrderHistoryItem,
  type OrderHistoryListItem,
} from "./order-history-view";

export async function handleListOrders(input: {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly query: string;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly checkoutStore: CheckoutStore;
  readonly assignments: StaffAssignmentDirectory;
}): Promise<{
  readonly status: number;
  readonly body: ApiResult<{ readonly items: readonly OrderHistoryListItem[] }>;
  readonly headers: CommandHttpHeaders;
}> {
  const guard = await guardStaffCommand({
    correlationIdHeader: input.correlationIdHeader,
    origin: input.origin,
    referer: input.referer,
    cookieHeader: input.cookieHeader,
    csrfHeader: input.csrfHeader,
    now: input.now,
    sessionStore: input.sessionStore,
    allowedOrigins: input.allowedOrigins,
    requireMutationProtection: false,
    requireIdempotencyKey: false,
  });
  if (!guard.ok) {
    return { status: guard.status, body: guard.body, headers: guard.headers };
  }
  const assigned = await input.assignments.lookup({
    actorId: guard.session.actorId,
    organizationId: guard.session.organizationId,
  });
  if (assigned === "unavailable") {
    const body = authFailure("INTEGRATION_UNAVAILABLE", "staff assignments are unavailable", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const locationIds = uniqueIds(assigned.locationIds);
  const scope = { organizationId: guard.session.organizationId, locationIds, limit: 80 };
  const [sales, uncertainPayments] = await Promise.all([
    input.checkoutStore.listRecentSales(scope),
    input.checkoutStore.listUncertainPayments(scope),
  ]);
  const paymentByTx = new Map(uncertainPayments.map((payment) => [payment.transactionId, payment]));
  const items: OrderHistoryListItem[] = [];
  for (const sale of sales.filter(isHistorySale)) {
    const item = presentOrderHistoryItem(sale, paymentByTx.get(sale.prepared.transactionId));
    if (!matchesOrderQuery(item, input.query)) continue;
    items.push(item);
  }
  return {
    status: 200,
    body: { ok: true, data: { items }, correlationId: guard.correlationId },
    headers: guard.headers,
  };
}

function uniqueIds(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter(Boolean))];
}

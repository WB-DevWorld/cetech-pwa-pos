import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { AttentionItemView } from "../../ui/operational";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { authFailure } from "../auth/errors";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import { guardStaffCommand, type CommandHttpHeaders } from "../sales/guard-staff-command";
import { composeAttentionItems } from "./attention-view";

export async function handleListAttention(input: {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly checkoutStore: CheckoutStore;
  readonly assignments: StaffAssignmentDirectory;
}): Promise<{
  readonly status: number;
  readonly body: ApiResult<{ readonly items: readonly AttentionItemView[]; readonly count: number }>;
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
  const locationIds = [...new Set(assigned.locationIds.filter(Boolean))];
  const scope = { organizationId: guard.session.organizationId, locationIds, limit: 80 };
  const [payments, sales, shifts, operations] = await Promise.all([
    input.checkoutStore.listUncertainPayments(scope),
    input.checkoutStore.listRecentSales(scope),
    input.checkoutStore.listAttentionShifts({ ...scope, limit: 40 }),
    input.checkoutStore.listAttentionOperations({ ...scope, limit: 40 }),
  ]);
  const items = composeAttentionItems({ payments, sales, shifts, operations });
  return {
    status: 200,
    body: { ok: true, data: { items, count: items.length }, correlationId: guard.correlationId },
    headers: guard.headers,
  };
}

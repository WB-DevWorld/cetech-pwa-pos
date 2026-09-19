import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { authFailure } from "../auth/errors";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import { guardStaffCommand, type CommandHttpHeaders } from "../sales/guard-staff-command";
import type { CustomerBridge, CustomerReadItem } from "./compose-customer-bridge";

export async function handleSearchCustomers(input: {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly query: string;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly assignments: StaffAssignmentDirectory;
  readonly customers?: CustomerBridge;
}): Promise<{
  readonly status: number;
  readonly body: ApiResult<{ readonly items: readonly CustomerReadItem[] }>;
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
  if (!input.customers) {
    const body = authFailure("INTEGRATION_UNAVAILABLE", "customer producer is unavailable", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const result = await input.customers.search(input.query, guard.correlationId);
  if (!result.ok) {
    const body = authFailure(result.code, result.message, guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  return {
    status: 200,
    body: { ok: true, data: { items: result.page.items }, correlationId: guard.correlationId },
    headers: guard.headers,
  };
}

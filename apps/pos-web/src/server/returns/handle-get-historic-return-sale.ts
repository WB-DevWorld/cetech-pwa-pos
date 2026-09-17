import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { authFailure } from "../auth/errors";
import { isUuid } from "../auth/ids";
import { apiFailure } from "../http/api-failure";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore, PosSaleRecord } from "../../core/checkout/types";
import { authorizeCheckoutRead } from "../sales/authorize-checkout";
import { guardStaffCommand, type CommandHttpHeaders } from "../sales/guard-staff-command";
import {
  projectHistoricReturnSale,
  type HistoricReturnSaleProjection,
} from "./historic-sale-projection";

export async function handleGetHistoricReturnSale(input: {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly saleKey: string;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly checkoutStore: CheckoutStore;
  readonly assignments: StaffAssignmentDirectory;
}): Promise<{
  readonly status: number;
  readonly body: ApiResult<HistoricReturnSaleProjection>;
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
  const saleKey = input.saleKey.trim();
  if (!saleKey) {
    const body = authFailure("VALIDATION_ERROR", "saleKey is required", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }

  const sale = await loadSaleForHistoricReturn(input.checkoutStore, guard.session.organizationId, saleKey);
  if (!sale || sale.organizationId !== guard.session.organizationId) {
    const body = apiFailure("NOT_FOUND", "completed sale was not found", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const authorized = await authorizeCheckoutRead({
    session: guard.session,
    assignments: input.assignments,
    correlationId: guard.correlationId,
    organizationId: sale.organizationId,
    locationId: sale.locationId,
    registerId: sale.registerId,
  });
  if (!authorized.ok) {
    return { status: httpStatusFor(authorized.error.code), body: authorized, headers: guard.headers };
  }
  if (sale.status !== "completed") {
    const body = apiFailure("NOT_FOUND", "completed sale was not found", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const projection = projectHistoricReturnSale(sale);
  if (!projection) {
    const body = apiFailure(
      "REQUIRES_ATTENTION",
      "sale is missing immutable order line identities",
      guard.correlationId,
    );
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  return {
    status: 200,
    body: { ok: true, data: projection, correlationId: guard.correlationId },
    headers: guard.headers,
  };
}

async function loadSaleForHistoricReturn(
  store: CheckoutStore,
  organizationId: string,
  saleKey: string,
): Promise<PosSaleRecord | undefined> {
  const bySaleId = await store.getSaleBySaleId(organizationId, saleKey);
  if (bySaleId) {
    return bySaleId;
  }
  if (!isUuid(saleKey)) {
    return undefined;
  }
  return store.getSale(saleKey);
}

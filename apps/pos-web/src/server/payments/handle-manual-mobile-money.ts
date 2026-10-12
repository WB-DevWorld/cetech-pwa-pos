import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { apiFailure } from "../http/api-failure";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import type { StaffSessionStore } from "../auth/session-store";
import { authorizeCheckoutMutation, mutationProtectionFrom } from "../sales/authorize-checkout";
import { guardStaffCommand, type CommandHttpHeaders } from "../sales/guard-staff-command";
import { beginManualMobileMoney, confirmManualMobileMoney, type ManualMobileMoneyInstructions } from "./manual-mobile-money";

type ManualHttp = {
  readonly status: number;
  readonly body: ApiResult<ManualMobileMoneyInstructions>;
  readonly headers: CommandHttpHeaders;
};

export async function handleBeginManualMobileMoney(input: {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly idempotencyKeyHeader?: string | null;
  readonly body: unknown;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly checkoutStore: CheckoutStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly env: Readonly<Record<string, string | undefined>>;
}): Promise<ManualHttp> {
  const guarded = await guard(input, "payment.initialize");
  if (!guarded.ok) return guarded.response;
  const transactionId = readId(input.body, "transactionId");
  if (!transactionId || !guarded.idempotencyKey) {
    return fail(guarded, "VALIDATION_ERROR", "A prepared sale id and Idempotency-Key are required.");
  }
  const result = await beginManualMobileMoney({
    store: input.checkoutStore,
    actor: guarded.actor,
    transactionId,
    idempotencyKey: guarded.idempotencyKey,
    correlationId: guarded.correlationId,
    now: input.now,
    env: input.env,
    staffActive: true,
  });
  return { status: result.ok ? 200 : httpStatusFor(result.error.code), body: result, headers: guarded.headers };
}

export async function handleConfirmManualMobileMoney(input: {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly idempotencyKeyHeader?: string | null;
  readonly body: unknown;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly checkoutStore: CheckoutStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly env: Readonly<Record<string, string | undefined>>;
}): Promise<ManualHttp> {
  const guarded = await guard(input, "payment.resolve");
  if (!guarded.ok) return guarded.response;
  const transactionId = readId(input.body, "transactionId");
  const paymentId = readId(input.body, "paymentId");
  const merchantReference = readString(input.body, "merchantReference");
  const merchantConfirmed = readConfirmed(input.body);
  if (!transactionId || !paymentId || !guarded.idempotencyKey) {
    return fail(guarded, "VALIDATION_ERROR", "The sale, payment, and Idempotency-Key are required.");
  }
  const result = await confirmManualMobileMoney({
    store: input.checkoutStore,
    actor: guarded.actor,
    transactionId,
    paymentId,
    idempotencyKey: guarded.idempotencyKey,
    correlationId: guarded.correlationId,
    now: input.now,
    env: input.env,
    staffActive: true,
    merchantReference,
    merchantConfirmed,
  });
  return { status: result.ok ? 200 : httpStatusFor(result.error.code), body: result, headers: guarded.headers };
}

async function guard(
  input: {
    readonly correlationIdHeader?: string;
    readonly origin: string | null;
    readonly referer: string | null;
    readonly cookieHeader?: string;
    readonly csrfHeader?: string | null;
    readonly idempotencyKeyHeader?: string | null;
    readonly body: unknown;
    readonly now: Date;
    readonly sessionStore: StaffSessionStore;
    readonly allowedOrigins: readonly string[];
    readonly checkoutStore: CheckoutStore;
    readonly assignments: StaffAssignmentDirectory;
  },
  permission: "payment.initialize" | "payment.resolve",
): Promise<
  | { readonly ok: false; readonly response: ManualHttp }
  | {
      readonly ok: true;
      readonly correlationId: Uuid;
      readonly idempotencyKey?: Uuid;
      readonly headers: CommandHttpHeaders;
      readonly actor: { readonly actorId: string; readonly displayName: string; readonly organizationId: string; readonly locationIds: readonly string[] };
    }
> {
  const gate = await guardStaffCommand({
    correlationIdHeader: input.correlationIdHeader,
    origin: input.origin,
    referer: input.referer,
    cookieHeader: input.cookieHeader,
    csrfHeader: input.csrfHeader,
    now: input.now,
    sessionStore: input.sessionStore,
    allowedOrigins: input.allowedOrigins,
    requireMutationProtection: true,
    idempotencyKeyHeader: input.idempotencyKeyHeader,
    requireIdempotencyKey: true,
  });
  if (!gate.ok) return { ok: false, response: { status: gate.status, body: gate.body, headers: gate.headers } };
  const transactionId = readId(input.body, "transactionId");
  const sale = transactionId ? await input.checkoutStore.getSale(transactionId) : undefined;
  if (!sale) {
    const body = apiFailure("NOT_FOUND", "prepared sale was not found", gate.correlationId);
    return { ok: false, response: { status: httpStatusFor(body.error.code), body, headers: gate.headers } };
  }
  const authorized = await authorizeCheckoutMutation({
    session: gate.session,
    assignments: input.assignments,
    correlationId: gate.correlationId,
    organizationId: sale.organizationId,
    locationId: sale.locationId,
    registerId: sale.registerId,
    permission,
    protection: mutationProtectionFrom(input),
  });
  if (!authorized.ok) {
    return { ok: false, response: { status: httpStatusFor(authorized.error.code), body: authorized, headers: gate.headers } };
  }
  return {
    ok: true,
    correlationId: gate.correlationId,
    idempotencyKey: gate.idempotencyKey,
    headers: gate.headers,
    actor: authorized.data.session,
  };
}

function fail(
  guarded: { readonly correlationId: Uuid; readonly headers: CommandHttpHeaders },
  code: "VALIDATION_ERROR",
  message: string,
): ManualHttp {
  const body = apiFailure(code, message, guarded.correlationId);
  return { status: httpStatusFor(body.error.code), body, headers: guarded.headers };
}

function readId(body: unknown, key: string): Uuid | undefined {
  const value = readString(body, key);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : undefined;
}

function readString(body: unknown, key: string): string {
  if (!body || typeof body !== "object") return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function readConfirmed(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  return (body as Record<string, unknown>).merchantConfirmed === true;
}

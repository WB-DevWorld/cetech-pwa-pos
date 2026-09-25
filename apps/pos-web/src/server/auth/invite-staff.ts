import type { ApiResult } from "../../../../../docs/contracts/ports";
import { STAFF_CSRF_COOKIE, STAFF_SESSION_COOKIE } from "../../config/auth";
import { readSupabaseInfrastructureEnv } from "../../config/env";
import { resolveCorrelationId } from "../http/correlation";
import { httpStatusFor } from "../http/status";
import type { StaffAssignmentDirectory } from "./assignments";
import { authorizeStaffMutation } from "./authorize";
import { parseCookieHeader } from "./cookies";
import { authFailure } from "./errors";
import { resolveInvitationRedirect } from "./invitation-redirect";
import type { StaffSessionStore } from "./session-store";
import type { SupabaseStaffInviteResult } from "./supabase-staff-invite";
import { INVITE_ALREADY_REGISTERED, INVITE_FORBIDDEN, INVITE_NOT_CONFIGURED, INVITE_UNAVAILABLE } from "../../features/auth/invite-messages";

export type StaffInviteAudit = {
  readonly action: "staff.invite";
  readonly actorId: string | null;
  readonly organizationId: string | null;
  readonly outcome: "sent" | "already_registered" | "not_sent";
  readonly correlationId: string;
};

export type InviteStaffHttpResponse = {
  readonly status: number;
  readonly body: ApiResult<{ readonly invited: true }>;
  readonly headers: {
    readonly "Cache-Control": "no-store";
    readonly "X-Correlation-ID": string;
  };
};

export async function handleInviteStaff(input: {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly body: unknown;
  readonly now: Date;
  readonly store: StaffSessionStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly allowedOrigins: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly deliver: (request: {
    readonly supabaseUrl: string;
    readonly serviceRoleKey: string;
    readonly email: string;
    readonly redirectTo: string;
  }) => Promise<SupabaseStaffInviteResult>;
  readonly audit?: (event: StaffInviteAudit) => void;
}): Promise<InviteStaffHttpResponse> {
  const correlation = resolveCorrelationId(input.correlationIdHeader);
  const headers = {
    "Cache-Control": "no-store" as const,
    "X-Correlation-ID": correlation.correlationId,
  };
  if (!correlation.ok) {
    return respond(
      headers,
      authFailure("VALIDATION_ERROR", "X-Correlation-ID must be a UUID", correlation.correlationId),
    );
  }

  const cookies = parseCookieHeader(input.cookieHeader);
  const sessionId = cookies[STAFF_SESSION_COOKIE];
  if (!sessionId) {
    return respond(headers, authFailure("AUTH_REQUIRED", "staff session is required", correlation.correlationId));
  }

  let stored = null;
  try {
    stored = await input.store.get(sessionId, input.now);
  } catch {
    return respond(
      headers,
      authFailure("INTEGRATION_UNAVAILABLE", "staff session store is unavailable", correlation.correlationId),
    );
  }
  if (!stored) {
    return respond(
      headers,
      authFailure("AUTH_REQUIRED", "staff session is expired or revoked", correlation.correlationId, {
        field: "session",
      }),
    );
  }

  const session = stored.session;
  const record = (outcome: StaffInviteAudit["outcome"]) => {
    input.audit?.({
      action: "staff.invite",
      actorId: session.actorId,
      organizationId: session.organizationId,
      outcome,
      correlationId: correlation.correlationId,
    });
  };

  let assignments;
  try {
    assignments = await input.assignments.lookup({
      actorId: session.actorId,
      organizationId: session.organizationId,
    });
  } catch {
    assignments = "unavailable" as const;
  }
  if (assignments === "unavailable") {
    record("not_sent");
    return respond(
      headers,
      authFailure("INTEGRATION_UNAVAILABLE", "staff assignment directory is unavailable", correlation.correlationId, {
        field: "assignments",
      }),
    );
  }

  const managerLocation = assignments.locationRoles.find(
    (row) => row.role === "manager" && session.locationIds.includes(row.locationId),
  );
  if (!managerLocation) {
    record("not_sent");
    return respond(headers, authFailure("FORBIDDEN", INVITE_FORBIDDEN, correlation.correlationId));
  }

  const authorized = await authorizeStaffMutation(
    {
      verifyResult: {
        ok: true,
        identity: {
          actorId: session.actorId,
          displayName: session.displayName,
          organizationId: session.organizationId,
          locationIds: session.locationIds,
          registerId: null,
          capabilities: session.capabilities,
          expiresAt: session.expiresAt,
        },
      },
      assignments: input.assignments,
      correlationId: correlation.correlationId,
      required: {
        organizationId: session.organizationId,
        locationId: managerLocation.locationId,
        permission: "staff.invite",
      },
    },
    {
      origin: input.origin,
      referer: input.referer,
      csrfCookie: cookies[STAFF_CSRF_COOKIE] ?? null,
      csrfHeader: input.csrfHeader ?? null,
      allowedOrigins: input.allowedOrigins,
    },
  );
  if (!authorized.ok) {
    record("not_sent");
    return respond(headers, authorized);
  }

  const email = readEmail(input.body);
  if (!email) {
    record("not_sent");
    return respond(headers, authFailure("VALIDATION_ERROR", "Enter a valid email address.", correlation.correlationId));
  }

  const redirect = resolveInvitationRedirect(input.env);
  if (!redirect.ok) {
    record("not_sent");
    return respond(headers, authFailure("VALIDATION_ERROR", INVITE_NOT_CONFIGURED, correlation.correlationId));
  }

  const infra = readSupabaseInfrastructureEnv(input.env);
  if (!infra) {
    record("not_sent");
    return respond(headers, authFailure("VALIDATION_ERROR", INVITE_NOT_CONFIGURED, correlation.correlationId));
  }

  let delivered: SupabaseStaffInviteResult;
  try {
    delivered = await input.deliver({
      supabaseUrl: infra.url,
      serviceRoleKey: infra.serviceRoleKey,
      email,
      redirectTo: redirect.redirectTo,
    });
  } catch {
    delivered = { ok: false, reason: "unavailable" };
  }

  if (!delivered.ok && delivered.reason === "already_registered") {
    record("already_registered");
    return respond(headers, authFailure("VALIDATION_ERROR", INVITE_ALREADY_REGISTERED, correlation.correlationId));
  }
  if (!delivered.ok) {
    record("not_sent");
    return respond(
      headers,
      authFailure("INTEGRATION_UNAVAILABLE", INVITE_UNAVAILABLE, correlation.correlationId),
    );
  }

  record("sent");
  return {
    status: 200,
    headers,
    body: { ok: true, data: { invited: true }, correlationId: correlation.correlationId },
  };
}

function respond(
  headers: InviteStaffHttpResponse["headers"],
  body: ApiResult<{ readonly invited: true }>,
): InviteStaffHttpResponse {
  return {
    status: body.ok ? 200 : httpStatusFor(body.error.code),
    headers,
    body,
  };
}

function readEmail(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const email = (body as { readonly email?: unknown }).email;
  if (typeof email !== "string") {
    return null;
  }
  const trimmed = email.trim();
  if (trimmed.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

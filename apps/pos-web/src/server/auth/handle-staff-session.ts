import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Session, Uuid } from "../../../../../docs/contracts/domain.generated";
import { STAFF_CSRF_COOKIE, STAFF_SESSION_COOKIE } from "../../config/auth";
import { preserveLocalWorkOnSignOut } from "../../core/identity/local-work";
import type { StaffSessionContext } from "../../core/identity/staff-session-context";
import { resolveCorrelationId } from "../http/correlation";
import { httpStatusFor } from "../http/status";
import type { StaffAssignmentDirectory } from "./assignments";
import { parseCookieHeader } from "./cookies";
import { originFromReferer } from "./csrf";
import { authFailure } from "./errors";
import type { StaffIdentityVerifier } from "./identity-verifier";
import type { StaffAccessControl } from "./staff-access-control";
import type { StaffSessionStore } from "./session-store";
import { establishStaffSession, revokeStaffSession } from "./staff-session";

export type StaffSessionHttpHeaders = {
  readonly "Cache-Control": "no-store";
  readonly "X-Correlation-ID": Uuid;
};

export type StaffSessionHttpResponse<T> = {
  readonly status: number;
  readonly body: ApiResult<T>;
  readonly cookies: readonly string[];
  readonly headers: StaffSessionHttpHeaders;
};

export type SignOutResult = {
  readonly signedOut: true;
  readonly localWorkPreserved: true;
};

export type EstablishStaffSessionRequest = {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly authorizationHeader?: string;
  readonly now: Date;
  readonly verifier: StaffIdentityVerifier;
  readonly accessControl?: StaffAccessControl;
  readonly assignments: StaffAssignmentDirectory;
  readonly store: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly secureCookies: boolean;
};

export type RevokeStaffSessionRequest = {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly now: Date;
  readonly store: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly secureCookies: boolean;
};

export type ReadStaffSessionRequest = {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly store: StaffSessionStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly allowedOrigins: readonly string[];
};

export async function handleEstablishStaffSession(
  input: EstablishStaffSessionRequest,
): Promise<StaffSessionHttpResponse<Session>> {
  const correlation = resolveCorrelationId(input.correlationIdHeader);
  const headers = noStore(correlation.correlationId);
  if (!correlation.ok) {
    return fail(headers, authFailure("VALIDATION_ERROR", "X-Correlation-ID must be a UUID", correlation.correlationId));
  }
  if (!originAllowed(input.origin, input.referer, input.allowedOrigins)) {
    return fail(
      headers,
      authFailure("FORBIDDEN", "session origin is not allowed", correlation.correlationId),
    );
  }
  try {
    const established = await establishStaffSession({
      accessToken: readBearer(input.authorizationHeader),
      now: input.now,
      verifier: input.verifier,
      accessControl: input.accessControl,
      store: input.store,
      correlationId: correlation.correlationId,
      secureCookies: input.secureCookies,
    });
    if (!established.ok) {
      return fail(headers, established);
    }
    const assignments = await input.assignments.lookup({
      actorId: established.data.session.actorId,
      organizationId: established.data.session.organizationId,
    });
    if (assignments === "unavailable") {
      await input.store.revoke(established.data.sessionId);
      return fail(
        headers,
        authFailure(
          "INTEGRATION_UNAVAILABLE",
          "staff assignment directory is unavailable",
          correlation.correlationId,
        ),
      );
    }
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          ...established.data.session,
          locationIds: [...assignments.locationIds],
        },
        correlationId: correlation.correlationId,
      },
      cookies: established.data.cookies,
      headers,
    };
  } catch {
    return fail(
      headers,
      authFailure("INTEGRATION_UNAVAILABLE", "staff session store is unavailable", correlation.correlationId),
    );
  }
}

export async function handleRevokeStaffSession(
  input: RevokeStaffSessionRequest,
): Promise<StaffSessionHttpResponse<SignOutResult>> {
  const correlation = resolveCorrelationId(input.correlationIdHeader);
  const headers = noStore(correlation.correlationId);
  if (!correlation.ok) {
    return fail(headers, authFailure("VALIDATION_ERROR", "X-Correlation-ID must be a UUID", correlation.correlationId));
  }
  if (!originAllowed(input.origin, input.referer, input.allowedOrigins)) {
    return fail(headers, authFailure("FORBIDDEN", "session origin is not allowed", correlation.correlationId));
  }

  const cookies = parseCookieHeader(input.cookieHeader);
  const sessionId = cookies[STAFF_SESSION_COOKIE];
  if (sessionId) {
    const csrfCookie = cookies[STAFF_CSRF_COOKIE] ?? null;
    const csrfHeader = input.csrfHeader ?? null;
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return fail(
        headers,
        authFailure("FORBIDDEN", "mutation requires matching CSRF cookie and header", correlation.correlationId),
      );
    }
    try {
      const stored = await input.store.get(sessionId, input.now);
      if (stored && stored.csrfToken !== csrfHeader) {
        return fail(
          headers,
          authFailure("FORBIDDEN", "CSRF token is not associated with this staff session", correlation.correlationId),
        );
      }
    } catch {
      return fail(
        headers,
        authFailure("INTEGRATION_UNAVAILABLE", "staff session store is unavailable", correlation.correlationId),
      );
    }
  }

  try {
    const revoked = await revokeStaffSession({
      cookieHeader: input.cookieHeader,
      store: input.store,
      now: input.now,
      correlationId: correlation.correlationId,
      secureCookies: input.secureCookies,
    });
    preserveLocalWorkOnSignOut({ drafts: [], journal: [] });
    return {
      status: 200,
      body: {
        ok: true,
        data: { signedOut: true, localWorkPreserved: true },
        correlationId: correlation.correlationId,
      },
      cookies: revoked.cookies,
      headers,
    };
  } catch {
    return fail(
      headers,
      authFailure("INTEGRATION_UNAVAILABLE", "staff session store is unavailable", correlation.correlationId),
    );
  }
}

export async function handleReadStaffSession(
  input: ReadStaffSessionRequest,
): Promise<StaffSessionHttpResponse<StaffSessionContext>> {
  const correlation = resolveCorrelationId(input.correlationIdHeader);
  const headers = noStore(correlation.correlationId);
  if (!correlation.ok) {
    return fail(headers, authFailure("VALIDATION_ERROR", "X-Correlation-ID must be a UUID", correlation.correlationId));
  }
  if (!originAllowedForRead(input.origin, input.referer, input.allowedOrigins)) {
    return fail(
      headers,
      authFailure("FORBIDDEN", "session origin is not allowed", correlation.correlationId),
    );
  }

  const cookies = parseCookieHeader(input.cookieHeader);
  const sessionId = cookies[STAFF_SESSION_COOKIE];
  if (!sessionId) {
    return fail(headers, authFailure("AUTH_REQUIRED", "staff session is required", correlation.correlationId));
  }

  let stored = null;
  try {
    stored = await input.store.get(sessionId, input.now);
  } catch {
    return fail(
      headers,
      authFailure("INTEGRATION_UNAVAILABLE", "staff session store is unavailable", correlation.correlationId),
    );
  }
  if (!stored) {
    return fail(
      headers,
      authFailure("AUTH_REQUIRED", "staff session is expired or revoked", correlation.correlationId, { field: "session" }),
    );
  }

  let assignedLocationIds: readonly string[] = [];
  let assignedRegisterIds: readonly string[] = [];
  try {
    const assignments = await input.assignments.lookup({
      actorId: stored.session.actorId,
      organizationId: stored.session.organizationId,
    });
    if (assignments === "unavailable") {
      return fail(
        headers,
        authFailure("INTEGRATION_UNAVAILABLE", "staff assignment directory is unavailable", correlation.correlationId, {
          field: "assignments",
        }),
      );
    }
    assignedLocationIds = [...new Set(assignments.locationIds)];
    assignedRegisterIds = [...new Set(assignments.registerIds)];
  } catch {
    return fail(
      headers,
      authFailure("INTEGRATION_UNAVAILABLE", "staff assignment directory is unavailable", correlation.correlationId, {
        field: "assignments",
      }),
    );
  }

  return {
    status: 200,
    body: {
      ok: true,
      data: {
        session: {
          ...stored.session,
          locationIds: [...assignedLocationIds],
        },
        assignedLocationIds,
        assignedRegisterIds,
        mustChangePassword: stored.mustChangePassword === true,
      },
      correlationId: correlation.correlationId,
    },
    cookies: [],
    headers,
  };
}

function originAllowedForRead(
  origin: string | null,
  referer: string | null,
  allowedOrigins: readonly string[],
): boolean {
  const resolved = origin ?? originFromReferer(referer);
  if (!resolved) {
    return true;
  }
  return allowedOrigins.includes(resolved);
}

function originAllowed(
  origin: string | null,
  referer: string | null,
  allowedOrigins: readonly string[],
): boolean {
  const resolved = origin ?? originFromReferer(referer);
  return Boolean(resolved && allowedOrigins.includes(resolved));
}

function readBearer(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }
  const match = /^Bearer\s+(\S+)/i.exec(header.trim());
  return match?.[1];
}

function noStore(correlationId: Uuid): StaffSessionHttpHeaders {
  return { "Cache-Control": "no-store", "X-Correlation-ID": correlationId };
}

function fail<T>(
  headers: StaffSessionHttpHeaders,
  body: ApiResult<T> & { readonly ok: false },
): StaffSessionHttpResponse<T> {
  return {
    status: httpStatusFor(body.error.code),
    body,
    cookies: [],
    headers,
  };
}

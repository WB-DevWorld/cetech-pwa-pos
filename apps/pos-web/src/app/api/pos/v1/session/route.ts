import { NextResponse, type NextRequest } from "next/server";
import { readSupabaseAuthEnv, staffAllowedOrigins } from "../../../../../config/env";
import { composeStaffSessionStore } from "../../../../../server/auth/compose-session-store";
import {
  handleEstablishStaffSession,
  handleRevokeStaffSession,
} from "../../../../../server/auth/handle-staff-session";
import { staffCookieSecure } from "../../../../../server/auth/cookies";
import { createStaffIdentityVerifier } from "../../../../../server/auth/identity-verifier";
import { createSupabaseAuthIntrospector } from "../../../../../server/auth/supabase-auth";
import { createServerRestFetch } from "../../../../../server/http/server-fetch";
import { STAFF_CSRF_HEADER } from "../../../../../config/auth";
import { authFailure } from "../../../../../server/auth/errors";
import { resolveCorrelationId } from "../../../../../server/http/correlation";
import { httpStatusFor } from "../../../../../server/http/status";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const store = tryComposeStore();
  const verifier = tryComposeVerifier();
  if (!store || !verifier) {
    return unavailable(request);
  }
  const result = await handleEstablishStaffSession({
    correlationIdHeader: request.headers.get("x-correlation-id") ?? undefined,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    authorizationHeader: request.headers.get("authorization") ?? undefined,
    now: new Date(),
    verifier,
    store,
    allowedOrigins: staffAllowedOrigins(),
    secureCookies: staffCookieSecure(),
  });
  return withCookies(result);
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const store = tryComposeStore();
  if (!store) {
    return unavailable(request);
  }
  const result = await handleRevokeStaffSession({
    correlationIdHeader: request.headers.get("x-correlation-id") ?? undefined,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    cookieHeader: request.headers.get("cookie") ?? undefined,
    csrfHeader: request.headers.get(STAFF_CSRF_HEADER),
    now: new Date(),
    store,
    allowedOrigins: staffAllowedOrigins(),
    secureCookies: staffCookieSecure(),
  });
  return withCookies(result);
}

function tryComposeStore() {
  try {
    return composeStaffSessionStore(process.env, createServerRestFetch());
  } catch {
    return undefined;
  }
}

function tryComposeVerifier() {
  const authEnv = readSupabaseAuthEnv();
  if (!authEnv) {
    return undefined;
  }
  try {
    return createStaffIdentityVerifier(
      createSupabaseAuthIntrospector({
        supabaseUrl: authEnv.url,
        publishableKey: authEnv.publishableKey,
      }),
    );
  } catch {
    return undefined;
  }
}

function unavailable(request: NextRequest): NextResponse {
  const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
  const body = authFailure(
    "INTEGRATION_UNAVAILABLE",
    "staff session runtime is not configured",
    correlation.correlationId,
  );
  return NextResponse.json(body, {
    status: httpStatusFor(body.error.code),
    headers: { "Cache-Control": "no-store", "X-Correlation-ID": body.correlationId },
  });
}

function withCookies(result: {
  readonly status: number;
  readonly body: unknown;
  readonly cookies: readonly string[];
  readonly headers: Record<string, string>;
}): NextResponse {
  const response = NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
  for (const cookie of result.cookies) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}

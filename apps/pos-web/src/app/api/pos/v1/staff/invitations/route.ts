import { NextResponse, type NextRequest } from "next/server";
import { staffAllowedOrigins } from "../../../../../../config/env";
import { STAFF_CSRF_HEADER } from "../../../../../../config/auth";
import { composeStaffSessionStore } from "../../../../../../server/auth/compose-session-store";
import { handleInviteStaff } from "../../../../../../server/auth/invite-staff";
import { authFailure } from "../../../../../../server/auth/errors";
import { sendSupabaseStaffInvite } from "../../../../../../server/auth/supabase-staff-invite";
import { composeStaffAssignmentDirectory } from "../../../../../../server/sales/compose-assignment-directory";
import { createServerRestFetch } from "../../../../../../server/http/server-fetch";
import { resolveCorrelationId } from "../../../../../../server/http/correlation";
import { httpStatusFor } from "../../../../../../server/http/status";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const store = tryComposeStore();
  const assignments = tryComposeAssignments();
  if (!store || !assignments) {
    return unavailable(request);
  }
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const result = await handleInviteStaff({
    correlationIdHeader: request.headers.get("x-correlation-id") ?? undefined,
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    cookieHeader: request.headers.get("cookie") ?? undefined,
    csrfHeader: request.headers.get(STAFF_CSRF_HEADER),
    body,
    now: new Date(),
    store,
    assignments,
    allowedOrigins: staffAllowedOrigins(),
    env: process.env,
    deliver: sendSupabaseStaffInvite,
  });
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

function tryComposeStore() {
  try {
    return composeStaffSessionStore(process.env, createServerRestFetch());
  } catch {
    return undefined;
  }
}

function tryComposeAssignments() {
  try {
    return composeStaffAssignmentDirectory(process.env, createServerRestFetch());
  } catch {
    return undefined;
  }
}

function unavailable(request: NextRequest): NextResponse {
  const correlation = resolveCorrelationId(request.headers.get("x-correlation-id") ?? undefined);
  const body = authFailure(
    "INTEGRATION_UNAVAILABLE",
    "staff invitation runtime is not configured",
    correlation.correlationId,
  );
  return NextResponse.json(body, {
    status: httpStatusFor(body.error.code),
    headers: { "Cache-Control": "no-store", "X-Correlation-ID": body.correlationId },
  });
}

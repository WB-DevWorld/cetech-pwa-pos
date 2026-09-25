export type SupabaseStaffInviteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "already_registered" | "unavailable" };

/**
 * GoTrue Admin invite. redirectTo is a query parameter, never taken from the
 * browser. Response bodies are not copied into errors or logs.
 */
export async function sendSupabaseStaffInvite(input: {
  readonly supabaseUrl: string;
  readonly serviceRoleKey: string;
  readonly email: string;
  readonly redirectTo: string;
  readonly fetchImpl?: typeof fetch;
}): Promise<SupabaseStaffInviteResult> {
  const endpoint = new URL("/auth/v1/invite", input.supabaseUrl);
  endpoint.searchParams.set("redirect_to", input.redirectTo);
  try {
    const response = await (input.fetchImpl ?? fetch)(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.serviceRoleKey}`,
        apikey: input.serviceRoleKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: input.email }),
    });
    if (response.ok) {
      return { ok: true };
    }
    const errorCode = await readErrorCode(response);
    if (errorCode === "email_exists" || errorCode === "user_already_exists") {
      return { ok: false, reason: "already_registered" };
    }
    return { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

async function readErrorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { readonly error_code?: unknown; readonly msg?: unknown };
    if (typeof body.error_code === "string" && body.error_code.trim()) {
      return body.error_code.trim();
    }
    if (typeof body.msg === "string" && body.msg.toLowerCase().includes("already been registered")) {
      return "email_exists";
    }
    return "";
  } catch {
    return "";
  }
}

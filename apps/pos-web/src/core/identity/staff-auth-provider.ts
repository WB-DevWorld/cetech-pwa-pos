import { readPublicStaffAuthEnv } from "../../config/env";

export type StaffSignInRequest = {
  readonly email?: string;
  readonly password?: string;
};

export type StaffAuthProvider = {
  signIn(request?: StaffSignInRequest): Promise<{ readonly accessToken: string }>;
  signOut(): Promise<void>;
};

type FetchLike = typeof fetch;

export type PublicSupabaseStaffAuthOptions = {
  readonly fetchImpl?: FetchLike;
  readonly env?: Readonly<Record<string, string | undefined>>;
};

/**
 * Transitional Identity adapter. Browser uses the publishable Auth key only.
 * Access tokens are exchanged for the BFF staff session and are not POS authority.
 * Later AccessLobby/OIDC can replace this adapter without changing IdentityPort.
 */
export function createPublicSupabaseStaffAuthProvider(
  options: PublicSupabaseStaffAuthOptions = {},
): StaffAuthProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async signIn(request) {
      const env = readPublicStaffAuthEnv(options.env);
      if (!env) {
        throw new StaffAuthError("identity provider is not configured");
      }
      const email = request?.email?.trim() ?? "";
      const password = request?.password ?? "";
      if (!email || !password) {
        throw new StaffAuthError("staff credentials are required");
      }
      const response = await fetchImpl(`${env.url.replace(/\/+$/, "")}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          apikey: env.publishableKey,
          authorization: `Bearer ${env.publishableKey}`,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        throw new StaffAuthError(
          response.status === 400 || response.status === 401
            ? "staff identity could not be verified"
            : "identity provider is unavailable",
        );
      }
      const payload = (await response.json()) as { access_token?: unknown };
      if (typeof payload.access_token !== "string" || payload.access_token.length < 1) {
        throw new StaffAuthError("identity provider did not return an access token");
      }
      if (payload.access_token.toUpperCase().includes("SERVICE_ROLE")) {
        throw new StaffAuthError("staff identity could not be verified");
      }
      return { accessToken: payload.access_token };
    },
    async signOut() {
      return;
    },
  };
}

export class StaffAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffAuthError";
  }
}

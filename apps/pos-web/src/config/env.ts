import { SERVER_ONLY_CONFIG_NAMES, SERVER_ONLY_SECRET_NAMES } from "./secrets";
import { parseAllowedOrigins } from "./auth";

export type ServerEnv = {
  readonly appOrigin: string;
  readonly supabaseUrl: string | undefined;
  readonly bridgeBaseUrl: string | undefined;
  readonly buildId: string;
};

export type BridgeServiceEnv = {
  readonly baseUrl: string;
  readonly username: string;
  readonly applicationPassword: string;
};

export type SupabaseAuthEnv = {
  readonly url: string;
  readonly publishableKey: string;
};

export type SupabaseInfrastructureEnv = {
  readonly url: string;
  readonly serviceRoleKey: string;
};

export function readServerEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ServerEnv {
  rejectPublicServerOnlyNames(env);
  return {
    appOrigin: resolveAppOrigin(env),
    supabaseUrl: env.SUPABASE_URL,
    bridgeBaseUrl: env.BRIDGE_BASE_URL,
    buildId: env.BUILD_ID ?? "local-dev",
  };
}

/**
 * Server-only WordPress application-password identity for the BFF → bridge hop.
 * Never serialize this object into a browser payload. Placeholders are treated as unset.
 */
export function readBridgeServiceEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): BridgeServiceEnv | null {
  rejectPublicServerOnlyNames(env);
  const baseUrl = env.BRIDGE_BASE_URL?.trim() ?? "";
  const username = env.BRIDGE_USERNAME?.trim() ?? "";
  const applicationPassword = env.BRIDGE_APPLICATION_PASSWORD?.trim() ?? "";
  if (!baseUrl || !username || !applicationPassword) {
    return null;
  }
  if (isUnusableCredential(baseUrl) || isUnusableCredential(username) || isUnusableCredential(applicationPassword)) {
    return null;
  }
  return { baseUrl, username, applicationPassword };
}

/**
 * Publishable/anon key for Auth introspection. Never a service-role key.
 * Presence of these names is not a health proof.
 */
export function readSupabaseAuthEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): SupabaseAuthEnv | null {
  rejectPublicServerOnlyNames(env);
  const url = env.SUPABASE_URL?.trim() ?? "";
  const publishableKey =
    env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    env.SUPABASE_ANON_KEY?.trim() ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";
  if (!url || !publishableKey) {
    return null;
  }
  if (isUnusableCredential(url) || isUnusableCredential(publishableKey) || publishableKey.toUpperCase().includes("SERVICE_ROLE")) {
    return null;
  }
  return { url, publishableKey };
}

/**
 * Browser-safe publishable Auth env. Never reads service-role or other
 * server-only secrets. Presence is not a health or session proof.
 */
export function readPublicStaffAuthEnv(
  env: Readonly<Record<string, string | undefined>> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
): SupabaseAuthEnv | null {
  rejectPublicServerOnlyNames(env);
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !publishableKey) {
    return null;
  }
  if (isUnusableCredential(url) || isUnusableCredential(publishableKey) || publishableKey.toUpperCase().includes("SERVICE_ROLE")) {
    return null;
  }
  return { url, publishableKey };
}

/**
 * Service-role / infrastructure credential for the BFF session store and
 * read-only health probe. This is not staff or cashier authorization.
 */
export function readSupabaseInfrastructureEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): SupabaseInfrastructureEnv | null {
  rejectPublicServerOnlyNames(env);
  const url = env.SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() || env.SUPABASE_SECRET_KEY?.trim() || "";
  if (!url || !serviceRoleKey) {
    return null;
  }
  if (isUnusableCredential(url) || isUnusableCredential(serviceRoleKey)) {
    return null;
  }
  return { url, serviceRoleKey };
}

export function staffAllowedOrigins(
  env: Readonly<Record<string, string | undefined>> = process.env,
): readonly string[] {
  const origin = resolveAppOrigin(env);
  const extra = parseAllowedOrigins(env.ALLOWED_ORIGINS).filter((candidate) => candidate !== origin);
  return [origin, ...extra];
}

function resolveAppOrigin(env: Readonly<Record<string, string | undefined>>): string {
  const explicit = env.APP_ORIGIN?.trim() || env.NEXT_PUBLIC_APP_ORIGIN?.trim();
  if (explicit) {
    return explicit;
  }

  const vercelUrl = env.VERCEL_URL?.trim();
  if (vercelUrl) {
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(vercelUrl) ? vercelUrl : `https://${vercelUrl}`;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "https:") {
        return parsed.origin;
      }
    } catch {
      // Ignore malformed platform metadata and retain the safe local fallback.
    }
  }

  return "http://localhost:3000";
}

function rejectPublicServerOnlyNames(env: Readonly<Record<string, string | undefined>>): void {
  for (const name of [...SERVER_ONLY_SECRET_NAMES, ...SERVER_ONLY_CONFIG_NAMES]) {
    const publicKey = `NEXT_PUBLIC_${name}`;
    if (env[publicKey]) {
      throw new Error("privileged server secret must not be exposed as public environment");
    }
  }
}

function isUnusableCredential(value: string): boolean {
  const upper = value.toUpperCase();
  return (
    upper.startsWith("REPLACE_WITH") ||
    upper.includes("PLACEHOLDER") ||
    upper === "CHANGE_ME" ||
    upper.includes("NOT_A_REAL")
  );
}

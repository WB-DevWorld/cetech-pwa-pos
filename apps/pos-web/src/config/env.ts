import { SERVER_ONLY_CONFIG_NAMES, SERVER_ONLY_SECRET_NAMES } from "./secrets";

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

export function readServerEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ServerEnv {
  rejectPublicServerOnlyNames(env);
  return {
    appOrigin: env.APP_ORIGIN ?? env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000",
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

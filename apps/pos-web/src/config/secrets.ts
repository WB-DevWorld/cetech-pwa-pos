/**
 * Server-only secret names. Never expose these through NEXT_PUBLIC_ or browser modules.
 * Names are a static boundary; this module does not load live credentials.
 */
export const SERVER_ONLY_SECRET_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY",
  "BRIDGE_APPLICATION_PASSWORD",
] as const;

/** Server-only config names that must not be copied to NEXT_PUBLIC_*. */
export const SERVER_ONLY_CONFIG_NAMES = ["BRIDGE_USERNAME"] as const;

const PUBLIC_PREFIX = "NEXT_PUBLIC_";

export function publicEnvLeaksServerSecret(
  env: Readonly<Record<string, string | undefined>>,
): readonly string[] {
  const leaks: string[] = [];
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith(PUBLIC_PREFIX) || !value) {
      continue;
    }
    const upper = `${key} ${value}`.toUpperCase();
    if (
      upper.includes("SERVICE_ROLE") ||
      SERVER_ONLY_SECRET_NAMES.some((name) => upper.includes(name)) ||
      SERVER_ONLY_CONFIG_NAMES.some((name) => upper.includes(name))
    ) {
      leaks.push(key);
    }
  }
  return leaks;
}

export function assertNoPublicServiceRole(env: Readonly<Record<string, string | undefined>>): void {
  const leaks = publicEnvLeaksServerSecret(env);
  if (leaks.length > 0) {
    throw new Error("privileged server secret must not be exposed as public environment");
  }
}

/**
 * Server-only secret names. Never expose these through NEXT_PUBLIC_ or browser modules.
 * CORE-02 does not load live credentials; this is a static boundary check.
 */
export const SERVER_ONLY_SECRET_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY",
] as const;

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
    if (upper.includes("SERVICE_ROLE") || SERVER_ONLY_SECRET_NAMES.some((name) => upper.includes(name))) {
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

/**
 * Explicit catalog source policy. Staging/production-intent never silently
 * fall back to the synthetic cashier seed.
 */
export type CatalogSourcePolicy = "synthetic_permitted" | "provider_required";

export type CatalogAppEnv = "local" | "test" | "demo" | "staging" | "production";

export function resolveCatalogAppEnv(appEnv: string | undefined): CatalogAppEnv {
  const raw = (appEnv ?? "local").trim().toLowerCase();
  if (raw === "staging" || raw === "production" || raw === "test" || raw === "demo") {
    return raw;
  }
  return "local";
}

export function resolveCatalogSourcePolicy(appEnv: string | undefined): CatalogSourcePolicy {
  const env = resolveCatalogAppEnv(appEnv);
  if (env === "staging" || env === "production") {
    return "provider_required";
  }
  return "synthetic_permitted";
}

export function catalogSourcePolicyAllowsSynthetic(policy: CatalogSourcePolicy): boolean {
  return policy === "synthetic_permitted";
}

/**
 * Browser-side policy. Localhost/test/demo may use the synthetic fixture.
 * Any other host is production-intent and must use a provider projection.
 * Does not read privileged secrets.
 */
export function resolveBrowserCatalogSourcePolicy(input: {
  readonly appEnv?: string;
  readonly nodeEnv?: string;
  readonly hostname?: string;
} = {}): CatalogSourcePolicy {
  if (input.appEnv !== undefined) {
    return resolveCatalogSourcePolicy(input.appEnv);
  }
  if ((input.nodeEnv ?? "").toLowerCase() === "test") {
    return "synthetic_permitted";
  }
  const hostname = (input.hostname ?? "").toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "") {
    return "synthetic_permitted";
  }
  return "provider_required";
}

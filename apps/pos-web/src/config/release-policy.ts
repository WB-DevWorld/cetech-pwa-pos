import type { ReleasePolicy } from "../../../../docs/contracts/domain.generated";

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Server-owned release policy. The browser receives only this non-secret policy
 * and the canonical BUILD_ID; no privileged environment values are exposed.
 */
export function readReleasePolicy(
  env: Readonly<Record<string, string | undefined>> = process.env,
  buildId: string = env.BUILD_ID ?? "local-dev",
): ReleasePolicy {
  return {
    latestBuild: env.RELEASE_LATEST_BUILD ?? buildId,
    recommendedBuild: env.RELEASE_RECOMMENDED_BUILD ?? env.RELEASE_LATEST_BUILD ?? buildId,
    minimumSupportedBuild: env.RELEASE_MINIMUM_SUPPORTED_BUILD ?? buildId,
    criticalBuild: env.RELEASE_CRITICAL_BUILD || undefined,
    minimumApiVersion: env.RELEASE_MINIMUM_API_VERSION ?? "1.0.0",
    minimumLocalSchema: positiveInteger(env.RELEASE_MINIMUM_LOCAL_SCHEMA, 4),
  };
}

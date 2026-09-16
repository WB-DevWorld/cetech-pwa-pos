import type { ReleasePolicy } from "../../../../docs/contracts/domain.generated";

export const RELEASE_POLICY_PATH = "/api/pos/v1/release-policy";

export function isReleasePolicy(value: unknown): value is ReleasePolicy {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.latestBuild === "string" &&
    record.latestBuild.length > 0 &&
    typeof record.recommendedBuild === "string" &&
    typeof record.minimumSupportedBuild === "string" &&
    typeof record.minimumApiVersion === "string" &&
    typeof record.minimumLocalSchema === "number" &&
    Number.isInteger(record.minimumLocalSchema) &&
    (record.criticalBuild === undefined || typeof record.criticalBuild === "string")
  );
}

export async function fetchReleasePolicy(
  fetchImpl: typeof fetch = fetch,
): Promise<ReleasePolicy | null> {
  try {
    const response = await fetchImpl(RELEASE_POLICY_PATH, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { "x-correlation-id": crypto.randomUUID() },
    });
    const body = (await response.json()) as { ok?: boolean; data?: unknown };
    if (!response.ok || body.ok !== true || !isReleasePolicy(body.data)) {
      return null;
    }
    return body.data;
  } catch {
    return null;
  }
}

export function serviceWorkerUrlForBuild(buildId: string): string {
  return `/sw.js?build=${encodeURIComponent(buildId)}`;
}

export function sameWorkerUrl(left: string | undefined, right: string): boolean {
  if (!left) {
    return false;
  }
  try {
    const base = "https://cetech-pos.local";
    const a = new URL(left, base);
    const b = new URL(right, base);
    return a.pathname === b.pathname && a.search === b.search;
  } catch {
    return left === right;
  }
}

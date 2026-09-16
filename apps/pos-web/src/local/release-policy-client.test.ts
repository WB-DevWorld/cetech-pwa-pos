import { describe, expect, test, vi } from "vitest";
import { fetchReleasePolicy, RELEASE_POLICY_PATH, serviceWorkerUrlForBuild } from "./release-policy-client";

describe("release-policy client", () => {
  test("fetches the same-origin policy with credentials and no-store", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(RELEASE_POLICY_PATH);
      expect(init?.method).toBe("GET");
      expect(init?.cache).toBe("no-store");
      expect(init?.credentials).toBe("include");
      return new Response(
        JSON.stringify({
          ok: true,
          correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          data: {
            latestBuild: "2.0.0",
            recommendedBuild: "2.0.0",
            minimumSupportedBuild: "1.0.0",
            minimumApiVersion: "1.0.0",
            minimumLocalSchema: 4,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    await expect(fetchReleasePolicy(fetchImpl)).resolves.toMatchObject({ latestBuild: "2.0.0" });
    expect(serviceWorkerUrlForBuild("2.0.0")).toBe("/sw.js?build=2.0.0");
  });
});

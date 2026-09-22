import { describe, expect, test } from "vitest";
import { handleReleasePolicy } from "./handle-release-policy";

const POLICY = {
  latestBuild: "1.0.1",
  recommendedBuild: "1.0.1",
  minimumSupportedBuild: "1.0.0",
  minimumApiVersion: "1.0.0",
  minimumLocalSchema: 4,
} as const;

describe("release-policy discovery endpoint", () => {
  test("returns the existing ReleasePolicy contract with no-store caching", () => {
    const result = handleReleasePolicy({
      correlationIdHeader: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      policy: POLICY,
    });
    expect(result.status).toBe(200);
    expect(result.headers["Cache-Control"]).toBe("no-store");
    expect(result.body).toEqual({
      ok: true,
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      data: POLICY,
    });
  });

  test("rejects a missing correlation id without inventing a second release model", () => {
    const result = handleReleasePolicy({ policy: POLICY });
    expect(result.status).toBe(400);
    expect(result.body.ok).toBe(false);
  });
});

import { describe, expect, test } from "vitest";
import { readReleasePolicy } from "./release-policy";

describe("R9 release policy", () => {
  test("defaults the policy to the canonical build without inventing unsupported-version drift", () => {
    expect(readReleasePolicy({}, "2.4.0")).toEqual({
      latestBuild: "2.4.0",
      recommendedBuild: "2.4.0",
      minimumSupportedBuild: "2.4.0",
      criticalBuild: undefined,
      minimumApiVersion: "1.0.0",
      minimumLocalSchema: 4,
    });
  });

  test("binds configured minimum supported build and local schema", () => {
    expect(
      readReleasePolicy(
        {
          RELEASE_LATEST_BUILD: "2.6.0",
          RELEASE_RECOMMENDED_BUILD: "2.5.0",
          RELEASE_MINIMUM_SUPPORTED_BUILD: "2.3.0",
          RELEASE_CRITICAL_BUILD: "2.4.0",
          RELEASE_MINIMUM_API_VERSION: "1.0.0",
          RELEASE_MINIMUM_LOCAL_SCHEMA: "4",
        },
        "2.4.1",
      ),
    ).toEqual({
      latestBuild: "2.6.0",
      recommendedBuild: "2.5.0",
      minimumSupportedBuild: "2.3.0",
      criticalBuild: "2.4.0",
      minimumApiVersion: "1.0.0",
      minimumLocalSchema: 4,
    });
  });
});

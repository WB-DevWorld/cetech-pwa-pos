import { describe, expect, test } from "vitest";
import { catalogRebuildStatusText } from "./catalog-rebuild-status";

describe("STG-06 catalog rebuild status copy", () => {
  test("describes rebuilding, success with item count, and retryable failure", () => {
    expect(catalogRebuildStatusText({ phase: "idle" })).toBeUndefined();
    expect(catalogRebuildStatusText({ phase: "rebuilding" })).toBe("Rebuilding catalog…");
    expect(
      catalogRebuildStatusText({ phase: "success", itemCount: 12, availability: "fresh" }),
    ).toContain("12 items");
    expect(catalogRebuildStatusText({ phase: "failure", message: "producer denied" })).toContain(
      "Retry Rebuild Catalog",
    );
  });
});

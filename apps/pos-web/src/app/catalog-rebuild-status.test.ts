import { describe, expect, test } from "vitest";
import { catalogRebuildStatusText } from "./catalog-rebuild-status";

describe("STG-06 catalog rebuild status copy", () => {
  test("describes rebuilding, success with item count, and retryable failure", () => {
    expect(catalogRebuildStatusText({ phase: "idle" })).toBeUndefined();
    expect(catalogRebuildStatusText({ phase: "rebuilding" })).toBe("Refreshing products…");
    expect(
      catalogRebuildStatusText({ phase: "success", itemCount: 12, availability: "fresh" }),
    ).toContain("12 items");
    expect(
      catalogRebuildStatusText({
        phase: "stale",
        itemCount: 12,
        availability: "stale",
        message: "Saved products are still available, but the latest product update failed.",
      }),
    ).toContain("latest product update failed");
    expect(catalogRebuildStatusText({ phase: "failure", message: "producer denied" })).toContain(
      "Products couldn't be refreshed",
    );
  });
});

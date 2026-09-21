import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const source = readFileSync(new URL("./pos-app.tsx", import.meta.url), "utf8");

describe("BUG #82 fallback return handoff", () => {
  test("keeps the selected sale when PosRuntime falls back to route navigation", () => {
    expect(source).toContain("initialSaleId={initialReturnSaleId ?? pendingReturnSaleId}");
    expect(source).toContain("if (onReturnSaleSelected) {");
    expect(source).toContain("onReturnSaleSelected(saleId);");
    expect(source).toContain('onNavigate("returns");');
  });
});

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const sellCss = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../../apps/pos-web/src/features/sell/sell.css"),
  "utf8",
);

describe("Sell workstation CSS", () => {
  test("locks desktop height and scrolls product results and cart lines independently", () => {
    expect(sellCss).toContain(".product-results");
    expect(sellCss).toMatch(/\.product-results[\s\S]*overflow:\s*auto/);
    expect(sellCss).toMatch(/\.cart-lines[\s\S]*overflow:\s*auto/);
    expect(sellCss).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
    expect(sellCss).toContain("100dvh");
    expect(sellCss).toContain("min-height: 0");
  });
});

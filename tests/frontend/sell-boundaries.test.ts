import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sellRoot = resolve(repoRoot, "apps/pos-web/src/features/sell");

function collectSource(dir: string): string {
  let out = "";
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out += collectSource(path);
    else if (/\.(tsx|ts|css)$/.test(entry.name) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx")) {
      out += `\n/* ${path} */\n` + readFileSync(path, "utf8");
    }
  }
  return out;
}

describe("FE-03 sell layer stays presentation-only", () => {
  const source = collectSource(sellRoot);

  test("does not copy privileged contracts or import docs/contracts", () => {
    expect(source).not.toMatch(/from ["']docs\/contracts/);
    expect(source).not.toMatch(/from ["']@\/contracts/);
    expect(source).not.toMatch(/\b(export\s+)?(type|interface)\s+CatalogPort\b/);
    expect(source).not.toMatch(/\b(export\s+)?(type|interface)\s+CustomerPort\b/);
    expect(source).not.toMatch(/\b(export\s+)?(type|interface)\s+CartDraftStore\b/);
    expect(source).not.toMatch(/\b(export\s+)?(type|interface)\s+CustomerContext\b/);
    expect(source).not.toMatch(/\b(export\s+)?(type|interface)\s+CartDraft\b/);
  });

  test("does not embed Woo/WoodMart/B2BKing/VitePOS logic", () => {
    expect(source.toLowerCase()).not.toContain("woocommerce");
    expect(source.toLowerCase()).not.toContain("woodmart");
    expect(source.toLowerCase()).not.toContain("b2bking");
    expect(source.toLowerCase()).not.toContain("vitepos");
    expect(source).not.toContain("pricingKey");
    expect(source).not.toContain("groupLabel");
  });

  test("does not coerce barcodes through Number or parseInt", () => {
    expect(source).not.toMatch(/Number\([^)]*barcode/i);
    expect(source).not.toMatch(/parseInt\([^)]*barcode/i);
    expect(source).not.toMatch(/parseFloat\([^)]*barcode/i);
  });

  test("gates the keyboard-wedge scanner while a Sell modal is open", () => {
    const sellScreenSource = readFileSync(join(sellRoot, "SellScreen.tsx"), "utf8");
    expect(sellScreenSource).toContain("useBarcodeScanner(scanBarcode, !modalOpen)");
    expect(sellScreenSource).not.toMatch(/useBarcodeScanner\(scanBarcode\);/);
  });
});

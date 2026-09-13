import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const runtimeRoot = resolve(repoRoot, "apps/pos-web/src/features/sell/runtime");

function collectSource(dir: string): string {
  let out = "";
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out += collectSource(path);
    else if (/\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx")) {
      out += readFileSync(path, "utf8");
    }
  }
  return out;
}

describe("FE-03 runtime consumes ports without privileged layers", () => {
  const source = collectSource(runtimeRoot);

  test("imports frozen CatalogPort/CustomerPort/CartDraftStore and does not import local/server/config", () => {
    expect(source).toContain("CatalogPort");
    expect(source).toContain("CustomerPort");
    expect(source).toContain("CartDraftStore");
    expect(source).not.toMatch(/from ["']@\/local/);
    expect(source).not.toMatch(/from ["']@\/server/);
    expect(source).not.toMatch(/from ["']@\/config/);
    expect(source).not.toMatch(/from ["']@\/core/);
    expect(source.toLowerCase()).not.toContain("woocommerce");
    expect(source.toLowerCase()).not.toContain("woodmart");
    expect(source.toLowerCase()).not.toContain("b2bking");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});

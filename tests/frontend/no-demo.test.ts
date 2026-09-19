import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function collectSource(dir: string): string {
  let out = "";
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out += collectSource(path);
    else if (/\.(tsx|ts|css)$/.test(entry.name) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx")) {
      out += readFileSync(path, "utf8");
    }
  }
  return out;
}

describe("FE-02 production shell has no demo-only controls", () => {
  test("does not ship Demo FAB, demo staff, or localStorage auth", () => {
    const source = collectSource(resolve(repoRoot, "apps/pos-web/src/ui")) + collectSource(resolve(repoRoot, "apps/pos-web/src/features"));
    expect(source).not.toContain("Demo controls");
    expect(source).not.toContain("demo-fab");
    expect(source).not.toContain("Ama Mensah");
    expect(source).not.toContain("Kofi Asare");
    expect(source).not.toMatch(/localStorage\.(get|set)Item\([^)]*(auth|session|token|password)/i);
  });
});

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../apps/pos-web/src/app/api/pos/v1");

describe("R8-01 frozen return BFF routes", () => {
  test("canonical return route modules exist", () => {
    expect(existsSync(resolve(root, "returns/preview/route.ts"))).toBe(true);
    expect(existsSync(resolve(root, "returns/execute/route.ts"))).toBe(true);
    expect(existsSync(resolve(root, "returns/[returnId]/route.ts"))).toBe(true);
  });
});

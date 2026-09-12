import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tokens = readFileSync(resolve(repoRoot, "apps/pos-web/src/ui/tokens.css"), "utf8");
const shell = readFileSync(resolve(repoRoot, "apps/pos-web/src/ui/shell/shell.css"), "utf8");

describe("FE-02 design tokens and shell CSS", () => {
  test("defines the approved semantic color, space, radius, and touch tokens", () => {
    for (const token of [
      "--color-bg:",
      "--color-surface:",
      "--color-surface-2:",
      "--color-surface-3:",
      "--color-text:",
      "--color-text-muted:",
      "--color-border:",
      "--color-primary:",
      "--color-success:",
      "--color-warning:",
      "--color-danger:",
      "--color-info:",
      "--space-1: 4px",
      "--radius-sm: 8px",
      "--radius-md: 12px",
      "--radius-lg: 18px",
      "--touch: 44px",
    ]) {
      expect(tokens).toContain(token);
    }
    expect(tokens).toContain("--color-primary: #174ea6");
    expect(tokens).toContain("min-height: 54px");
    expect(tokens).toContain("outline: 3px solid");
    expect(tokens).toContain("outline-offset: 2px");
    expect(tokens).toContain("prefers-reduced-motion: reduce");
    expect(tokens).toContain("animation-duration: 0.001ms");
    expect(tokens).toContain("transition-duration: 0.001ms");
  });

  test("defines approved responsive breakpoints and phone bottom navigation", () => {
    expect(shell).toContain("@media (max-width: 1050px)");
    expect(shell).toContain("@media (max-width: 820px)");
    expect(shell).toContain("@media (max-width: 480px)");
    expect(shell).toContain("bottom: 0");
    expect(shell).toContain("padding-bottom: 68px");
    expect(shell).not.toContain("demo-fab");
    expect(shell).not.toContain("Demo controls");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const workspaceSource = readFileSync(new URL("../../apps/pos-web/src/app/workspace-runtime.tsx", import.meta.url), "utf8");
const surfaceSource = readFileSync(new URL("../../apps/pos-web/src/ui/operational/OperationalSurfaces.tsx", import.meta.url), "utf8");
const settingsSource = readFileSync(new URL("../../apps/pos-web/src/features/settings/SettingsScreen.tsx", import.meta.url), "utf8");

describe("R9 recovery on the accepted STG-01 operational surface", () => {
  test("System status remains the cashier surface and includes non-destructive recovery", () => {
    expect(surfaceSource).toContain("System status");
    expect(surfaceSource).not.toContain(">Store Health<");
    expect(settingsSource).toContain("Open System status");
    expect(workspaceSource).toContain("inspectLocalRecoveryState");
    expect(workspaceSource).toContain("Saved work & recovery");
    expect(workspaceSource).toContain("Do not clear saved carts or pending work");
    expect(workspaceSource).toContain("lifecycle.checkForUpdate()");
  });

  test("R9 lifecycle augments rather than replaces STG-01 workspaces", () => {
    expect(workspaceSource).toContain("OrdersWorkspace");
    expect(workspaceSource).toContain("CustomersWorkspace");
    expect(workspaceSource).toContain("HealthWorkspace");
    expect(workspaceSource).toContain("NeedsAttentionScreen");
    expect(workspaceSource).not.toContain("HealthRuntime");
  });
});

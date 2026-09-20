import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const workspaceSource = readFileSync(new URL("../../apps/pos-web/src/app/workspace-runtime.tsx", import.meta.url), "utf8");
const surfaceSource = readFileSync(new URL("../../apps/pos-web/src/ui/operational/OperationalSurfaces.tsx", import.meta.url), "utf8");
const settingsSource = readFileSync(new URL("../../apps/pos-web/src/features/settings/SettingsScreen.tsx", import.meta.url), "utf8");
const posAppSource = readFileSync(new URL("../../apps/pos-web/src/app/pos-app.tsx", import.meta.url), "utf8");
const attentionRecoverySource = readFileSync(new URL("../../apps/pos-web/src/app/attention-recovery.ts", import.meta.url), "utf8");

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

  test("mounted runtime discovers local journal recovery after reload and blocks new checkout until resolved", () => {
    expect(posAppSource).toContain("loadLocalJournalAttentionItems(recoveryJournal)");
    expect(posAppSource).toContain("mergeAttentionItems(serverAttention, effectiveLocalAttention, extras)");
    expect(posAppSource).toContain("hasBlockingLocalTransactionRecovery(localAttention)");
    expect(posAppSource).toContain("checkout: undefined, payments: undefined, sales: undefined");
    expect(posAppSource).toContain('data-local-recovery-blocked="true"');
    expect(posAppSource).toContain('void loadAttention("refresh")');
    expect(attentionRecoverySource).toContain('id: `local-journal:${row.id}`');
    expect(attentionRecoverySource).toContain("transactionId: row.transactionId");
    expect(attentionRecoverySource).toContain('recoverKind === "payment" ? "Payment needs a status check" : "Sale needs a status check"');
  });

  test("R9 lifecycle augments rather than replaces STG-01 workspaces", () => {
    expect(workspaceSource).toContain("OrdersWorkspace");
    expect(workspaceSource).toContain("CustomersWorkspace");
    expect(workspaceSource).toContain("HealthWorkspace");
    expect(workspaceSource).toContain("NeedsAttentionScreen");
    expect(workspaceSource).not.toContain("HealthRuntime");
  });
});

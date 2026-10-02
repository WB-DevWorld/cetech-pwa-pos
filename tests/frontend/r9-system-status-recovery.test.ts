import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const workspaceSource = readFileSync(new URL("../../apps/pos-web/src/app/workspace-runtime.tsx", import.meta.url), "utf8");
const surfaceSource = readFileSync(new URL("../../apps/pos-web/src/ui/operational/OperationalSurfaces.tsx", import.meta.url), "utf8");
const settingsSource = readFileSync(new URL("../../apps/pos-web/src/features/settings/SettingsScreen.tsx", import.meta.url), "utf8");
const posAppSource = readFileSync(new URL("../../apps/pos-web/src/app/pos-app.tsx", import.meta.url), "utf8");
const attentionRecoverySource = readFileSync(new URL("../../apps/pos-web/src/app/attention-recovery.ts", import.meta.url), "utf8");
const recoveryScopeSource = readFileSync(new URL("../../apps/pos-web/src/local/journal-recovery-scope.ts", import.meta.url), "utf8");

describe("R9 recovery on the accepted STG-01 operational surface", () => {
  test("System status remains the cashier surface and includes non-destructive recovery", () => {
    expect(surfaceSource).toContain("System status");
    expect(surfaceSource).not.toContain(">Store Health<");
    expect(settingsSource).toContain("Open System status");
    expect(workspaceSource).toContain("inspectLocalRecoveryState");
    expect(workspaceSource).toContain("Saved work");
    expect(workspaceSource).toContain("Do not clear the current sale or pending work");
    expect(workspaceSource).toContain("Current sale saved");
    expect(workspaceSource).toContain("recovery.recoverableCartCount > 0");
    expect(workspaceSource).toContain("lifecycle.checkForUpdate()");
  });

  test("mounted runtime discovers local journal recovery after reload and blocks new checkout until resolved", () => {
    expect(posAppSource).toContain("loadLocalJournalAttentionItems(recoveryJournal,");
    expect(posAppSource).toContain("openPosLocalDatabase()");
    expect(posAppSource).toContain("mergeAttentionItems(serverAttention, effectiveLocalAttention, extras)");
    expect(posAppSource).toContain("checkoutBlockedByLocalRecovery(");
    expect(posAppSource).toContain("recoveryScanGate.current.isCurrent(token)");
    expect(posAppSource).toContain("checkout: undefined, payments: undefined, sales: undefined");
    expect(posAppSource).toContain("const recoveryTenderActivity = useMemo");
    expect(posAppSource).toContain("tenderActivity: recoveryTenderActivity");
    expect(posAppSource).toContain('data-local-recovery-blocked="true"');
    expect(posAppSource).toContain("createBurstRefresh");
    expect(posAppSource).toContain('loadAttention("refresh")');
    expect(attentionRecoverySource).toContain('id: `local-journal:${row.id}`');
    expect(attentionRecoverySource).toContain("transactionId: row.transactionId");
    expect(recoveryScopeSource).toContain("Payment needs a status check");
    expect(recoveryScopeSource).toContain("Sale needs a status check");
  });

  test("R9 lifecycle augments rather than replaces STG-01 workspaces", () => {
    expect(workspaceSource).toContain("OrdersWorkspace");
    expect(workspaceSource).toContain("CustomersWorkspace");
    expect(workspaceSource).toContain("HealthWorkspace");
    expect(workspaceSource).toContain("NeedsAttentionScreen");
    expect(workspaceSource).not.toContain("HealthRuntime");
  });
});

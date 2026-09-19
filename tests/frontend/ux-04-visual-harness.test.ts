import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  buildBaselineAttentionHtml,
  buildBaselineCustomersHtml,
  buildBaselineHealthHtml,
  buildBaselineOrdersHtml,
  buildBaselineRegisterHtml,
  buildBaselineReturnsHtml,
  buildBaselineSettingsHtml,
} from "./visual/build-ux04-baseline-harness";
import {
  buildUx04AttentionHtml,
  buildUx04CustomersHtml,
  buildUx04HealthHtml,
  buildUx04HealthToastHtml,
  buildUx04OrdersHtml,
  buildUx04RegisterHtml,
  buildUx04RegisterOpenedToastHtml,
  buildUx04ReturnsHtml,
  buildUx04SettingsHtml,
} from "./visual/build-ux04-harness";

const evidenceDir = resolve(dirname(fileURLToPath(import.meta.url)), "evidence");

function write(name: string, html: string): void {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(resolve(evidenceDir, name), html);
}

describe("UX-04 visual harness markup", () => {
  test("writes baseline operational HTML evidence", () => {
    write("ux-04-baseline-settings-1920.html", buildBaselineSettingsHtml());
    write("ux-04-baseline-attention-1920.html", buildBaselineAttentionHtml());
    write("ux-04-baseline-health-1920.html", buildBaselineHealthHtml());
    write("ux-04-baseline-register-1920.html", buildBaselineRegisterHtml());
    write("ux-04-baseline-orders-1920.html", buildBaselineOrdersHtml());
    write("ux-04-baseline-customers-1920.html", buildBaselineCustomersHtml());
    write("ux-04-baseline-returns-1920.html", buildBaselineReturnsHtml());
    expect(buildBaselineSettingsHtml()).toContain("Settings");
  });

  test("writes target operational HTML evidence without production demo controls", () => {
    const settings = buildUx04SettingsHtml();
    const attention = buildUx04AttentionHtml();
    const health = buildUx04HealthHtml();
    const healthToast = buildUx04HealthToastHtml();
    const register = buildUx04RegisterHtml();
    const registerOpened = buildUx04RegisterOpenedToastHtml();
    const orders = buildUx04OrdersHtml();
    const customers = buildUx04CustomersHtml();
    const returns = buildUx04ReturnsHtml();
    write("ux-04-settings.html", settings);
    write("ux-04-attention.html", attention);
    write("ux-04-health.html", health);
    write("ux-04-health-toast.html", healthToast);
    write("ux-04-register.html", register);
    write("ux-04-register-opened.html", registerOpened);
    write("ux-04-orders.html", orders);
    write("ux-04-customers.html", customers);
    write("ux-04-returns.html", returns);
    expect(settings).toContain("Device &amp; register");
    expect(settings).toContain("Open Store Health");
    expect(attention).toContain("Check / Recover");
    expect(attention).toContain("MEDIUM");
    expect(health).toContain("Store Health");
    expect(health).not.toContain("Simulate update ready");
    expect(healthToast).toContain("Rebuildable catalog projection refreshed.");
    expect(register).toContain("Open register");
    expect(registerOpened).toContain("Register opened.");
    expect(registerOpened).toContain("Shift open");
    expect(orders).toContain("New sale");
    expect(customers).toContain("Use for next sale");
    expect(returns).toContain("Return items");
    const combined = `${settings}${attention}${health}${register}${orders}${customers}${returns}`;
    expect(combined).not.toContain("Demo controls");
    expect(combined).not.toContain("Simulate update ready");
  });
});

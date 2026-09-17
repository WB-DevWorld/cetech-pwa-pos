import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  buildLoginHarnessHtml,
  buildRegisterHarnessHtml,
  buildShellHarnessHtml,
} from "./visual/build-harness";
import {
  buildSellCustomerHarnessHtml,
  buildSellDesktopHarnessHtml,
  buildSellOfflineHarnessHtml,
  buildSellPhoneHarnessHtml,
  buildSellUnknownBarcodeHarnessHtml,
  buildSellVariationHarnessHtml,
} from "./visual/build-sell-harness";
import { buildStoreHealthHarnessHtml } from "./visual/build-store-health-harness";

const evidenceDir = resolve(dirname(fileURLToPath(import.meta.url)), "evidence");

describe("FE-02 isolated visual harness markup", () => {
  test("writes shell, login, and register HTML evidence without Demo FAB or demo staff", () => {
    mkdirSync(evidenceDir, { recursive: true });
    const shell = buildShellHarnessHtml();
    const login = buildLoginHarnessHtml();
    const register = buildRegisterHarnessHtml();
    writeFileSync(resolve(evidenceDir, "shell-desktop.html"), shell);
    writeFileSync(resolve(evidenceDir, "login-desktop.html"), login);
    writeFileSync(resolve(evidenceDir, "register-desktop.html"), register);

    expect(shell).toContain("Skip to main content");
    expect(shell).toContain("data-href=\"/sell\"");
    expect(login).toContain("Sign in");
    expect(register).toContain('id="opening-float"');
    expect(`${shell}${login}${register}`).not.toContain("Demo controls");
    expect(`${shell}${login}${register}`).not.toContain("Ama Mensah");
  });

  test("writes isolated FE-03 Sell workspace HTML evidence", () => {
    mkdirSync(evidenceDir, { recursive: true });
    const desktop = buildSellDesktopHarnessHtml();
    const phone = buildSellPhoneHarnessHtml();
    const variation = buildSellVariationHarnessHtml();
    const unknown = buildSellUnknownBarcodeHarnessHtml();
    const customer = buildSellCustomerHarnessHtml();
    const offline = buildSellOfflineHarnessHtml();
    writeFileSync(resolve(evidenceDir, "sell-desktop.html"), desktop);
    writeFileSync(resolve(evidenceDir, "sell-tablet.html"), desktop);
    writeFileSync(resolve(evidenceDir, "sell-phone.html"), phone);
    writeFileSync(resolve(evidenceDir, "sell-variation.html"), variation);
    writeFileSync(resolve(evidenceDir, "sell-unknown-barcode.html"), unknown);
    writeFileSync(resolve(evidenceDir, "sell-customer.html"), customer);
    writeFileSync(resolve(evidenceDir, "sell-offline.html"), offline);

    expect(desktop).toContain("Scan barcode or search products");
    expect(desktop).toContain("Epoxy Hardener 1L");
    expect(phone).toContain("mobile-open");
    expect(variation).toContain("Choose variation");
    expect(unknown).toContain("9999999999999");
    expect(customer).toContain("Buildworks Ltd");
    expect(customer).toContain("Wholesale");
    expect(offline).toContain("Cached catalog is available");
    expect(`${desktop}${phone}${variation}${unknown}${customer}${offline}`).not.toContain("demo-barcodes");
    expect(`${desktop}${phone}${variation}${unknown}${customer}${offline}`).not.toContain("Demo controls");
    expect(`${desktop}${phone}${variation}${unknown}${customer}${offline}`).not.toContain("later task");
    expect(`${desktop}${phone}${variation}${unknown}${customer}${offline}`).not.toContain("preparation pass");
    expect(`${desktop}${phone}${variation}${unknown}${customer}${offline}`.toLowerCase()).not.toContain("adapter");
    expect(`${desktop}${phone}${variation}${unknown}${customer}${offline}`).not.toContain("unwired");
  });

  test("writes isolated FE-07 Store Health HTML evidence", () => {
    mkdirSync(evidenceDir, { recursive: true });
    const health = buildStoreHealthHarnessHtml();
    writeFileSync(resolve(evidenceDir, "health-desktop.html"), health);
    writeFileSync(resolve(evidenceDir, "health-tablet.html"), health);
    writeFileSync(resolve(evidenceDir, "health-phone.html"), health);
    expect(health).toContain("Store Health");
    expect(health).toContain("An active payment or tender is in progress");
    expect(health).toContain("Unverified — not confirmed");
    expect(health).not.toContain("Demo controls");
    expect(health).not.toContain("Clear app data and start over");
    expect(health.toLowerCase()).not.toContain("paystack");
  });
});

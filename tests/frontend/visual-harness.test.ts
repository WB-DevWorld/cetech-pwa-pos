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
  buildSellOpenShiftHarnessHtml,
  buildSellOverflowCartHarnessHtml,
  buildSellOverflowProductsHarnessHtml,
  buildSellPhoneHarnessHtml,
  buildSellUnknownBarcodeHarnessHtml,
  buildSellVariationHarnessHtml,
} from "./visual/build-sell-harness";

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
    const openShift = buildSellOpenShiftHarnessHtml();
    const phone = buildSellPhoneHarnessHtml();
    const variation = buildSellVariationHarnessHtml();
    const unknown = buildSellUnknownBarcodeHarnessHtml();
    const customer = buildSellCustomerHarnessHtml();
    const offline = buildSellOfflineHarnessHtml();
    const overflowProducts = buildSellOverflowProductsHarnessHtml();
    const overflowCart = buildSellOverflowCartHarnessHtml();
    writeFileSync(resolve(evidenceDir, "sell-desktop.html"), desktop);
    writeFileSync(resolve(evidenceDir, "sell-desktop-open.html"), openShift);
    writeFileSync(resolve(evidenceDir, "sell-tablet.html"), desktop);
    writeFileSync(resolve(evidenceDir, "sell-phone.html"), phone);
    writeFileSync(resolve(evidenceDir, "sell-variation.html"), variation);
    writeFileSync(resolve(evidenceDir, "sell-unknown-barcode.html"), unknown);
    writeFileSync(resolve(evidenceDir, "sell-customer.html"), customer);
    writeFileSync(resolve(evidenceDir, "sell-overflow-products.html"), overflowProducts);
    writeFileSync(resolve(evidenceDir, "sell-overflow-cart.html"), overflowCart);

    expect(desktop).toContain("Scan barcode or search products, SKU");
    expect(desktop).toContain("Epoxy Hardener 1L");
    expect(desktop).toContain("Price confirmed");
    expect(desktop).toContain("Clear");
    expect(desktop).toContain("Start your shift before taking payment.");
    expect(desktop).not.toContain(">Scan<");
    expect(openShift).toContain("Pay GHS 970.00");
    expect(openShift).toContain("GHS 485.00 each");
    expect(openShift).toContain("Red");
    expect(phone).toContain("mobile-open");
    expect(variation).toContain("Choose variation");
    expect(unknown).toContain("9999999999999");
    expect(customer).toContain("Buildworks Ltd");
    expect(customer).toContain("Wholesale");
    expect(offline).toContain("Saved products are available");
    expect(overflowProducts).toContain("Overflow product 40");
    expect(overflowCart).toContain("Overflow product 16");
    expect(`${desktop}${openShift}${phone}${variation}${unknown}${customer}${offline}`).not.toContain("demo-barcodes");
    expect(`${desktop}${openShift}${phone}${variation}${unknown}${customer}${offline}`).not.toContain("Demo controls");
    expect(`${desktop}${openShift}${phone}${variation}${unknown}${customer}${offline}`).not.toContain("later task");
    expect(`${desktop}${openShift}${phone}${variation}${unknown}${customer}${offline}`).not.toContain("preparation pass");
    expect(`${desktop}${openShift}${phone}${variation}${unknown}${customer}${offline}`.toLowerCase()).not.toContain("adapter");
    expect(`${desktop}${openShift}${phone}${variation}${unknown}${customer}${offline}`).not.toContain("unwired");
  });
});

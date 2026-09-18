import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { SettingsScreen, type PosSettingsView } from "./SettingsScreen";

const settings: PosSettingsView = {
  deviceName: "Counter tablet 1",
  registerName: "Main Counter",
  scannerLabel: "Keyboard scanner",
  printerLabel: "Browser print",
  appearance: "system",
  buildId: "build-r8",
  contractVersion: "1.0.0",
  localSchemaVersion: "8",
};

describe("SettingsScreen", () => {
  test("renders the approved compact operational settings surface", () => {
    const html = renderToStaticMarkup(<SettingsScreen settings={settings} onOpenStoreHealth={() => undefined} />);
    expect(html).toContain("Device &amp; register");
    expect(html).toContain("Counter tablet 1");
    expect(html).toContain("Main Counter");
    expect(html).toContain("Keyboard scanner");
    expect(html).toContain("Browser print");
    expect(html).toContain("Technical details");
    expect(html).toContain("View system status");
    expect(html).toContain("build-r8");
  });

  test.each([
    ["offline", "Device settings remain readable."],
    ["degraded", "Some system information is temporarily unavailable."],
    ["error", "Settings could not be fully loaded."],
    ["loading", "Loading settings…"],
    ["empty", "Settings are not available."],
  ] as const)("renders %s state", (state, copy) => {
    const html = renderToStaticMarkup(<SettingsScreen settings={settings} state={state} />);
    expect(html).toContain(copy);
  });
});

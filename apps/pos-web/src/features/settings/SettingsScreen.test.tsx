import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { SettingsScreen, type PosSettingsView } from "./SettingsScreen";

const settings: PosSettingsView = {
  deviceName: "Counter tablet 1",
  registerName: "Main Counter",
  scannerLabel: "Keyboard scanner input",
  printerLabel: "Browser print",
  appearance: "system",
};

describe("SettingsScreen", () => {
  test("renders operational settings without engineering diagnostics", () => {
    const html = renderToStaticMarkup(<SettingsScreen settings={settings} onOpenStoreHealth={() => undefined} />);
    expect(html).toContain("Device &amp; register");
    expect(html).toContain("Counter tablet 1");
    expect(html).toContain("Main Counter");
    expect(html).toContain("Keyboard-wedge scanner");
    expect(html).toContain("Browser print (80mm/A4)");
    expect(html).toContain("Open System status");
    expect(html).not.toContain("Diagnostics");
    expect(html).not.toContain("Technical details");
    expect(html).not.toContain("API contract");
    expect(html).not.toContain("Local schema");
    expect(html).not.toContain("Build ID");
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

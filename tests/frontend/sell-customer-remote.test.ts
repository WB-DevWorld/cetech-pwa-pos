import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const runtimeSource = readFileSync(
  new URL("../../apps/pos-web/src/features/sell/runtime/SellRuntimeScreen.tsx", import.meta.url),
  "utf8",
);
const appSource = readFileSync(new URL("../../apps/pos-web/src/app/pos-app.tsx", import.meta.url), "utf8");

describe("BUG #83 Sell customer search wiring", () => {
  test("Sell uses a mounted remote-first customer search port with local fallback", () => {
    expect(runtimeSource).toContain("readonly customerSearch?:");
    expect(runtimeSource).toContain("if (ports.customerSearch)");
    expect(runtimeSource).toContain("customerSearchSeqRef");
    expect(appSource).toContain("loadCustomerSearchPresentation");
    expect(appSource).toContain("fetchCustomerDirectory(needle, fetchImpl)");
    expect(appSource).toContain("localSearch: (needle) => customers.search(needle)");
  });
});

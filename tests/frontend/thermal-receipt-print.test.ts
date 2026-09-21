import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const css = readFileSync(
  new URL("../../apps/pos-web/src/features/sell/sell.css", import.meta.url),
  "utf8",
);
const workspace = readFileSync(
  new URL("../../apps/pos-web/src/app/workspace-runtime.tsx", import.meta.url),
  "utf8",
);
const checkout = readFileSync(
  new URL("../../apps/pos-web/src/app/checkout-client.ts", import.meta.url),
  "utf8",
);

describe("BUG #85 thermal browser receipt printing", () => {
  test("browser print hides the POS shell and exposes an 80mm receipt only", () => {
    expect(css).toContain("@media print");
    expect(css).toContain("size: 80mm auto");
    expect(css).toContain("body *");
    expect(css).toContain("visibility: hidden !important");
    expect(css).toContain(".receipt-paper");
    expect(css).toContain("width: 76mm !important");
  });

  test("Orders reprint mounts the immutable receipt snapshot before window.print", () => {
    expect(workspace).toContain("mapReceiptSnapshot(receipt.data)");
    expect(workspace).toContain('className="receipt-print-host"');
    expect(workspace).toContain("<ReceiptPaper receipt={printReceipt} />");
    expect(workspace).toContain(".print({ receiptId: receipt.data.id, reason: \"reprint\" })");
    expect(checkout).toContain("window.print()");
  });
});

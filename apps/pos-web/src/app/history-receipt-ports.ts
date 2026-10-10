import type { PrintPort, ReceiptPort } from "../../../../docs/contracts/ports";
import { createBrowserPrintPort, createBrowserReceiptPort } from "./checkout-client";

/**
 * Historical receipt load + browser print for authenticated staff.
 * Independent of cash checkout scope / open shift — Orders reprint must not
 * require inventing a sell session.
 */
export function composeHistoryReceiptPrintPorts(options: {
  readonly presentationOnly: boolean;
  readonly fetchImpl?: typeof fetch;
}): {
  readonly receipts?: ReceiptPort;
  readonly printer?: PrintPort;
} {
  if (options.presentationOnly) {
    return {};
  }
  return {
    receipts: createBrowserReceiptPort({ fetchImpl: options.fetchImpl }),
    printer: createBrowserPrintPort(),
  };
}

/**
 * Workspace receipt/print selection used by pos-app mountPorts.
 * Prefer live checkout adapters when a sell scope exists; otherwise use history ports.
 */
export function workspaceReceiptPrintPorts(input: {
  readonly presentationOnly: boolean;
  readonly checkout: { readonly receipts: ReceiptPort; readonly printer: PrintPort } | null;
  readonly fetchImpl?: typeof fetch;
}): {
  readonly receipts?: ReceiptPort;
  readonly printer?: PrintPort;
} {
  const history = composeHistoryReceiptPrintPorts({
    presentationOnly: input.presentationOnly,
    fetchImpl: input.fetchImpl,
  });
  return {
    receipts: input.checkout?.receipts ?? history.receipts,
    printer: input.checkout?.printer ?? history.printer,
  };
}

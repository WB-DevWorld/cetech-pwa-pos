# Lane 1 — PRINT-HISTORY-REPRINT-01

Status: **SOURCE COMPLETE (local verification)** · Preview reprint on corrected SHA **pending release decision**  
Selected base: `7d5778fe904792360947d88122050e529587aa51`  
Staff-documentation impact: **NONE**  
Production effects: **NONE**

## Problem (baseline)

`pos-app` set `receipts` / `printer` only from `createBrowserCashCheckoutPorts` when a checkout scope existed. Orders gates Reprint on `receipts && printer`, so historical reprint was hidden without selected register / open shift even though `createBrowserReceiptPort` / `createBrowserPrintPort` already existed.

## Correction

- `apps/pos-web/src/app/history-receipt-ports.ts` — `composeHistoryReceiptPrintPorts` / `workspaceReceiptPrintPorts`
- `apps/pos-web/src/app/pos-app.tsx` — mountPorts uses `workspaceReceiptPrintPorts` for authenticated non-presentation staff independently of checkout scope
- Checkout / payments / sales / `checkoutScope` / shift guards unchanged

## Regression

`apps/pos-web/src/app/pos-app.receipt-reprint.test.tsx`

| Assertion | Result |
| --- | --- |
| Baseline checkout-only wiring hides Reprint | PASS |
| Corrected composition offers Reprint without register/shift | PASS |
| Stored receipt GET → mount → print; repeated reprint | PASS |
| Cancelled present does not print | PASS |
| Presentation-only gets no history ports | PASS |
| Zero prepare/tender/payment/finalize/refund/stock requests | PASS |
| pos-app wires `historyPrint` not `checkout?.receipts` alone | PASS |

## Connected checks (pinned toolchain)

| Check | Result |
| --- | --- |
| `pnpm test -- src/app/pos-app.receipt-reprint.test.tsx` (+ reprint-receipt, printer-preference, checkout-client) | **26/26 PASS** |
| `tests/frontend/pos-app-workspaces.test.ts` | **6/6 PASS** |
| `tsc --noEmit` (pos-web) | **PASS** |
| `apps/pos-web/e2e/thermal-receipt-print.spec.ts` | **NOT RUN** this lane (Playwright browser; no sale) |
| Native browser print on corrected Preview | **NOT RUN** — f0 Preview remains `f0feb44…`; new exceptional deploy not created |

## Preview decision (required for runtime Reprint)

Earlier one-off f0 Preview creation is **consumed**. Proposed exact-SHA Preview (do not run without owner decision):

```text
# After publishing Lane 1 SHA <FINAL_SHA>:
# Use repository release procedure with BUILD_ID=<FINAL_SHA> and empty APP_ORIGIN overrides.
# Do not move shared tester alias. Do not label the result f0.
```

f0 Preview `dpl_4Vk3XQ…` / `gqg6tjedt` remains valid for prior receipt display evidence only until a corrected Preview exists.

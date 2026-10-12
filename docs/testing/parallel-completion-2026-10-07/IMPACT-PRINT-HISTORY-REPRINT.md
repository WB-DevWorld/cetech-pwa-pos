# PRINT-HISTORY-REPRINT-01 / R144 impact

Problem: Orders Reprint is gated on `ports.receipts && ports.printer`, but `pos-app` only composed those ports inside `createBrowserCashCheckoutPorts` when a cash checkout scope exists (selected register + open shift). On the f0 Preview without that scope, Reprint is hidden even though stored-receipt GET and browser print adapters already exist.

Change: compose `createBrowserReceiptPort({ fetchImpl })` and `createBrowserPrintPort()` for authenticated, non-presentation-only staff independently of checkout scope. Pass those history ports into the existing workspace composition. Keep checkout / payments / sales / checkoutScope / device / open-shift guards unchanged. Do not fabricate a checkout scope or open a shift to unlock reprint.

Product allowlist (Lane 1):

- `apps/pos-web/src/app/pos-app.tsx`
- `apps/pos-web/src/app/history-receipt-ports.ts` (composition helper used by pos-app)
- `apps/pos-web/src/app/pos-app.receipt-reprint.test.tsx` (named composition regression)
- `CURRENT-WORK.md`
- `docs/testing/parallel-completion-2026-10-07/**` (this manifest, scope, evidence/handoff)

Forbidden for this correction: bridge, database, contracts, receipt snapshot shape, pricing, service-worker, authorization, second cash sale, new f0 Preview exception, shared alias move, production promotion.

Staff-documentation impact: NONE (Reprint becomes available when history ports exist; staff copy already describes reprint). Production effects: NONE.

Selected base: `#144` head `7d5778fe904792360947d88122050e529587aa51` on `ws3/combined-candidate-2026-10-08` (product source unchanged vs freeze tip `f0feb44…` + product tip `ab5c7e1…`; evidence-only commits after freeze).

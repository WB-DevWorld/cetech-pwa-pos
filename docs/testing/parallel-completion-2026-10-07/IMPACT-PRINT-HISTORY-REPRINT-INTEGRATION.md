# PRINT-HISTORY-REPRINT-INTEGRATION-01 impact

Root bounded review **ACCEPT**ed product composition at `542d3ef…`. Runtime qualification remained incomplete until this amendment: prior tests did not mount the Orders workspace or exercise click → mount → print → cleanup.

## Scope amendment (test-only)

Named before edit in `scope-print-history-reprint-integration.json`:

| Path | Role |
| --- | --- |
| `apps/pos-web/e2e/orders-reprint-composition-harness.tsx` | Vite harness mounting `ApprovedWorkspaceScreens` Orders path with corrected vs checkout-only ports |
| `apps/pos-web/e2e/orders-history-reprint-composition.spec.ts` | Playwright Chromium: negative control + corrected composition |
| `apps/pos-web/e2e/orders-reprint.playwright.config.ts` | Isolated config (no Next webServer) |
| `apps/pos-web/e2e/orders-reprint.vite.config.ts` | Harness bundle |
| `docs/testing/parallel-completion-2026-10-07/**` | Evidence / decision |

Production files `pos-app.tsx` / `history-receipt-ports.ts` **unchanged** (integration did not expose a product defect).

## Coverage

- Actual workspace composition (not hard-coded undefined ports / SSR-only OrderDetailDialog / source-string checks)
- No selected register + selected register without open shift
- Signed-out + presentation-only: Reprint absent
- Checkout scope remains null / blocked without real scope
- Immutable receipt GET for `33326bbc-1dd7-4582-8409-ea434942d8db`
- Print lifecycle return → `.receipt-print-host` cleanup → repeat Reprint
- Zero prepare/tender/payment/finalize/refund/stock commercial calls
- Negative control: prior checkout-only composition → Reprint **absent**; corrected → **present** and cleans up

## Results (local)

| Check | Command / path | Result |
| --- | --- | --- |
| Composition Playwright | `pnpm exec playwright test --config=e2e/orders-reprint.playwright.config.ts` (cwd `apps/pos-web`) | **1 passed** (~3.9s) |
| Unit reprint guards | `pnpm exec vitest run src/app/pos-app.receipt-reprint.test.tsx` | **7 passed** |

Staff-documentation impact: **NONE**. Production effects: **NONE**.

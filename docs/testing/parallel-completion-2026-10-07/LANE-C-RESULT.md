# Lane C result — receipts / sell fixtures

| Field | Value |
| --- | --- |
| Task | `PARALLEL-LANE-C-RECEIPTS` |
| Branch | `ws3/lane-c-receipts-2026-10-07` |
| Base / tested SHA | `0e383d84f11573ca89d6533c8cb7c35d79d7b261` |
| Worktree | `cetech-pwa-pos-lane-c-receipts` |
| Production effects | NONE |
| Outcome | **PASS (fixture)** — no allowlisted product regression reproduced; no product fix required |

## Goals verified

| Goal | Result | Evidence |
| --- | --- | --- |
| Ordered scans | PASS | Playwright `sell-scanner-intents` (distinct + repeated barcodes under native IndexedDB catalog lock) |
| Variation / collision choices | PASS | Playwright queued variation + duplicate-barcode chooser cases; unit `scanIntentQueue` / barcode resolution |
| Cart revision + Pay guards | PASS | Unresolved-scan Pay block before next render; `cartRevision` advances; prepare count stays 0 |
| Completed-cart retirement | PASS | Unit `ux-03` completed-sale retire/rotate; cash-checkout `resetForNewSale`; e2e Clear sale retires only active draft |
| Fresh-cart / scanner readiness | PASS | New cart revision 0; scanner e2e after quote confirm; timing fixture below |
| Receipt failure + reprint | PASS | `cash-checkout` receipt_failed / print_failed / reprint; `reprint-receipt`; Orders reprint e2e; thermal layout e2e |
| Receipt failure does not repeat payment/order/stock | PASS | After receipt/print failure, prepare/confirmCash/finalize remain single-call; reprint path loads ReceiptPort only |
| Preserve settings / UI; no IndexedDB or journal clear | PASS | Settings unit tests; cart retire deletes one draft only (`retireCartDraft`); no clear-all paths exercised or added |

## Commands and results

Install:

```text
pnpm install --frozen-lockfile
pnpm --dir apps/pos-web exec playwright install chromium
```

Unit / fixture (TZ=UTC):

```text
pnpm --dir apps/pos-web test -- src/features/sell/runtime/scanIntentQueue.test.ts src/features/sell/state/sellWorkspace.test.ts src/features/sell/state/quoteRevision.test.ts src/features/sell/state/barcodeResolution.test.ts src/features/sell/state/cartState.test.ts src/features/sell/state/checkoutSession.test.ts src/features/orders/reprint-receipt.test.ts src/features/settings/SettingsScreen.test.ts src/core/receipt/printer-preference.test.ts src/features/sell/components/ReceiptPaper.test.tsx
→ 10 files / 80 tests PASS

pnpm --dir apps/pos-web test -- ../../tests/frontend/cash-checkout.test.ts ../../tests/frontend/sell-runtime.test.ts ../../tests/frontend/sell-runtime-boundaries.test.ts ../../tests/frontend/thermal-receipt-print.test.ts ../../tests/frontend/ux-03-visible-price-refresh.test.ts ../../tests/integration/sync/cart-draft-store.test.ts
→ 6 files / 47 tests PASS

pnpm --dir apps/pos-web exec vitest run ../../tests/frontend/lane-c-fixture-timings.test.ts --reporter=verbose
→ 2 tests PASS (timings below)
```

Browser (isolated port — see note):

```text
pnpm --dir apps/pos-web exec playwright test --config "../../docs/testing/parallel-completion-2026-10-07/playwright.lane-c.config.ts" sell-scanner-intents.spec.ts
→ 5 passed

pnpm --dir apps/pos-web exec playwright test --config "../../docs/testing/parallel-completion-2026-10-07/playwright.lane-c.config.ts" cash-sale.spec.ts ui-receipt-compatibility.spec.ts thermal-receipt-print.spec.ts
→ 13 passed

pnpm --dir apps/pos-web exec playwright test --config "../../docs/testing/parallel-completion-2026-10-07/playwright.lane-c.config.ts" --project=lane-c-timings
→ 1 passed
```

### Port collision note

Default Playwright `reuseExistingServer` on `:3000` hit an unrelated local Next app (`prism` / Meexah 404). Lane C used `docs/testing/parallel-completion-2026-10-07/playwright.lane-c.config.ts` on `127.0.0.1:3017` with `reuseExistingServer: false`. This is a local fixture harness only, not a CI/product config change.

## Fixture timings (fixture measurements only)

Not device, staging, Woo, or physical-printer evidence.

| Fixture | Metric | Value |
| --- | --- | --- |
| Unit synthetic catalog | barcode lookup | **0.458 ms** |
| Unit synthetic catalog | cart apply | **0.893 ms** |
| Unit synthetic catalog | lookup + apply total | **1.494 ms** |
| Unit checkout controller | completed-sale → next-sale readiness (`resetForNewSale` + `applyNewSale`) | **0.244 ms** |
| Browser mocked Sell + IndexedDB seed | scan → cart line visible | **214 ms** |
| Browser mocked Sell + IndexedDB seed | scan → confirmed quote | **228 ms** |

## Hardware / printing qualification steps (not executed here)

Do **not** treat the browser/PDF fixtures above as physical printer acceptance.

1. Record device: register tablet/PC, OS, browser/PWA, scanner model/interface, printer model/driver, paper width (58/80 mm).
2. Confirm local Settings paper width matches the loaded stock; do not clear site storage or journals to “fix” print issues.
3. With an authorized training/staging register and open shift, complete one safe cash sale; confirm the first receipt attempt.
4. Force or observe a print/dialog failure after sale completion; confirm the sale remains complete and **Pay / prepare is not repeated**.
5. Reprint the same receipt from Orders; confirm identical business content and **no second payment/order/stock effect**.
6. Scan known SKU, unknown code, and a collision/variation barcode on the wedge scanner; confirm ordered cart feedback and Pay blocked while a scan/choice is pending.
7. After New sale, confirm the completed cart is retired, the fresh cart is empty at revision 0, and the scanner accepts the next barcode without storage wipe.
8. Attach one device record using `docs/runbooks/R10-DEVICE-AND-PWA-REHEARSAL.md` sections E–F and `docs/integration/evidence/R10/R10-EVIDENCE-TEMPLATE.md`. Mark physical evidence separately from this Lane C fixture PASS.

## Blockers

None for fixture verification on this SHA.

Residual (out of Lane C / not claimed fixed):

- Contributor machine `:3000` may be occupied by another Next app; use the Lane C Playwright config or free the port before default e2e.
- Physical scanner/printer and authenticated staging qualification remain **UNVERIFIED**.
- No production promotion authorized.

## Next action

Coordinator may treat Lane C fixture verification as complete for SHA `0e383d84f11573ca89d6533c8cb7c35d79d7b261`. Schedule authorized hardware/printing qualification (steps above) on a training/staging device; merge/integration remains a separate WS3 batch decision.

## Staff-documentation impact

**None for this Lane C pass.** No staff-facing behavior change was shipped; only fixture evidence, a local Playwright override under `docs/testing/parallel-completion-2026-10-07/`, and a fixture timing unit test were added. Existing staff guidance on reprint-without-resale and completed-cart retirement remains accurate.

## Allowlist / changes made

Allowed paths touched:

- `tests/frontend/lane-c-fixture-timings.test.ts` (new)
- `docs/testing/parallel-completion-2026-10-07/**` (scope, result, local Playwright harness, browser timing spec)

No edits under `apps/pos-web/src/**` (no reproduced regression). Forbidden paths not touched. IndexedDB/journal clear not performed.

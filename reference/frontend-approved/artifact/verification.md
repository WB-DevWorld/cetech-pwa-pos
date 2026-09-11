# CETECH POS Frontend Preview — Verification

Verification date: 2026-09-11

This document records the self-test performed against the generated zero-build frontend before packaging.

## Direct-open structural audit

The preview entry point is `index.html` and references only local relative assets:

- `styles.css`
- `js/mock-data.js`
- `js/mock-adapters.js`
- `js/state.js`
- `js/components.js`
- `js/app.js`

The audit found:

- no CDN references;
- no HTTP/HTTPS runtime dependency in the browser preview;
- no ES-module `<script type="module">` dependency;
- no `fetch()` call to a live backend;
- no npm/runtime package requirement;
- no external icon or font dependency;
- ordinary non-module local script tags only.

All five JavaScript files pass `node --check`. `frontend-contracts.ts` passes a standalone strict TypeScript no-emit check with `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, ES2022 target and bundler-style module resolution.

The automated browser environment used for this build blocks direct navigation to `file://` and localhost pages by environment policy. To avoid pretending otherwise, interaction tests were executed in Chromium by loading the **same generated HTML/CSS/JavaScript bytes in-memory**. The separate structural audit above validates the specific direct-file constraints that matter for double-click use. The package itself contains no test-only inlining or browser shim.

## Browser interaction test

Headless Chromium exercised the preview at a 1440×1000 desktop viewport and a 390×844 phone viewport. No page errors or console errors were observed.

The following passed:

- login and named demo cashier;
- register selection/opening float;
- Sell as the default post-open workflow;
- barcode/product add;
- confirmed authoritative mock quote before Pay;
- cash tender, change, sale completion and operational receipt;
- New Sale returning customer context to Walk-in;
- quantity-tier mock pricing crossing a threshold;
- B2B customer selection, WHOLESALE context and requote;
- offline cart retention and Pay blocking;
- reconnect and authoritative requote before Pay;
- MoMo pending state with **Do not charge again** messaging;
- payment-status recheck/recovery to success;
- order search and status filtering;
- return order lookup;
- refund preview from historical transaction economics;
- refund completion;
- Store Health;
- Update Ready UI;
- Needs Attention / transaction recovery;
- manager variance review;
- Z / shift-close report;
- phone bottom navigation behavior and removal of desktop-only branding controls.

## Edge-state test

Additional automated checks passed for:

- price-change disclosure after a new authoritative quote;
- stock change blocking payment and returning safely to the cart;
- exact variation barcode bypassing the variation chooser;
- duplicate-barcode collision state instead of silent guessing;
- stale/out-of-order quote response protection;
- update deferral while a cart is active;
- update blocking while a payment is active;
- lost prepare-response recovery to the existing prepared sale;
- no duplicate mock order for the recovered transaction;
- local-data migration blocked by another tab;
- destructive Fix App reset blocked while a critical operation exists.

## Keyboard-wedge scanner test

A rapid keyboard sequence followed by Enter was tested with barcode:

`0012345678901`

Results:

- the leading-zero identifier remained a string;
- the correct product was found;
- repeating the same scan incremented the existing line from quantity 1 to 2;
- no console/runtime error occurred.

## Required A–K demonstration scenarios

| Scenario | Result | Preview path |
| --- | --- | --- |
| A — Walk-in retail cash | PASS | Open register → scan → confirmed quote → Pay → Cash → change → receipt |
| B — Quantity price | PASS | Quantity-tier product → cross threshold → Updating price → lower mock quote |
| C — Wholesale | PASS | Select B2B company → WHOLESALE banner → requote → wholesale result |
| D — Price changed | PASS | Demo controls → Next quote: price changed → visible price disclosure |
| E — Stock changed | PASS | Demo controls → Next Pay: stock changed → payment blocked → quantity repair |
| F — MoMo pending | PASS | Mobile Money → Pending → Do not charge again → Check again → recovered success |
| G — Offline | PASS | Demo controls → Go offline → local search/cart stay → Pay blocked → reconnect/requote |
| H — Return | PASS | Returns → item/qty/reason/condition → preview → approval → refund state |
| I — Register close | PASS | Register → Close → blind count → variance → manager approval → Z report |
| J — PWA update | PASS | Simulate Update Ready → cart defers; active payment blocks activation |
| K — Transaction recovery | PASS | Next Pay: response loss → Checking sale status → existing prepared sale recovered |

## Remaining production integration tests

These are intentionally not claimed by this frontend preview and belong to the Next.js/full-stack conversion:

- real WooCommerce/WoodMart/B2BKing pricing parity;
- real Woo stock reservation/deduction and HPOS behavior;
- real Supabase RLS/auth;
- real Paystack/MoneyMove settlement and webhook verification;
- real Dexie/IndexedDB schema migrations and service-worker lifecycle;
- actual CETECH scanner/printer hardware;
- real Ghana statutory invoicing/CIS workflow;
- real multi-device/server idempotency and reconciliation.

## Additional represented-state checks

After the primary suite, the following additional states were exercised successfully with no runtime errors:

- explicitly expired quote blocks Pay and shows a price-expired reason;
- Store Health can show stale catalog, local-data warning and unsupported application version;
- refund can enter **Needs attention** with explicit **Do not issue another refund** guidance;
- receipt print failure preserves the completed receipt and offers reprint/retry rather than reversing the sale.

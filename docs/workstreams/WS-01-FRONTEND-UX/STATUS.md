# WS1 current status

Snapshot 2026-09-17. STG-03 / issue #72 and FE-07 / issue #12 WS1 contribution implemented on `ws1/stg-03-approved-workspaces` from accepted base `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`. Exact tested source SHA `169f8155fe4cb34b6fe27db3bb6b445a13ade712`; CI run #454 succeeded on Linux and Windows, including control-plane verification, lint, typecheck, unit tests, production build and Linux Playwright smoke. Orders, Customers, Settings, Store Health, Needs Attention, update-ready, offline/degraded, passive-tab, local migration and Fix App presentation surfaces are exported for WS3 composition. `src/app/**`, server/core/local/config, providers, contracts, WordPress and Supabase were not changed. Frozen v1.0.0 contracts remain unchanged. Explicit blockers remain: no provider-neutral Orders list/query contract or canonical `OrderSummary`; no canonical AttentionItem collection/action contract; settings persistence and release/migration/active-tab/recovery coordinators remain WS3-owned. Runtime screenshots and installed-device evidence are INTEGRATION-PENDING because WS1 is forbidden from mounting `src/app/**`; design reference screenshots are not claimed as implementation evidence. Delivery **READY_FOR_WS3_INTEGRATION**. Do not merge; WS3 must independently import tested source SHA, mount, run combined exact-head tests, capture desktop/tablet/mobile/device evidence, and publish staging. No R9+ work while #70 remains open. See `STG-03-HANDOFF.md`.

## Previous snapshot (historical; current section above controls)

# WS1 current status

Snapshot 2026-09-15. FE-06 / issue #11 HIGH outstanding-return abandonment remediated. Replacement implementation SHA `d3ddf0a7592845c710fe768b3645b9a9109693cb` supersedes prior published head `91641f4f9ab242f3026cc47dcc5a8cc78d5b9c39` / prior implementation `bb2010b260a78d3741186df48462b22f7ece3861`. An executed return in `executing` / `resolving` / `refund_pending` / `in_progress` / `requires_attention` stays bound to its `returnId`; sale lookup, sale selection, and quantity/reason/condition edits are locked in both controller and UI until authoritative `completed`. Failed `ReturnPort.resolve` with an outstanding identity stays `requires_attention`, not editable `failed`. Prior FRESH_2 that watched obsolete `batch/rt01-safe-returns` is superseded; current receiver is `origin/batch/rt01-safe-returns-ws3-integrated` `4650a0fa18c909743e9fbab4be0b6067bd1eff18` (COMPATIBLE / DO_NOT_CONSUME). PAY-01 remains **PROVISIONAL_TEST**. No live refund/restock/provider acceptance. Freshness **FRESH_2**. Delivery **READY_FOR_INTEGRATION**. Reassignment NONE. Do not merge; do not modify the WS3 integration branch; do not start FE-07/R8.

## Previous snapshot (historical; current section above controls)

# WS1 current status

Snapshot 2026-09-15. FE-06 / issue #11 payment, return, and register frontend states implemented on `ws1/fe-06-implement-payment-returns-and-register-states`. Pre-handoff implementation SHA `bb2010b260a78d3741186df48462b22f7ece3861` on contract baseline `58d385300bfba784435448029e88f07742048cde`. Feature-local controllers consume frozen v1.0.0 `PaymentPort` / `ReturnPort` / `RegisterPort` via injected fakes. Pending/reconciling payments say **Do not charge again** and do not reinitialize; historic return preview displays server refund totals and remaining quantities; damaged/quarantine/not-physically-returned never appear as automatic sellable restock; blind close accepts counted cash only. PAY-01 remains **PROVISIONAL_TEST**. BR-08 / RT-01 runtime producers and live refund/restock/provider acceptance are **not claimed**. No production effects. Freshness **FRESH_2**. Delivery **READY_FOR_INTEGRATION**. Reassignment NONE. Do not merge; do not open a separate FE-06 milestone PR; do not start FE-07.

## Previous snapshot (historical; current section above controls)

# WS1 current status

Snapshot 2026-09-14. FE-05 / issue #10 HIGH prepared-sale abandonment blocker remediated. Replacement implementation SHA `57574fe5e8b4aceaf94773aea9bc04ee801d0980` supersedes `f6607cda70176b51be0dc8b8a6e40ae0f64d9e24` / prior FRESH_2 `cd2c9c1`. Prepared `cash` / `cash_failed` cannot dismiss to an editable cart; New Sale stays blocked while a prepared transaction is outstanding; cash retry reuses the same idempotency identity; `payment_pending` resolves the existing tender instead of a second `confirmCash`. Contracts v1.0.0 unchanged. CORE-06 not started. Freshness **FRESH_2**. Delivery **READY_FOR_INTEGRATION**. Reassignment NONE. Do not merge; PR #55 is the R6 review surface.

## Previous snapshot (historical; current section above controls)

# WS1 current status

Snapshot 2026-09-14. FE-05 / issue #10 cash checkout and receipt UX is implemented on `ws1/fe-05-integrate-cash-checkout-and-receipt-ux`. Pre-handoff implementation SHA `f6607cda70176b51be0dc8b8a6e40ae0f64d9e24`. Pay is actionable only with FE-04 `allowed: true` **and** injected `CheckoutUseCases` / `PaymentPort` / `SalesPort.resolve` / `ReceiptPort` / `PrintPort` / checkout scope. Ambiguous results use resolve; failed print never repeats prepare/cash/finalize. Contracts v1.0.0 consumed, not changed. CORE-06 still owns real BFF/runtime mounting. Freshness **FRESH_2**. Delivery **READY_FOR_INTEGRATION**. Reassignment NONE. Do not merge; PR #55 is the R6 review surface.

## Previous snapshot (historical; current section above controls)

# WS1 current status

Snapshot 2026-09-13. FE-03 RUNTIME COMPLETE / INTEGRATED_AND_TESTED on PR #41 (isolated SHA `99b61023984f22a8a3c0444e083cce3d0a1fdc5b`). FE-04 QUOTE-STATE INTEGRATION COMPLETE (isolated SHA `910c31cd5037d674caf23d1fcc576b8d8b0462c6`). Quote authority scoped by `(cartId, cartRevision)` across New Sale. Prior Sell init / live `changed` / cursor remediations preserved. Freshness **FRESH_2**. Pay stays disabled. Issues #8 and #9 remain OPEN until #41 review. `pricingParityVerified` false. R4 **AWAITING INDEPENDENT RE-REVIEW** / not merged.


## Previous snapshot (historical; current section above controls)

# WS1 current status

Snapshot 2026-09-13. FE-03 RUNTIME COMPLETE / INTEGRATED_AND_TESTED on PR #41 (isolated SHA `99b61023984f22a8a3c0444e083cce3d0a1fdc5b`). FE-04 QUOTE-STATE INTEGRATION COMPLETE (isolated SHA `910c31cd5037d674caf23d1fcc576b8d8b0462c6`). Emmanuel merge blockers on `31bbfcc…` remediated: stable Sell init; live `changed` quote on same-revision revalidation. Pay stays disabled (no sale/payment). Issues #8 and #9 remain OPEN until #41 review. `pricingParityVerified` false. R4 **AWAITING INDEPENDENT RE-REVIEW** / not merged.

## Previous snapshot (historical; current section above controls)

# WS1 current status

Snapshot 2026-09-13. FE-03 RUNTIME COMPLETE / INTEGRATED_AND_TESTED on PR #41 (isolated SHA `99b61023984f22a8a3c0444e083cce3d0a1fdc5b`). FE-04 QUOTE-STATE INTEGRATION COMPLETE (isolated SHA `910c31cd5037d674caf23d1fcc576b8d8b0462c6`). Whole-cart PricingPort via BFF; delayed older revision cannot overwrite; Pay stays disabled (no sale/payment). Issues #8 and #9 remain OPEN until #41 review. `pricingParityVerified` false. R4 assembled / not merged.

## Previous snapshot (historical; current section above controls)

# WS1 current status

Snapshot 2026-09-12, main `cd4477f185c159e18ed939a20145865d665099b4`. FE-01/#33 and FE-02/#37 are MERGED; issues #6/#7 closed. CI-01/#38 discovery fix is merged. #41 is open at `ede771bdbe5f05c8b517ce5168c9d8515a354e28`: PREPARATION COMPLETE / RUNTIME INTEGRATION BLOCKED BY CORE-04. No real CatalogPort/CustomerPort/Dexie/BFF route/quote/payment acceptance is inferred. FE-04 onward retains TASKS dependencies.

R4 continuation/preparation is declared in CURRENT-WORK and TASKS. No frontend implementation was changed by workflow adoption; existing #41 review evidence belongs to its own head. Final delivery uses canonical handoff/two-pass freshness.

## Previous snapshot (historical; current section above controls)

# WS1 status

Updated: 2026-09-12. Owner: Developer 1 — @Ben-001-sys.

FE-01 is approved and merged. CP-05 remains satisfied. CI-01 / PR #38 has landed on `main` and broadened canonical Vitest discovery. FE-02 is **MERGED / COMPLETED** (PR #37, merge `ceea3c4ebb3b95d7c3195d6cc089d1f3713d1d19`, issue #7 CLOSED / COMPLETED). FE-03 is not waiting for FE-02 review/merge.

| Task | State | Branch / evidence |
| --- | --- | --- |
| FE-01 | APPROVED / MERGED | PR #33. Merge commit `52caf39d010687084e0b1e1db74acd0b644ab4b0`. Issue #6 closed/completed. |
| FE-02 | MERGED / COMPLETED | PR #37. Merge commit `ceea3c4ebb3b95d7c3195d6cc089d1f3713d1d19`. Issue #7 CLOSED / COMPLETED. |
| FE-03 | PREPARATION COMPLETE / PR #41 — FINAL REVIEW STATE GITHUB-AUTHORITATIVE / RUNTIME INTEGRATION NOT COMPLETE | Branch `ws1/fe-03-build-sell-cart-barcode-and-customer-workflow`. Issue #8 remains OPEN. FE-03 preparation is implemented. Full runtime integration remains incomplete. No App Router mounting; no real CatalogPort integration; no real CustomerPort integration; no CartDraftStore/Dexie integration; no quote/pricing/Pay enablement. Contracts: CatalogPort, CustomerPort, CartDraftStore v1.0.0. Contract changes: none. Migrations: none. ADRs authored by FE-03: none. Historical review note: senior review requested changes on preparation head `2700a378b67cbde22b316ea9ce60d7aa209bde5d`. Those substantive findings were remediated on later head `a7510172e0504ff1ff59d12930ddfb954efa2961`. Final review state remains GitHub-authoritative. See HANDOFF.md. |
| FE-04 | SPECIFIED | See TASKS.md; GitHub mapping in ../../plans/TASK-INDEX.md |
| FE-05 | SPECIFIED | See TASKS.md; GitHub mapping in ../../plans/TASK-INDEX.md |
| FE-06 | SPECIFIED | See TASKS.md; GitHub mapping in ../../plans/TASK-INDEX.md |
| FE-07 | SPECIFIED | See TASKS.md; GitHub mapping in ../../plans/TASK-INDEX.md |

Update with actual evidence; never mark prerequisite fulfilled based on this initial table.

# WS1 current status

Snapshot 2026-09-18. UX-02 Sell alignment closeout on `ws1/ux-02-sell-demo-alignment` from start SHA `7918bafc4163f4919bad6da8ae1f5de9bed30558` (`origin/batch/stg-01-staging-runtime-acceptance`). Previous UI implementation SHA `da5eaa33907576c61e1deebfc01bfe38bfd7a772`. Closeout implementation SHA `b93549aa761a47c962997089b9842d73e808cfef`. This closeout adds Woo stored ordinary/base `displayPrice` through the bridge producer, provider-neutral mapper, local cashier-seed advisory list prices, and Sell cards. `CatalogItem.displayPrice` remains advisory; `/quotes` and prepare/finalize remain authoritative. Numeric availability is still absent. Commercial badge metadata is still absent. Durable Postgres catalog identity rows still null display prices. Deployed staging visual acceptance was not performed. Temporary senior reassignment for this branch expires at staging-integration handoff. Freshness **FRESH_2**. Delivery **READY_FOR_INTEGRATION**. Do not merge; do not modify `main`; do not edit the shared batch branch.

## Previous snapshot (historical; current section above controls)

# WS1 current status

Snapshot 2026-09-18. UX-02 Sell demo-alignment on `ws1/ux-02-sell-demo-alignment` from start SHA `7918bafc4163f4919bad6da8ae1f5de9bed30558` (current `origin/batch/stg-01-staging-runtime-acceptance`). Pre-handoff implementation SHA `da5eaa33907576c61e1deebfc01bfe38bfd7a772`. Search-first workstation, selling-decision cards, pinned cart totals/Pay, and `CatalogItem.displayPrice` presentation are in WS1 UI. Live staging cards still omit prices because WS3 `mapBridgeCatalogItem` strips `displayPrice`. Numeric availability is not in the current catalog contract; stock copy is status-only. UX-01 safety language is preserved except the Sell-specific copy in this prompt. Freshness **FRESH_2**. Delivery **READY_FOR_INTEGRATION** for independent WS1 UI; live product-price visual acceptance remains **blocked on the catalog producer**. Reassignment NONE. Do not merge; do not modify `main`; do not edit the shared batch branch.

## Previous snapshot (historical; current section above controls)

# WS1 current status

Snapshot 2026-09-18. UX-01 / issue #78 review follow-up on `ws1/ux-01-cashier-language`. Previous head `0aa519db480f119589cbc037a8a7194246a260c2`. Follow-up implementation SHA `d865234575d5664839a5082e0c6305f0dbb57768`. Scanner/printer copy is capability-only (`Keyboard scanner input` / `Browser print`). `toCashierError` is safe-by-default: unknown backend text is never primary cashier copy; raw code/message stay in Technical details. Batch watched: `origin/batch/stg-01-staging-runtime-acceptance` `ee9e3d95bc8914cdd9251973412924d64a7b2ea9` (SAME / COMPATIBLE). `origin/main` `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` (SAME). Freshness **FRESH_2**. Delivery **READY_FOR_INTEGRATION**. Reassignment NONE. Do not merge; do not modify `main`; do not touch R9.

## Previous snapshot (historical; current section above controls)

# WS1 current status

Snapshot 2026-09-18. UX-01 / issue #78 cashier language and actionable POS errors implemented on `ws1/ux-01-cashier-language` from start SHA `ee9e3d95bc8914cdd9251973412924d64a7b2ea9`. Implementation SHA `9335ee0ad31d1a18554178184a1a185c2d809824`. Presentation mappers live in `apps/pos-web/src/ui/cashier-language/`; standard is `docs/standards/POS-CASHIER-LANGUAGE.md`. Frozen contracts, error codes, pricing/stock authority, payment uncertainty, idempotency, register/shift, and recovery semantics are unchanged. Synthetic customers were not restored. `pricingParityVerified=false` remains an open functional fact, not a copy regression. Freshness **FRESH_2**. Delivery **READY_FOR_INTEGRATION**. Reassignment NONE. Do not merge; do not modify `main`; do not touch R9.

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

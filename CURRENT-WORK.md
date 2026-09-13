# Current work ledger

Updated 2026-09-13. Canonical repo WB-DevWorld/cetech-pwa-pos. Senior @wbdevworld owns integration/migrations/contracts/config. GitHub issues are live task/status evidence; this table is the cross-workstream coordination summary.

Controlling interpretation: [ADR-011](docs/decisions/ADR/011.md). Training Woo is the development/integration reference. Unavailable production facts are cutover/release deltas unless a task specifically requires them. Remaining CP-04 work: [CP-04 checklist](docs/runbooks/CP-04-REMAINING-WORK.md).

| Task | Owner | Branch | Status | Dependencies / blocked by | Contracts | Merge order |
| --- | --- | --- | --- | --- | --- | --- |
| CP-01/02/03 | WS3 | main (foundation) | IMPLEMENTED / VERIFIED; human review available | Commit 9229334; GitHub CI run 34643828253 success | v1.0.0 | First |
| CP-04 | WS3 + WS2 evidence | main; issue #4 OPEN; W1/W4 evidence on `ws3/cp-04-r2-runtime-gates` `edf24af…` | DEVELOPMENT BASELINE SATISFIED; W1 **PASS** on training; W4 **PASS** on training WordPress side; write-safety/cutover otherwise OPEN | ADR-011; evidence SHA `67ea42ce03142fb9f0ca18446b8146b0815ea621`. Overall CP-04 not complete. Not production | Environment policy; v1 unchanged | Remaining CP-04 items stay on issue #4 |
| CP-05 | WS3 | main | MERGED / VERIFIED | PR #32 merged as `095696f15cd64b546003bc5c77b4600af7bc4c76` after @Ben-001-sys APPROVED; required CI passed; issue #5 CLOSED / COMPLETED | v1.0.0 unchanged | Complete |
| CI-01 | WS3 | main | MERGED / VERIFIED; lease RELEASED | PR #38 merged as `8e058d679bb02e96374c0e79cc32d025b6a9ed03` after @Ben-001-sys APPROVED | none | Complete (before FE-02) |
| FE-01 | @Ben-001-sys / WS1 | main | MERGED / COMPLETED | PR #33; issue #6 CLOSED / COMPLETED | Prototype→v1 mapping | Complete |
| FE-02 | @Ben-001-sys / WS1 | main | MERGED / COMPLETED | PR #37 merged as `ceea3c4ebb3b95d7c3195d6cc089d1f3713d1d19`; issue #7 CLOSED / COMPLETED; CI-01 prerequisite satisfied | none | Complete |
| BR-01 | WS2; on main via R2 | main | INTEGRATED_AND_TESTED / LIVE WORDPRESS HEALTH VERIFIED | R2 PR #43 merge `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77`. Exact SHA `280a73dbcd53ac0e03883775b4fabdec7465a4a8` imported as `0ac2e38befb54c9ada404e6854a80285bebb69b9`. Training plugin `0.1.0-br01` health 401/403/200 evidenced at CP-04 `67ea42c…`. Not pricing parity, checkout, or production | Bridge v1 | Complete for R2 |
| BR-02 | WS2; on main via R3 | main | ACCEPTED / MERGED / POST-MERGE VERIFIED (issue #14) | R3 PR #44 merge `516d6a49af74cc6677f67bdf843de6e819a05feb`. Training plugin `0.2.7-br02`. `pricingParityVerified` false | QuoteRequest, Quote, ApiFailure v1.0.0 | Complete for R3 |
| BR-03 | WS2; on main via R3 | main | ACCEPTED / MERGED / POST-MERGE VERIFIED (issue #15) | Same R3 merge. WoodMart 19/20/21 MATCH on training. `pricingParityVerified` false | Quote v1.0.0; pricing corpus | Complete for R3 |
| BR-04 | WS2; on main via R3 | main | ACCEPTED / MERGED / POST-MERGE VERIFIED (issue #16) | Same R3 merge. ADR-013 multi-line cart-total MATCH_EXACT. `pricingParityVerified` false | CustomerContext, Quote v1.0.0; ADR-013 | Complete for R3 |
| BR-05 | WS2; on main via R3 | main | ACCEPTED / MERGED / POST-MERGE VERIFIED (issue #17) | Same R3 merge. Overlap MATCH; one-cart WoodMart+fee N/A. `pricingParityVerified` false (no v1 env field). Not production | Quote/error v1.0.0; pricing matrix | Complete for R3 |
| CORE-01 | WS3 | main | ACCEPTED / MERGED / VERIFIED; lease RELEASED | R1 PR #40 merge `aa08d74f2cb99301817e5995f01486acb7e2169f`; independent review APPROVED by @Ben-001-sys on `260be7f72b79bdbf2895ecfd06742db059b1496e`; post-merge main CI PASS. Issue #20 remains the historical task record; do not recreate | POS operational models v1.0.0 | Complete |
| CORE-02 | WS3 | main via R2 | COMPLETE FOR R2 (issue #21); durable store **VERIFIED** | PR #43 merge `ab9aa5ae…`. Trusted assignment roles, mutation protection, Supabase Auth adapter, ephemeral store still refused for production/staging. `pos_staff_sessions` added because CORE-01 tables cannot store sessions | IdentityPort, Session v1.0.0 | Complete for R2 |
| CORE-03 | WS3 | main via R2 | LIVE RUNTIME ACCEPTED (issue #22) | PR #43 merge `ab9aa5ae…`. Training WordPress health verified (CP-04 `67ea42c…`). Live BFF hops: durable session VERIFIED; Browser/BFF→Supabase VERIFIED; BFF→bridge→Woo VERIFIED. Detection is not pricing parity | StoreHealth, BridgeHealth, ApiFailure v1.0.0 | Complete for R2 |
| CORE-04 | WS3 / @wbdevworld | `ws3/core-04-implement-catalog-projection-and-durable-loca`; imported into #41 as `73b3fd9…` / `0b94141…` | INTEGRATED_AND_TESTED (issue #23) | Isolated from R3 main `516d6a49…`. 5,000-item fixture evidenced. CatalogPort, CartDraftStore, OperationJournal v1.0.0 frozen | CatalogPort, CartDraftStore, OperationJournal v1.0.0 | R4 first |
| FE-03 | @Ben-001-sys / WS1; R4 editor @wbdevworld | PR #41 `ws1/fe-03-build-sell-cart-barcode-and-customer-workflow` | RUNTIME COMPLETE / INTEGRATED_AND_TESTED (issue #8) | Isolated runtime SHA `99b6102…` imported. Emmanuel review remediation: stable Sell init. Preparation commits preserved. App Router mounted by WS3 | CatalogPort, CustomerPort, CartDraftStore v1.0.0 | R4 after CORE-04 |
| FE-04 | @Ben-001-sys / WS1; R4 editor @wbdevworld | same #41 | QUOTE-STATE INTEGRATION COMPLETE (issue #9) | Isolated runtime SHA `910c31c…` imported. Live `changed` reachable on same-revision revalidation. No sale/payment | PricingPort, QuoteState, CheckoutEligibility v1.0.0 | R4 last |

## Central edit lease

- **Editor:** WS3 senior / @wbdevworld. One R4 integration editor. WS1 human owner remains Developer 1 / @Ben-001-sys. Parallel agents must not edit the same central files or share a mutable checkout.
- **Task / batch:** R4 — Catalog/barcode/Sell/customer/quote states. Queue **CORE-04 → FE-03 → FE-04**.
- **Branch:** existing PR #41 `ws1/fe-03-build-sell-cart-barcode-and-customer-workflow`. Base `origin/main` `516d6a49af74cc6677f67bdf843de6e819a05feb`. Isolated CORE-04 contributor: `ws3/core-04-implement-catalog-projection-and-durable-loca`. Isolated FE-03/FE-04 continuations are created from declared combined SHAs; they are not concurrent editors of #41.
- **Lease type:** R4 milestone integration lease. Reuse draft PR #41; no second R4 milestone PR unless #41 becomes technically unusable and the reason is recorded; no self-merge; no self-approve.
- **Allowed:** CORE-04 paths `apps/pos-web/src/core/**`, `apps/pos-web/src/server/**`, `apps/pos-web/src/local/**`, `supabase/**`, `tests/integration/sync/**`; `tests/integration/rls/**` and `supabase/tests/rls_isolation.sql` solely for catalog-projection RLS assertions; WS1 FE-03/FE-04 paths `apps/pos-web/src/features/**`, `apps/pos-web/src/ui/**`, `tests/frontend/**` on isolated WS1 continuation branches; integration-editor App Router `apps/pos-web/src/app/**` when mounting Sell/quote; scoped Dexie toolchain `apps/pos-web/package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` (Dexie + test IndexedDB polyfill only); `apps/pos-web/vitest.config.mts` and `tests/tooling/test_vitest_discovery.py` solely to discover `tests/integration/sync/**`; this file; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/STATUS.md`; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/HANDOFF.md`; `docs/workstreams/WS-01-FRONTEND-UX/STATUS.md`; `docs/workstreams/WS-01-FRONTEND-UX/HANDOFF.md`; `docs/plans/TASK-INDEX.md` (R3/R4/CORE-04/FE-03/FE-04 lines); `docs/plans/MILESTONE-REVIEWS.md` (R3/R4 snapshot rows); `docs/integration/evidence/R4-*.md`; `docs/integration/evidence/CORE-04-*.md`; `docs/architecture/DATA-OWNERSHIP.md` (catalog-projection sentence only); `docs/decisions/ADR/013.md` and `docs/decisions/DECISION-REGISTER.md` solely to record ADR-013 accepted through reviewed R3 merge. Isolated contributor branches/worktrees may be imported only as declared tested SHAs.
- **Forbidden:** `reference/**`; recreating FE-01/FE-02 or PR #41; starting R5; BR-06/CORE-05/sale settlement/payment/order effects; copying WoodMart/B2BKing formulas into frontend; asserting `pricingParityVerified=true`; closing issue #4; calling CP-04 globally complete; rewriting historical R3 evidence; production promotion; privileged secrets in browser storage; production/customer PII fixtures; history rewrite/force-push of #41.
- **R3 lease:** RELEASED after reviewed merge of PR #44 (`516d6a49…`) and green post-merge main CI run 34778771391.
- **R2 lease:** RELEASED after reviewed merge of PR #43.
- **CORE-01 lease:** RELEASED after reviewed merge of PR #40.
- **CI-01 lease:** RELEASED after reviewed merge of PR #38.
- **CP-04:** DEVELOPMENT BASELINE SATISFIED; W1 PASS on training; W4 PASS on training WordPress (`67ea42c…` / `edf24af…`). Issue #4 remains OPEN. Overall CP-04 not complete. Mail containment must stay preserved. Do not reactivate MailPoet.
- **ADR-012:** ACTIVE team-wide (R1/#40 on main). This is a NEW R4 milestone, not Pass 3 of R3.
- **ADR-013:** accepted through reviewed R3 merge. Training-specific. `pricingParityVerified` remains false.
- **Release condition:** lease releases after reviewed merge of the R4 milestone PR, or explicit senior reassignment. This assignment does not merge #41.

Required checks remain `control-plane` and `control-plane-windows`. This task does not change branch-protection settings.

Evidence: R3 APPROVED / MERGED / POST-MERGE VERIFIED. PR #44 merge `516d6a49af74cc6677f67bdf843de6e819a05feb`. @Ben-001-sys APPROVED `6debd93bb6b7862d30217ebf4fe5a798080199a8`. Post-merge main CI run 34778771391 success (`control-plane` and `control-plane-windows`). Start snapshot: `docs/integration/evidence/R4-START-FRESHNESS.md`. Do not recreate R1, R2, R3, FE-01, or FE-02. Do not close issue #4. Do not call CP-04 globally complete. Do not start R5.

## R4 batch workflow record — current (supersedes the R3 editor lease)

- Batch / milestone: **R4**, ordered tasks CORE-04, then FE-03, then FE-04. One R4 PR: existing **#41**. Independent reviewer for assembled/remediated heads: **@Emmanuel-coder-prog** (PR author @Ben-001-sys cannot satisfy independent GitHub approval). No self-merge. WS1 owner: @Ben-001-sys.
- Independent-review remediation START_FRESHNESS_SNAPSHOT UTC: `2026-09-13T22:15:30Z`. Reviewed head `31bbfcccb6e0be6e944c12f4d580cc20ba7c69ad`. Evidence: `docs/integration/evidence/R4-REVIEW-REMEDIATION-START-FRESHNESS.md`. This is not Pass 3 of the journal-idempotency session.
- Independent-review remediation final freshness: **FRESH_2**. Evidence: `docs/integration/evidence/R4-REVIEW-REMEDIATION-FRESHNESS.md`. Both upstream cutoffs `516d6a49…`. Pass 2 UTC `2026-09-13T22:42:36Z`. Pre-handoff implementation SHA `3621c620dbab4e2ef245637fba4120c0ab346662`.
- Three Emmanuel merge blockers addressed: stable Sell init factories; live same-revision `changed` quote; catalog cursor = last returned id. Evidence: `docs/integration/evidence/R4-REVIEW-REMEDIATION.md`.
- PRE-R5 HARDENING (recorded, not implemented): catalog query/index performance; QuoteRequest/Quote runtime schema validation.
- Milestone delivery: **AWAITING INDEPENDENT RE-REVIEW**. Do not merge. Do not start R5. Do not dismiss Emmanuel’s `CHANGES_REQUESTED` on `31bbfcc…`.
- START_FRESHNESS_SNAPSHOT UTC: `2026-09-13T20:11:27Z`. origin/main / R3 merge `516d6a49af74cc6677f67bdf843de6e819a05feb`. Evidence: `docs/integration/evidence/R4-START-FRESHNESS.md`.
- Journal-idempotency continuation START_FRESHNESS_SNAPSHOT UTC: `2026-09-13T21:25:29Z`. Evidence: `docs/integration/evidence/R4-JOURNAL-IDEMPOTENCY-START-FRESHNESS.md`. This is not Pass 3 of the assembled-R4 session.
- Journal-idempotency continuation final freshness: **FRESH_2**. Evidence: `docs/integration/evidence/R4-JOURNAL-IDEMPOTENCY-FRESHNESS.md`. Both upstream cutoffs `516d6a49…`. Pass 2 UTC `2026-09-13T21:39:35Z`. Pre-handoff implementation SHA `11bdbd9c6bb5004e9dd70a203a53becdf191728e`.
- PR #41 previous head `700dc3289d7d108d2eba8682c72c95feb2079c26` forward-merged `origin/main` to `a23f3d67293f6c5ddada89811ae9c2c0039de00b` without history rewrite. Six preparation commits preserved.
- Prior assembled implementation SHA: `e0cc5ec407a25e174d5ee0ef376d64d64c818f5f`. Combined evidence: `docs/integration/evidence/R4-COMBINED-ACCEPTANCE.md`. Prior freshness **FRESH_2**: `docs/integration/evidence/R4-FRESHNESS.md`.
- CORE-04 contributor worktree: `C:\Users\Jane\Desktop\Learning 2026\Cursor\cetech-pwa-pos-ws3-core-04` from `516d6a49…`. Isolated FE-03 `ws1/fe-03-runtime-catalog-ports`; isolated FE-04 `ws1/fe-04-quote-state-runtime`.
- `pricingParityVerified` remains false. Issue #4 stays OPEN. Training plugin/evidence remains training-specific. R5 is not activated.

## R3 batch workflow record — historical (APPROVED / MERGED / POST-MERGE VERIFIED)

- Batch / milestone: **R3**, ordered tasks BR-02, then BR-03 and BR-04, then BR-05. PR **#44 APPROVED / MERGED / POST-MERGE VERIFIED**. Independent reviewer: **@Ben-001-sys** APPROVED `6debd93bb6b7862d30217ebf4fe5a798080199a8`. Merged main commit: `516d6a49af74cc6677f67bdf843de6e819a05feb` at `2026-09-13T19:47:38Z`. Post-merge main CI PASS (run 34778771391; `control-plane` and `control-plane-windows`). R3 integration lease RELEASED on merge. Historical R3 evidence files were not rewritten. Training plugin/evidence remains training-specific. `pricingParityVerified` remains false. Issue #4 stays OPEN. CP-04 is not globally complete.
- Historical R3 assembly record below is preserved as written during the open #44 lease (review-request wording is historical):
- Batch / milestone: **R3**, ordered tasks BR-02, then BR-03 and BR-04, then BR-05. One R3 PR only: `[R3] Authoritative Woo/WoodMart/B2BKing pricing parity`. Independent reviewer: **@Ben-001-sys**. Request review on the exact final SHA after FRESH_2 + CI green. No self-merge. WS2 owner: @Emmanuel-coder-prog.
- START_FRESHNESS_SNAPSHOT UTC: `2026-09-13T15:35:02Z`. origin/main / R2 merge `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77`. Editor candidate `batch/r3-authoritative-pricing-parity` created from that SHA. Contract version v1.0.0. ADRs 011 CURRENT, 012 ACTIVE. Evidence: `docs/integration/evidence/R3-START-FRESHNESS.md`.
- BR-01: accepted through R2 on main. Exact SHA `280a73d…` imported as `0ac2e38…`. Live WordPress health VERIFIED via CP-04 `67ea42c…` / `edf24af…`. `pricingParityVerified` false.
- Live training quote/parity: captured 2026-09-13T18:58:36Z on training plugin `0.2.7-br02` (ADR-013 multi-line) plus prior single-line matrix regression 2026-09-13T19:02:19Z. Evidence `docs/integration/evidence/R3-CART-DISCOUNT.md`. Guest REFUSAL_MATCH. Retail/WoodMart/B2B cart-total/overlap MATCH_EXACT vs Woo. Multi-line cart-level discount MATCH_EXACT. `pricingParityVerified` false. Training R3 gate **PASS candidate**. Issue #4 stays OPEN.
- Cart-discount continuation START_FRESHNESS_SNAPSHOT UTC: `2026-09-13T18:41:55Z`. Evidence: `docs/integration/evidence/R3-CART-DISCOUNT-START-FRESHNESS.md`. This is not Pass 3 of the B2BKing-effect session.
- Cart-discount continuation final freshness: **FRESH_2**. Evidence: `docs/integration/evidence/R3-CART-DISCOUNT-FRESHNESS.md`. Both upstream cutoffs `ab9aa5ae…`. Pass 2 UTC `2026-09-13T19:07:50Z`. Pre-handoff implementation SHA `006667a…`.
- Exact-head suite on this continuation tree (do not reuse prior 202/128): `python scripts/verify_control_plane.py` PASS (3 workstream packages, 30 scoped tasks/DAG, 28 immutable reference files, 61 schemas, 22 contract fixtures). `python -m unittest discover -s tests/tooling -v` **48 tests OK**. `make -C wordpress/cetech-pos-bridge check` PASS. `make -C wordpress/cetech-pos-bridge test` **245 passed, 0 failed**. `make -C wordpress/cetech-pos-bridge parity` **138 passed, 0 failed, 19 skipped**. `git diff --check` clean. PHP `C:\tools\php85\php.exe`; GNU Make via WSL.
- B2BKing-effect continuation START_FRESHNESS_SNAPSHOT UTC: `2026-09-13T17:19:45Z`. Evidence: `docs/integration/evidence/R3-B2BKING-EFFECT-START-FRESHNESS.md`. This is not Pass 3 of the training-live session.
- B2BKing-effect continuation final freshness: **FRESH_2**. Evidence: `docs/integration/evidence/R3-B2BKING-EFFECT-FRESHNESS.md`. Both upstream cutoffs `ab9aa5ae…`. Pass 2 UTC `2026-09-13T18:18:26Z`. Pre-handoff implementation SHA `e71bc3ee…`.
- Prior training-live continuation START_FRESHNESS_SNAPSHOT UTC: `2026-09-13T16:23:57Z`. Evidence: `docs/integration/evidence/R3-TRAINING-LIVE-START-FRESHNESS.md`.
- Prior training-live continuation final freshness: **FRESH_2**. Evidence: `docs/integration/evidence/R3-TRAINING-LIVE-FRESHNESS.md`. Both upstream cutoffs `ab9aa5ae…`. Pass 2 UTC `2026-09-13T17:08:52Z`. That session's delivery was BLOCKED (cart-total effect not yet demonstrated).
- Prior unitPrice continuation START_FRESHNESS_SNAPSHOT UTC: `2026-09-13T16:06:08Z`. Evidence: `docs/integration/evidence/R3-UNITPRICE-START-FRESHNESS.md`.
- Prior unitPrice continuation final freshness: **FRESH_2**. Evidence: `docs/integration/evidence/R3-UNITPRICE-FRESHNESS.md`. Both upstream cutoffs `ab9aa5ae…`.
- QuoteLine `unitPrice` mapping was corrected before the training-live continuation. Guest priced path remains absent. Extra B2BKing rule types and tax-on remain N/A.
- Issue #4 stays OPEN. Overall CP-04 not complete. R4–R10 are not activated by this lease. PR #41 remains R4 preparation.

## R2 batch workflow record — historical (APPROVED / MERGED / VERIFIED)

- Batch / milestone: **R2**, ordered tasks BR-01 (WS2 contributor), CORE-02, CORE-03. PR **#43 APPROVED / MERGED / VERIFIED**.
- Merged main commit: `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77`. Merged at `2026-09-13T15:23:35Z`. Post-merge main CI PASS (run 34765462210; `control-plane` and `control-plane-windows`).
- Independent reviewer: **@Ben-001-sys**.
- BR-01: exact SHA `280a73dbcd53ac0e03883775b4fabdec7465a4a8` imported as `0ac2e38befb54c9ada404e6854a80285bebb69b9`. Normalization tests `130437d6…` imported as `605e6f2…`. Exact-head Make on `0deafa3…`: `check` PASS, `test` **83 passed / 0 failed**. Training WordPress health **VERIFIED** via CP-04 W4 `67ea42ce03142fb9f0ca18446b8146b0815ea621` / head `edf24af…`. Classification **INTEGRATED_AND_TESTED / LIVE WORDPRESS HEALTH VERIFIED**.
- CORE-02 durable `StaffSessionStore` **VERIFIED**. CORE-03 live BFF hops **VERIFIED**. CP04-W1/W4 WordPress side PASS. Pricing parity FALSE / NOT TESTED on R2. No orders/stock/payments/production from R2.
- R2 integration lease RELEASED on merge. Do not recreate R2. Historical freshness: `docs/integration/evidence/R2-START-FRESHNESS-BR01-MAKE-VERIFY.md` and related R2-*.md files.

## R1 batch workflow record — historical (APPROVED / MERGED / VERIFIED)

- Batch / milestone: **R1**, CORE-01 plus workflow adoption; PR **#40 APPROVED / MERGED / VERIFIED**.
- Independent reviewer: **@Ben-001-sys** APPROVED final head `260be7f72b79bdbf2895ecfd06742db059b1496e`.
- Merged main commit: `aa08d74f2cb99301817e5995f01486acb7e2169f`. Post-merge main CI PASS (run 34717692049).
- Approved main base SHA at R1 assembly: `cd4477f185c159e18ed939a20145865d665099b4`.
- CORE-01 lease RELEASED. Do not recreate R1 or CORE-01.
- WS1 independent R4 lane: reuse #41 at inspected head `ede771bdbe5f05c8b517ce5168c9d8515a354e28`. Authorized queue FE-03 then FE-04; currently PREP_ONLY frozen mock presentation/failure tests for evidenced gaps. FE-02 accepted; actual CORE-04 and BR-05 prerequisites still block runtime integration/checkout acceptance. No arbitrary import of #40/#41 peer work. Later FE tasks follow TASKS after their milestone activation.
- WS2 independent R2 lane: BR-01 local skeleton/permission/health implementation under ADR-011 and existing task #13. Record actual contributor branch/head at first checkpoint. R3 queue BR-02 → BR-03/BR-04 → BR-05 conditionally follows its prerequisite and declared milestone activation. Local fixture preparation allowed; real parity remains gated.
- Later progression: workstream TASKS queues and [R1–R10 mapping](docs/plans/MILESTONE-REVIEWS.md). Existing task acceptance controls; an open foundation issue alone does not undo an approved contract baseline.
- Authorized environments: local synthetic fixtures; read-only authorized training observations. No new remote installation, database/commerce/payment/email/stock effects granted by adoption. Unsafe training writes remain blocked by CP-04.
- Remote effects allowed for adoption: repository governance commits, existing PR metadata/comments/reviewer request, CI execution. No application deployment or production promotion.
- Checkpoint/freshness evidence: [R1 adoption evidence](docs/integration/evidence/R1-WORKFLOW-ADOPTION.md) and merged #40. Historical R1 blockers (pending Ben review) are closed by the APPROVED merge.
- R1 editor lease released on merge. R2 records a new lease above. Issue #20 is not recreated; issue #4 stays OPEN.

## R1/R2/R3 workflow metrics

Observed values are UNVERIFIED until measured; do not interpret blanks as zero. Each workstream reports deltas through its own handoff; WS3 maintains this table.

| Metric | R1 | R2 | R3 | Evidence method |
| --- | --- | --- | --- | --- |
| Human interruptions / prompts per accepted task | UNVERIFIED | UNVERIFIED | UNVERIFIED | Session/handoff counts; distinguish milestone review from routine prompts |
| Review waiting time / branch age | UNVERIFIED | UNVERIFIED | UNVERIFIED | Ready-for-review, branch start and review/merge UTC |
| Time since combined integration | UNVERIFIED | UNVERIFIED | UNVERIFIED | Last combined build SHA/UTC |
| Pass-1 / Pass-2 stale findings | 0 / 0 for workflow adoption; both cutoffs `cd4477f` | 0 / 0; this continuation both cutoffs `aa08d74f…` / `280a73d…` (`2026-09-12T23:28:42Z` / `2026-09-12T23:29:59Z`) | 0 / 0; latest continuation both cutoffs `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77`; Pass 2 UTC `2026-09-13T19:07:50Z`; FRESH_2 | Final freshness classifications |
| Drift rework / integration conflicts | 0 / 0 for workflow adoption; excludes earlier CORE-01 work | UNVERIFIED | UNVERIFIED | Scoped corrective commits and conflict records |
| Defects found at review | UNVERIFIED | UNVERIFIED | UNVERIFIED | Findings attributable to this batch |
| Review duration / comprehension | UNVERIFIED | UNVERIFIED | UNVERIFIED | Reviewer minutes and can explain invariants: yes/no |

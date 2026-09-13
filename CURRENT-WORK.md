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
| BR-02 | WS2 / @Emmanuel-coder-prog; R3 editor @wbdevworld | batch/r3-authoritative-pricing-parity | LIVE RETAIL/VARIATION MATCH; guest REFUSAL_MATCH; concurrent VERIFIED (issue #14) | Isolated Woo quote on training `0.2.6-br02`. Guest cannot purchase (B2BKing). HTTP concurrent 12/12. Training gate PASS candidate; `pricingParityVerified` false | QuoteRequest, Quote, ApiFailure v1.0.0 | R3 first |
| BR-03 | WS2 | batch/r3-authoritative-pricing-parity | LIVE WOODMART 19/20/21 MATCH (issue #15) | Configured from-qty 20; empty to-qty; qty 21 unit 3800 in fresh process. No invented thresholds | Quote v1.0.0; pricing corpus | R3 after BR-02 |
| BR-04 | WS2 | batch/r3-authoritative-pricing-parity | LIVE cart-total MATCH_EXACT; extra types N/A (issue #16) | Rules 49250/49253 on group 49242. Kind switch 403 | CustomerContext, Quote v1.0.0 | R3 after BR-02 |
| BR-05 | WS2 | batch/r3-authoritative-pricing-parity | LIVE OVERLAP MATCH; training gate PASS candidate (issue #17) | Tax-off N/A. `pricingParityVerified` false (no v1 env field) | Quote/error v1.0.0; pricing matrix | R3 last |
| CORE-01 | WS3 | main | ACCEPTED / MERGED / VERIFIED; lease RELEASED | R1 PR #40 merge `aa08d74f2cb99301817e5995f01486acb7e2169f`; independent review APPROVED by @Ben-001-sys on `260be7f72b79bdbf2895ecfd06742db059b1496e`; post-merge main CI PASS. Issue #20 remains the historical task record; do not recreate | POS operational models v1.0.0 | Complete |
| CORE-02 | WS3 | main via R2 | COMPLETE FOR R2 (issue #21); durable store **VERIFIED** | PR #43 merge `ab9aa5ae…`. Trusted assignment roles, mutation protection, Supabase Auth adapter, ephemeral store still refused for production/staging. `pos_staff_sessions` added because CORE-01 tables cannot store sessions | IdentityPort, Session v1.0.0 | Complete for R2 |
| CORE-03 | WS3 | main via R2 | LIVE RUNTIME ACCEPTED (issue #22) | PR #43 merge `ab9aa5ae…`. Training WordPress health verified (CP-04 `67ea42c…`). Live BFF hops: durable session VERIFIED; Browser/BFF→Supabase VERIFIED; BFF→bridge→Woo VERIFIED. Detection is not pricing parity | StoreHealth, BridgeHealth, ApiFailure v1.0.0 | Complete for R2 |

## Central edit lease

- **Editor:** WS3 senior / @wbdevworld. One R3 batch-branch editor. WS2 human owner remains Developer 2 / @Emmanuel-coder-prog. Parallel agents must not edit the same central files.
- **Task / batch:** R3 — Authoritative Woo/WoodMart/B2BKing pricing parity. Queue **BR-02 → BR-03 / BR-04 → BR-05**.
- **Branch:** `batch/r3-authoritative-pricing-parity`. Base `origin/main` `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77`.
- **Lease type:** R3 milestone integration lease. One draft R3 PR; no ordinary per-task PRs; no self-merge; no self-approve.
- **Allowed:** `wordpress/cetech-pos-bridge/**`; `tests/bridge/**`; `tests/fixtures/commerce/**`; `docs/workstreams/WS-02-COMMERCE-BRIDGE/STATUS.md`; `docs/workstreams/WS-02-COMMERCE-BRIDGE/HANDOFF.md`; `docs/workstreams/WS-02-COMMERCE-BRIDGE/evidence/**`; this file; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/STATUS.md`; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/HANDOFF.md` (lease transfer snapshots only); `docs/plans/TASK-INDEX.md` (R2/R3/BR-02–BR-05 lines only); `docs/plans/MILESTONE-REVIEWS.md` (R2/R3 snapshot rows only); `docs/integration/evidence/R3-*.md`; `docs/runbooks/PRICING-PARITY.md` solely to record evidenced matrix rows. Isolated WS2 contributor branches/worktrees may be imported only as declared tested SHAs.
- **Forbidden:** `apps/**`; `supabase/**`; `docs/contracts/**`; `.github/**`; root config/lockfiles; `reference/**`; semantic CORE-04+/FE-03+; BR-06/BR-07; live Woo order/stock/payment/email/refund writes; remote/linked Supabase migrations; production promotion; copying WoodMart/B2BKing pricing formulas into the bridge or PWA; asserting `pricingParityVerified=true` before the R3 gate; deploying an R3 plugin to training without a new explicit authorization that names artifact SHA, rollback, and environment.
- **R2 lease:** RELEASED after reviewed merge of PR #43.
- **CORE-01 lease:** RELEASED after reviewed merge of PR #40.
- **CI-01 lease:** RELEASED after reviewed merge of PR #38.
- **CP-04:** DEVELOPMENT BASELINE SATISFIED; W1 PASS on training; W4 PASS on training WordPress (`67ea42c…` / `edf24af…`). Issue #4 remains OPEN. Overall CP-04 not complete. Mail containment must stay preserved. Do not reactivate MailPoet.
- **ADR-012:** ACTIVE team-wide (R1/#40 on main).
- **Release condition:** lease releases after reviewed merge of the R3 milestone PR, or explicit senior reassignment.

Required checks remain `control-plane` and `control-plane-windows`. This task does not change branch-protection settings.

Evidence: R2 APPROVED / MERGED / VERIFIED. PR #43 merge `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77`. Post-merge main CI run 34765462210 success (`control-plane` and `control-plane-windows`). Start snapshot: `docs/integration/evidence/R3-START-FRESHNESS.md`. Do not recreate R1, R2, or CORE-01. Do not close issue #4. Do not call CP-04 globally complete. Do not start R4 runtime integration from this task.

## R3 batch workflow record — current (supersedes the R2 editor lease)

- Batch / milestone: **R3**, ordered tasks BR-02, then BR-03 and BR-04, then BR-05. One R3 PR only: `[R3] Authoritative Woo/WoodMart/B2BKing pricing parity`. Keep DRAFT until the R3 gate is genuinely satisfied. No self-merge. Independent reviewer: **@Ben-001-sys** (request only at gate readiness). WS2 owner: @Emmanuel-coder-prog.
- START_FRESHNESS_SNAPSHOT UTC: `2026-09-13T15:35:02Z`. origin/main / R2 merge `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77`. Editor candidate `batch/r3-authoritative-pricing-parity` created from that SHA. Contract version v1.0.0. ADRs 011 CURRENT, 012 ACTIVE. Evidence: `docs/integration/evidence/R3-START-FRESHNESS.md`.
- BR-01: accepted through R2 on main. Exact SHA `280a73d…` imported as `0ac2e38…`. Live WordPress health VERIFIED via CP-04 `67ea42c…` / `edf24af…`. `pricingParityVerified` false.
- Live training quote/parity: captured 2026-09-13T18:06:43Z on training plugin `0.2.6-br02`. Evidence `docs/integration/evidence/R3-B2BKING-EFFECT.md`. Guest REFUSAL_MATCH. Retail/WoodMart/B2B cart-total/overlap MATCH_EXACT vs Woo. Concurrent HTTP 12/12. `pricingParityVerified` false. Training R3 gate **PASS candidate**. Issue #4 stays OPEN.
- Exact-head suite on this continuation tree (do not reuse prior 179/120): `python scripts/verify_control_plane.py` PASS (3 workstream packages, 30 scoped tasks/DAG, 28 immutable reference files, 61 schemas, 22 contract fixtures). `python -m unittest discover -s tests/tooling -v` **48 tests OK**. `make -C wordpress/cetech-pos-bridge check` PASS. `make -C wordpress/cetech-pos-bridge test` **202 passed, 0 failed**. `make -C wordpress/cetech-pos-bridge parity` **128 passed, 0 failed, 14 skipped**. `git diff --check` clean. PHP `C:\tools\php85\php.exe`; GNU Make via WSL.
- B2BKing-effect continuation START_FRESHNESS_SNAPSHOT UTC: `2026-09-13T17:19:45Z`. Evidence: `docs/integration/evidence/R3-B2BKING-EFFECT-START-FRESHNESS.md`. This is not Pass 3 of the training-live session.
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
| Pass-1 / Pass-2 stale findings | 0 / 0 for workflow adoption; both cutoffs `cd4477f` | 0 / 0; this continuation both cutoffs `aa08d74f…` / `280a73d…` (`2026-09-12T23:28:42Z` / `2026-09-12T23:29:59Z`) | 0 / 0; latest continuation both cutoffs `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77`; Pass 2 UTC `2026-09-13T17:08:52Z`; FRESH_2 | Final freshness classifications |
| Drift rework / integration conflicts | 0 / 0 for workflow adoption; excludes earlier CORE-01 work | UNVERIFIED | UNVERIFIED | Scoped corrective commits and conflict records |
| Defects found at review | UNVERIFIED | UNVERIFIED | UNVERIFIED | Findings attributable to this batch |
| Review duration / comprehension | UNVERIFIED | UNVERIFIED | UNVERIFIED | Reviewer minutes and can explain invariants: yes/no |

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
| BR-01 | WS2; on main via R2 | main | ACCEPTED as part of R2 | R2 PR #43 merge `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77`. Exact SHA `280a73dbcd53ac0e03883775b4fabdec7465a4a8` imported as `0ac2e38befb54c9ada404e6854a80285bebb69b9`. Training plugin `0.1.0-br01` health 401/403/200 evidenced at CP-04 `67ea42c…`. Not pricing parity, checkout, or production. Issue #13 remains the historical task record; do not recreate | Bridge v1 | Complete for R2 |
| BR-02 | WS2 / @Emmanuel-coder-prog | declared `ws2/br-02-implement-isolated-woo-runtime-quote-spike` (no remote at activation) | R3 AUTHORIZED; first executable WS2 R3 task (issue #14 OPEN) | BR-01 ACCEPTED through R2. Milestone R3 **activated**. Local/synthetic quote work authorized in issue #14 paths. Live guest/retail/isolation/parity acceptance is **not** granted by activation. Woo runtime remains authoritative; no parallel pricing engine | QuoteRequest, Quote, ApiFailure v1.0.0 | R3 first |
| BR-03 | WS2 | `ws2/br-03-prove-woodmart-tier-pricing-parity` | R3 queued; **not executable** until BR-02 | Depends on BR-02. Local fixture prep only where already authorized; live WoodMart parity is not granted | Quote v1.0.0; pricing corpus | R3 after BR-02 |
| BR-04 | WS2 | `ws2/br-04-prove-b2bking-commercial-parity` | R3 queued; **not executable** until BR-02 | Depends on BR-02. May be prepared independently of BR-03 after BR-02. Live B2BKing parity is not granted | CustomerContext, Quote v1.0.0 | R3 after BR-02 |
| BR-05 | WS2 | `ws2/br-05-resolve-plugin-overlap-and-pass-pricing-gate` | R3 queued; **not executable** until BR-03 + BR-04 | Depends on BR-03 and BR-04. Pricing gate and `pricingParityVerified=true` are not granted | Quote/error v1.0.0; pricing matrix | R3 last |
| CORE-01 | WS3 | main | ACCEPTED / MERGED / VERIFIED; lease RELEASED | R1 PR #40 merge `aa08d74f2cb99301817e5995f01486acb7e2169f`; independent review APPROVED by @Ben-001-sys on `260be7f72b79bdbf2895ecfd06742db059b1496e`; post-merge main CI PASS. Issue #20 remains the historical task record; do not recreate | POS operational models v1.0.0 | Complete |
| CORE-02 | WS3 | main via R2 | ACCEPTED / COMPLETE FOR R2 (issue #21); durable store **VERIFIED** | PR #43 merge `ab9aa5ae…`. Trusted assignment roles, mutation protection, Supabase Auth adapter, ephemeral store still refused for production/staging. `pos_staff_sessions` added because CORE-01 tables cannot store sessions. Issue #21 remains the historical task record; do not recreate | IdentityPort, Session v1.0.0 | Complete for R2 |
| CORE-03 | WS3 | main via R2 | ACCEPTED / LIVE RUNTIME ACCEPTED (issue #22) | PR #43 merge `ab9aa5ae…`. Training WordPress health verified (CP-04 `67ea42c…`). Live BFF hops: durable session VERIFIED; Browser/BFF→Supabase VERIFIED; BFF→bridge→Woo VERIFIED. Detection is not pricing parity. Issue #22 remains the historical task record; do not recreate | StoreHealth, BridgeHealth, ApiFailure v1.0.0 | Complete for R2 |

## Central edit lease

- **Editor:** WS3 senior / @wbdevworld for this coordination closeout only.
- **Task / batch:** R2 closeout + explicit R3 activation. Not BR-02 implementation.
- **Branch:** `ws3/r2-closeout-r3-activation`. Base `origin/main` `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77`.
- **Lease type:** post-merge coordination lease. R2 central **integration** lease is **RELEASED**. This closeout does not assemble R3 product code. One R3 milestone PR remains the later assembly surface.
- **Allowed:** this file; `docs/plans/MILESTONE-REVIEWS.md` (R2/R3 snapshot rows); `docs/plans/TASK-INDEX.md` (R2/R3/BR-01–BR-05 and CORE-02/CORE-03 lines); `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/STATUS.md`; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/HANDOFF.md`; `docs/integration/evidence/R2-CLOSEOUT-R3-ACTIVATION.md`.
- **Forbidden:** `apps/**`; `supabase/**`; `docs/contracts/**`; `.github/**`; root config/lockfiles; `reference/**`; `wordpress/**`; `tests/bridge/**`; `tests/fixtures/commerce/**`; BR-02/BR-03/BR-04/BR-05 plugin implementation; live Woo order/stock/payment/email writes; remote/linked Supabase migrations; production promotion; inventing contract semantics; asserting `pricingParityVerified=true`; claiming R2/R3 production or cutover readiness.
- **R2 lease:** **RELEASED** after reviewed merge of PR #43 and verified post-merge main CI.
- **CORE-01 lease:** RELEASED after reviewed merge of PR #40.
- **CI-01 lease:** RELEASED after reviewed merge of PR #38.
- **CP-04:** DEVELOPMENT BASELINE SATISFIED; W1 PASS on training; W4 PASS on training WordPress (`67ea42c…` / `edf24af…`). Issue #4 remains OPEN. Overall CP-04 not complete. Mail containment must stay preserved.
- **ADR-012:** ACTIVE team-wide (R1/#40 on main).
- **Release condition:** this coordination lease releases after the closeout lands on main, or explicit senior reassignment.

Required checks remain `control-plane` and `control-plane-windows`. This task does not change branch-protection settings.

Evidence: R2 APPROVED / MERGED / VERIFIED. PR #43 merge `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77`. Final reviewed head `e1a6e005cad6728e552d4d8266dde6fd84b0c578`. @Ben-001-sys APPROVED that exact head. Post-merge main CI run 34765462210 success (`control-plane` job 103745854088; `control-plane-windows` job 103745854668). `pricingParityVerified=false` remains explicit. Issue #4 OPEN. R2 approval is not production/cutover readiness. Do not recreate R1 or R2.

## R3 batch workflow record — current (R2 integration lease RELEASED)

- Batch / milestone: **R3 EXPLICITLY ACTIVATED** 2026-09-13. Ordered WS2 queue: **BR-02** (issue #14) first executable; **BR-03 and BR-04** after BR-02 (not immediately executable); **BR-05** after BR-03 + BR-04. Activation is not live parity acceptance and not a pricing-gate pass.
- Declared R3 / BR-02 baseline: accepted `main` SHA `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77`. Do **not** continue from `ws2/br-01-build-bridge-health-and-permission-skeleton` (`62608937a05648a3d6dd077012082c1c0558fe99`) or the deleted `batch/r2-auth-bridge-bff` remote.
- Declared BR-02 contributor branch: `ws2/br-02-implement-isolated-woo-runtime-quote-spike`. Remote existence at activation: **absent**. This closeout does **not** create it.
- Observed parallel assembly (not consumed by this closeout): draft [PR #44](https://github.com/WB-DevWorld/cetech-pwa-pos/pull/44) `batch/r3-authoritative-pricing-parity` `7b593584cded9c587c135bbfe1eefb238bcbd177`, also based on `ab9aa5ae…`. Do not create a second BR-02 implementation branch while that assembly exists. This coordination does **not** accept, reject, or import #44 plugin work.
- BR-02 issue **#14** AUTHORIZED under existing task boundaries. Allowed: `wordpress/cetech-pos-bridge/**`; `tests/bridge/**`; `tests/fixtures/commerce/**`; WS2 STATUS/HANDOFF/evidence. Forbidden: `apps/**`; `supabase/**`; `docs/contracts/**`; `.github/**`; root config/lockfiles; `reference/**`. Contracts consumed unchanged: QuoteRequest, Quote, ApiFailure v1.0.0. Woo runtime is authoritative. No guessed WoodMart/B2BKing formulas. Quote must not create order or stock side effects. No production writes.
- Distinctions: **milestone activated** = R3 queue is live in this ledger. **Dependency ready** = BR-02 only (BR-01 accepted). **Local/synthetic** = authorized for BR-02 in allowed paths; missing PHP/Make/`parity` is `BLOCKED_VERIFICATION`, never invented PASS. **Live parity** = not granted; `pricingParityVerified` stays **false** until the R3 gate is actually evidenced.
- Required BR-02 commands: `python scripts/verify_control_plane.py`; `make -C wordpress/cetech-pos-bridge check`; `make -C wordpress/cetech-pos-bridge test`; `make -C wordpress/cetech-pos-bridge parity`.
- Human reviewer for a later R3 gate-ready head: **@Ben-001-sys**. Do not request review from this closeout. No self-merge. Do not start R4 from this activation. PR #41 remains R4 preparation.
- Issue #4 stays OPEN. Overall CP-04 not complete. Evidence: `docs/integration/evidence/R2-CLOSEOUT-R3-ACTIVATION.md`.

## R2 batch workflow record — historical (APPROVED / MERGED / VERIFIED)

- Batch / milestone: **R2**, ordered tasks BR-01 (WS2 contributor), CORE-02, CORE-03. PR **#43 APPROVED / MERGED / VERIFIED**. Title `[R2] Authentication, bridge health and BFF`. Merged at `2026-09-13T15:23:35Z`.
- Merged main commit: `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77`.
- Final reviewed PR head: `e1a6e005cad6728e552d4d8266dde6fd84b0c578`.
- Independent reviewer: **@Ben-001-sys** APPROVED that exact head (`2026-09-13T15:18:55Z`). Earlier COMMENTED review on `3a1b6b5…` and CHANGES_REQUESTED on `0deafa3…` are historical, not open blockers.
- Exact-head bridge verification on the implementation tree: `make check` PASS; `make test` **83 passed / 0 failed**.
- Required PR-head GitHub checks passed before merge. Post-merge main CI run **34765462210** (`push` on `ab9aa5ae…`): **success**. `control-plane` job 103745854088 success. `control-plane-windows` job 103745854668 success.
- BR-01 ACCEPTED as part of R2. Exact SHA `280a73dbcd53ac0e03883775b4fabdec7465a4a8` imported as `0ac2e38befb54c9ada404e6854a80285bebb69b9`. Normalization tests `130437d6…` imported as `605e6f2…`. Training WordPress health **VERIFIED** via CP-04 W4 `67ea42ce03142fb9f0ca18446b8146b0815ea621` / head `edf24af…`. Classification **INTEGRATED_AND_TESTED / LIVE WORDPRESS HEALTH VERIFIED**.
- CORE-02 ACCEPTED. Durable `StaffSessionStore` **VERIFIED**. CORE-03 ACCEPTED. Live BFF hops **VERIFIED**. CP04-W1/W4 WordPress side PASS. `pricingParityVerified=false` / NOT TESTED on R2. No orders/stock/payments/production from R2. R2 approval is not production or cutover readiness.
- R2 central integration lease **RELEASED** on verified post-merge CI. Remote `origin/batch/r2-auth-bridge-bff` is deleted. Do not recreate R2.
- Historical pre-merge ledger language (draft #43 still open; request Ben on a new head; do not start R3) is superseded by this closeout. Prior freshness snapshots remain in `docs/integration/evidence/R2-*.md`.

## R1 batch workflow record — historical (APPROVED / MERGED / VERIFIED)

- Batch / milestone: **R1**, CORE-01 plus workflow adoption; PR **#40 APPROVED / MERGED / VERIFIED**.
- Independent reviewer: **@Ben-001-sys** APPROVED final head `260be7f72b79bdbf2895ecfd06742db059b1496e`.
- Merged main commit: `aa08d74f2cb99301817e5995f01486acb7e2169f`. Post-merge main CI PASS (run 34717692049).
- Approved main base SHA at R1 assembly: `cd4477f185c159e18ed939a20145865d665099b4`.
- CORE-01 lease RELEASED. Do not recreate R1 or CORE-01.
- WS1 independent R4 lane: reuse #41 at inspected head `ede771bdbe5f05c8b517ce5168c9d8515a354e28`. Authorized queue FE-03 then FE-04; currently PREP_ONLY frozen mock presentation/failure tests for evidenced gaps. FE-02 accepted; actual CORE-04 and BR-05 prerequisites still block runtime integration/checkout acceptance. No arbitrary import of #40/#41 peer work. Later FE tasks follow TASKS after their milestone activation.
- Later progression: workstream TASKS queues and [R1–R10 mapping](docs/plans/MILESTONE-REVIEWS.md). Existing task acceptance controls; an open foundation issue alone does not undo an approved contract baseline.
- Authorized environments: local synthetic fixtures; read-only authorized training observations. No new remote installation, database/commerce/payment/email/stock effects granted by adoption. Unsafe training writes remain blocked by CP-04.
- Remote effects allowed for adoption: repository governance commits, existing PR metadata/comments/reviewer request, CI execution. No application deployment or production promotion.
- Checkpoint/freshness evidence: [R1 adoption evidence](docs/integration/evidence/R1-WORKFLOW-ADOPTION.md) and merged #40. Historical R1 blockers (pending Ben review) are closed by the APPROVED merge.
- R1 editor lease released on merge. Issue #20 is not recreated; issue #4 stays OPEN.

## R1/R2/R3 workflow metrics

Observed values are UNVERIFIED until measured; do not interpret blanks as zero. Each workstream reports deltas through its own handoff; WS3 maintains this table.

| Metric | R1 | R2 | R3 | Evidence method |
| --- | --- | --- | --- | --- |
| Human interruptions / prompts per accepted task | UNVERIFIED | UNVERIFIED | UNVERIFIED | Session/handoff counts; distinguish milestone review from routine prompts |
| Review waiting time / branch age | UNVERIFIED | UNVERIFIED | UNVERIFIED | Ready-for-review, branch start and review/merge UTC |
| Time since combined integration | UNVERIFIED | Last combined on main: R2 merge `ab9aa5ae…` at `2026-09-13T15:23:35Z`; post-merge CI completed `2026-09-13T15:29:22Z` | UNVERIFIED | Last combined build SHA/UTC |
| Pass-1 / Pass-2 stale findings | 0 / 0 for workflow adoption; both cutoffs `cd4477f` | 0 / 0; historical R2 continuation cutoffs `aa08d74f…` / `280a73d…` (`2026-09-12T23:28:42Z` / `2026-09-12T23:29:59Z`) | 0 / 0; this closeout both cutoffs `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77` (`2026-09-13T18:07:45Z` / `2026-09-13T18:08:11Z`); FRESH_2 | Final freshness classifications |
| Drift rework / integration conflicts | 0 / 0 for workflow adoption; excludes earlier CORE-01 work | UNVERIFIED | Observed draft #44 on same baseline; not imported here | Scoped corrective commits and conflict records |
| Defects found at review | UNVERIFIED | UNVERIFIED | UNVERIFIED | Findings attributable to this batch |
| Review duration / comprehension | UNVERIFIED | UNVERIFIED | UNVERIFIED | Reviewer minutes and can explain invariants: yes/no |

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
| BR-01 | WS2 contributor imported into R2 | batch/r2-auth-bridge-bff | INTEGRATED_AND_TESTED / LIVE WORDPRESS HEALTH VERIFIED | Exact SHA `280a73dbcd53ac0e03883775b4fabdec7465a4a8` imported as `0ac2e38befb54c9ada404e6854a80285bebb69b9`. Training plugin `0.1.0-br01` health 401/403/200 evidenced at CP-04 `67ea42c…`. Not pricing parity, checkout, or production | Bridge v1 | Imported; BFF runtime attach remaining |
| CORE-01 | WS3 | main | ACCEPTED / MERGED / VERIFIED; lease RELEASED | R1 PR #40 merge `aa08d74f2cb99301817e5995f01486acb7e2169f`; independent review APPROVED by @Ben-001-sys on `260be7f72b79bdbf2895ecfd06742db059b1496e`; post-merge main CI PASS. Issue #20 remains the historical task record; do not recreate | POS operational models v1.0.0 | Complete |
| CORE-02 | WS3 | batch/r2-auth-bridge-bff | COMPLETE FOR R2 (issue #21); durable store **VERIFIED** | CP-05 ACCEPTED; CORE-01 ACCEPTED through R1. Trusted assignment roles, mutation protection, Supabase Auth adapter, ephemeral store still refused for production/staging. `pos_staff_sessions` added because CORE-01 tables cannot store sessions | IdentityPort, Session v1.0.0 | R2 WS3 first task |
| CORE-03 | WS3 | batch/r2-auth-bridge-bff | LIVE RUNTIME ACCEPTED (issue #22) | CORE-02 complete for R2. BR-01 imported. Training WordPress health verified (CP-04 `67ea42c…`). Live BFF hops: durable session VERIFIED; Browser/BFF→Supabase VERIFIED; BFF→bridge→Woo VERIFIED. Detection is not pricing parity | StoreHealth, BridgeHealth, ApiFailure v1.0.0 | R2 after CORE-02 |

## Central edit lease

- **Editor:** WS3 senior / @wbdevworld.
- **Task / batch:** R2 — Authentication, bridge health and BFF. CORE-02 COMPLETE FOR R2 (issue #21). BR-01 exact SHA `280a73d…` imported as `0ac2e38…`; training WordPress health **VERIFIED**. CORE-03 LIVE RUNTIME ACCEPTED (issue #22).
- **Branch:** `batch/r2-auth-bridge-bff`. Base `origin/main` `aa08d74f2cb99301817e5995f01486acb7e2169f`.
- **Lease type:** R2 milestone integration lease. One draft R2 PR; no ordinary per-task PRs; no self-merge.
- **Allowed:** `apps/pos-web/src/core/**`; `apps/pos-web/src/server/**`; `apps/pos-web/src/config/**`; `apps/pos-web/src/app/api/**`; `tests/integration/auth/**`; `tests/integration/health/**`; this file; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/STATUS.md`; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/HANDOFF.md`; `docs/plans/TASK-INDEX.md` (R1/R2/CORE-01/CORE-02/CORE-03 lines only); `docs/plans/MILESTONE-REVIEWS.md` (R1/R2 snapshot rows only); `docs/integration/evidence/R2-*.md`; `docs/architecture/DATA-OWNERSHIP.md` solely to record `pos_staff_sessions`. Task-specific schema: one new CORE-02 session migration under `supabase/migrations/**` plus matching denial tests in `tests/integration/rls/**` and `supabase/tests/**`. Task-specific test discovery: `apps/pos-web/vitest.config.mts` and `tests/tooling/test_vitest_discovery.py` solely to include `tests/integration/auth/**` and `tests/integration/health/**`. Imported `wordpress/cetech-pos-bridge/**`, `tests/bridge/**`, and `tests/fixtures/commerce/**` are consumed contributor snapshots; do not edit WS2 plugin semantics.
- **Forbidden:** `apps/pos-web/src/features/**`; `apps/pos-web/src/ui/**`; semantic edits to `wordpress/**` / `tests/bridge/**`; `docs/contracts/**`; `reference/**`; root `package.json` / lockfile; CORE-04+ implementation; FE-03 sell/cart paths; WordPress plugin reinstall; live Woo/stock/payment/email writes; remote/linked Supabase migrations; deployment; inventing a second session datastore; `NEXT_PUBLIC_BRIDGE_*`.
- **CORE-01 lease:** RELEASED after reviewed merge of PR #40.
- **CI-01 lease:** RELEASED after reviewed merge of PR #38.
- **CP-04:** DEVELOPMENT BASELINE SATISFIED; W1 PASS on training; W4 PASS on training WordPress (`67ea42c…` / `edf24af…`). Issue #4 remains OPEN. Overall CP-04 not complete. Mail containment must stay preserved.
- **ADR-012:** ACTIVE team-wide (R1/#40 on main).
- **Release condition:** lease releases after reviewed merge of the R2 milestone PR, or explicit senior reassignment.

Required checks remain `control-plane` and `control-plane-windows`. This task does not change branch-protection settings.

Evidence: R1 APPROVED / MERGED / VERIFIED. PR #40 merge `aa08d74f2cb99301817e5995f01486acb7e2169f`. @Ben-001-sys APPROVED final head `260be7f72b79bdbf2895ecfd06742db059b1496e`. Post-merge main CI run 34717692049 success. CORE-01 ACCEPTED. ADR-012 ACTIVE. CORE-01 lease RELEASED. R2 activated on `batch/r2-auth-bridge-bff`. Do not recreate R1 or CORE-01.

## R2 batch workflow record — current (supersedes the R1 editor lease)

- Batch / milestone: **R2**, ordered tasks BR-01 (WS2 contributor), CORE-02, CORE-03. PR **#43** `[R2] Authentication, bridge health and BFF`. One R2 PR only. Live hops are proven on this tree. Ben `CHANGES_REQUESTED` on `0deafa3…` for exact-head BR-01 Make verification. Request `@Ben-001-sys` re-review only on this continuation's exact final SHA after required CI is green. No self-merge. Do not start R3.
- START_FRESHNESS_SNAPSHOT UTC: `2026-09-13T14:04:18Z` (new ADR-012 Make-verification continuation; previous runtime and blocked-import freshness passes are closed; this is not Pass 3). origin/main `aa08d74f2cb99301817e5995f01486acb7e2169f`. Editor candidate `batch/r2-auth-bridge-bff` `0deafa301411bc226e453446455a1f85d92607d7`. Contract version v1.0.0. ADRs 011 CURRENT, 012 ACTIVE. Evidence: `docs/integration/evidence/R2-START-FRESHNESS-BR01-MAKE-VERIFY.md`. Historical: `R2-START-FRESHNESS-RUNTIME.md`, `R2-START-FRESHNESS-BR01-NORMALIZATION.md`.
- BR-01: exact SHA `280a73dbcd53ac0e03883775b4fabdec7465a4a8` imported as `0ac2e38befb54c9ada404e6854a80285bebb69b9`. Normalization tests `130437d6…` imported as `605e6f2…`. Exact-head Make on `0deafa3…`: `check` PASS, `test` **83 passed / 0 failed**. Training WordPress health **VERIFIED** via CP-04 W4 `67ea42ce03142fb9f0ca18446b8146b0815ea621` / head `edf24af…`. Classification **INTEGRATED_AND_TESTED / LIVE WORDPRESS HEALTH VERIFIED**. CP-04 files were not imported onto this lease. Evidence: `docs/integration/evidence/R2-BR-01-MAKE-VERIFY.md`.
- Human reviewer: **@Ben-001-sys**. `CHANGES_REQUESTED` on `0deafa3…` is not approval. Request re-review only after this continuation's exact final head is pushed and required CI is green. Do not merge.
- WS3 R2 authorized queue: CORE-02 durable `StaffSessionStore` **VERIFIED**; CORE-03 real Supabase probe **VERIFIED**; live BFF→training bridge **VERIFIED**; BR-01 Make on current tree **VERIFIED**. CP04-W1/W4 WordPress side PASS. Issue #4 stays OPEN. Overall CP-04 not complete. R3–R10 are not activated. PR #41 remains R4 preparation.

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

## R1/R2 workflow metrics

Observed values are UNVERIFIED until measured; do not interpret blanks as zero. Each workstream reports deltas through its own handoff; WS3 maintains this table.

| Metric | R1 | R2 | Evidence method |
| --- | --- | --- | --- |
| Human interruptions / prompts per accepted task | UNVERIFIED | UNVERIFIED | Session/handoff counts; distinguish milestone review from routine prompts |
| Review waiting time / branch age | UNVERIFIED | UNVERIFIED | Ready-for-review, branch start and review/merge UTC |
| Time since combined integration | UNVERIFIED | UNVERIFIED | Last combined build SHA/UTC |
| Pass-1 / Pass-2 stale findings | 0 / 0 for workflow adoption; both cutoffs `cd4477f` | 0 / 0; this continuation both cutoffs `aa08d74f…` / `280a73d…` (`2026-09-12T23:28:42Z` / `2026-09-12T23:29:59Z`) | Final freshness classifications |
| Drift rework / integration conflicts | 0 / 0 for workflow adoption; excludes earlier CORE-01 work | UNVERIFIED | Scoped corrective commits and conflict records |
| Defects found at review | UNVERIFIED | UNVERIFIED | Findings attributable to this batch |
| Review duration / comprehension | UNVERIFIED | UNVERIFIED | Reviewer minutes and can explain invariants: yes/no |

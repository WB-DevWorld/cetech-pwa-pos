# Current work ledger

Updated 2026-09-12. Canonical repo WB-DevWorld/cetech-pwa-pos. Senior @wbdevworld owns integration/migrations/contracts/config. GitHub issues are live task/status evidence; this table is the cross-workstream coordination summary.

Controlling interpretation: [ADR-011](docs/decisions/ADR/011.md). Training Woo is the development/integration reference. Unavailable production facts are cutover/release deltas unless a task specifically requires them. Remaining CP-04 work: [CP-04 checklist](docs/runbooks/CP-04-REMAINING-WORK.md).

| Task | Owner | Branch | Status | Dependencies / blocked by | Contracts | Merge order |
| --- | --- | --- | --- | --- | --- | --- |
| CP-01/02/03 | WS3 | main (foundation) | IMPLEMENTED / VERIFIED; human review available | Commit 9229334; GitHub CI run 34643828253 success | v1.0.0 | First |
| CP-04 | WS3 + WS2 evidence | main; issue #4 OPEN | DEVELOPMENT BASELINE SATISFIED; write-safety/cutover OPEN / DEFERRED | ADR-011; training audit sufficient for local implementation; unsafe remote effects still gated | Environment policy; v1 unchanged | Relevant evidence before affected operation |
| CP-05 | WS3 | main | MERGED / VERIFIED | PR #32 merged as `095696f15cd64b546003bc5c77b4600af7bc4c76` after @Ben-001-sys APPROVED; required CI passed; issue #5 CLOSED / COMPLETED | v1.0.0 unchanged | Complete |
| CI-01 | WS3 | main | MERGED / VERIFIED; lease RELEASED | PR #38 merged as `8e058d679bb02e96374c0e79cc32d025b6a9ed03` after @Ben-001-sys APPROVED | none | Complete (before FE-02) |
| FE-01 | @Ben-001-sys / WS1 | main | MERGED / COMPLETED | PR #33; issue #6 CLOSED / COMPLETED | Prototype→v1 mapping | Complete |
| FE-02 | @Ben-001-sys / WS1 | main | MERGED / COMPLETED | PR #37 merged as `ceea3c4ebb3b95d7c3195d6cc089d1f3713d1d19`; issue #7 CLOSED / COMPLETED; CI-01 prerequisite satisfied | none | Complete |
| BR-01 | WS2 | ws2/br-01-build-bridge-health-and-permission-skeleton | Contributor SHA observed; not accepted | CP-04 development baseline satisfied; live service identity/runtime acceptance remain separate. Observed `fbbf0ea7d016b6149e9f095d449fb15b0dcdf930` is PROVISIONAL_TEST until a combined/tested SHA is declared | Bridge v1 | R2 contributor input; do not blindly merge |
| CORE-01 | WS3 | main | ACCEPTED / MERGED / VERIFIED; lease RELEASED | R1 PR #40 merge `aa08d74f2cb99301817e5995f01486acb7e2169f`; independent review APPROVED by @Ben-001-sys on `260be7f72b79bdbf2895ecfd06742db059b1496e`; post-merge main CI PASS. Issue #20 remains the historical task record; do not recreate | POS operational models v1.0.0 | Complete |
| CORE-02 | WS3 | batch/r2-auth-bridge-bff | IN PROGRESS (issue #21) | CP-05 ACCEPTED; CORE-01 ACCEPTED through R1 | IdentityPort, Session v1.0.0 | R2 ordered queue after BR-01 dependency classification |

## Central edit lease

- **Editor:** WS3 senior / @wbdevworld.
- **Task / batch:** R2 — Authentication, bridge health and BFF. First ready WS3 task: CORE-02 (GitHub issue #21).
- **Branch:** `batch/r2-auth-bridge-bff`. Base `origin/main` `aa08d74f2cb99301817e5995f01486acb7e2169f`.
- **Lease type:** R2 milestone integration lease. One draft R2 PR; no ordinary per-task PRs; no self-merge.
- **Allowed:** `apps/pos-web/src/core/**`; `apps/pos-web/src/server/**`; `apps/pos-web/src/config/**`; `tests/integration/auth/**`; this file; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/STATUS.md`; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/HANDOFF.md`; `docs/plans/TASK-INDEX.md` (R1/R2/CORE-01/CORE-02/CORE-03 lines only); `docs/plans/MILESTONE-REVIEWS.md` (R1/R2 snapshot rows only); `docs/integration/evidence/R2-*.md`. Task-specific test discovery (CORE-02 only): `apps/pos-web/vitest.config.mts` and `tests/tooling/test_vitest_discovery.py` solely to include `tests/integration/auth/**`. CORE-03 paths `apps/pos-web/src/app/api/**` and `tests/integration/health/**` only after CORE-02 checkpoint and BR-01 classification.
- **Forbidden:** `apps/pos-web/src/features/**`; `apps/pos-web/src/ui/**`; `wordpress/**`; `docs/contracts/**`; `reference/**`; root `package.json` / lockfile; supabase schema/RLS; CORE-04+ implementation; FE-03 sell/cart paths; WordPress install/activation; live Woo/stock/payment/email writes; remote Supabase migrations; deployment.
- **CORE-01 lease:** RELEASED after reviewed merge of PR #40.
- **CI-01 lease:** RELEASED after reviewed merge of PR #38.
- **CP-04:** DEVELOPMENT BASELINE SATISFIED; WRITE-SAFETY / CUTOVER OPEN / DEFERRED. Issue #4 remains OPEN.
- **ADR-012:** ACTIVE team-wide (R1/#40 on main).
- **Release condition:** lease releases after reviewed merge of the R2 milestone PR, or explicit senior reassignment.

Required checks remain `control-plane` and `control-plane-windows`. This task does not change branch-protection settings.

Evidence: R1 APPROVED / MERGED / VERIFIED. PR #40 merge `aa08d74f2cb99301817e5995f01486acb7e2169f`. @Ben-001-sys APPROVED final head `260be7f72b79bdbf2895ecfd06742db059b1496e`. Post-merge main CI run 34717692049 success. CORE-01 ACCEPTED. ADR-012 ACTIVE. CORE-01 lease RELEASED. R2 activated on `batch/r2-auth-bridge-bff`. Do not recreate R1 or CORE-01.

## R2 batch workflow record — current (supersedes the R1 editor lease)

- Batch / milestone: **R2**, ordered tasks BR-01 (WS2 contributor), CORE-02, CORE-03. PR to create when there is a meaningful tested checkpoint: `[R2] Authentication, bridge health and BFF`. One draft PR only.
- START_FRESHNESS_SNAPSHOT UTC: `2026-09-12T21:10:35Z`. origin/main `aa08d74f2cb99301817e5995f01486acb7e2169f`. Declared independent integration baseline: NOT_APPLICABLE (this editor's candidate is `batch/r2-auth-bridge-bff`). Contract version v1.0.0. ADRs 011 CURRENT, 012 ACTIVE. Queue authorizer: senior R2 continuation 2026-09-12.
- Observed BR-01 contributor ref (not consumed until CORE-03 checkpoint): `origin/ws2/br-01-build-bridge-health-and-permission-skeleton` `fbbf0ea7d016b6149e9f095d449fb15b0dcdf930`. Classification at start: PROVISIONAL_TEST (1 commit behind current main; no GitHub Actions run on that SHA). Do not call BR-01 accepted. Do not blindly merge.
- Human reviewer: **@Ben-001-sys** for the R2 milestone PR. Backup technical reviewer UNVERIFIED. Senior cannot self-approve.
- WS3 R2 authorized queue: CORE-02 then CORE-03 if BR-01 is a legitimate accepted or declared combined PROVISIONAL_TEST input; otherwise CORE-03 PREP_ONLY against frozen contracts/mocks. R3–R10 are not activated. PR #41 remains R4 preparation.

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
| Pass-1 / Pass-2 stale findings | 0 / 0 for workflow adoption; both cutoffs `cd4477f` | UNVERIFIED | Final freshness classifications |
| Drift rework / integration conflicts | 0 / 0 for workflow adoption; excludes earlier CORE-01 work | UNVERIFIED | Scoped corrective commits and conflict records |
| Defects found at review | UNVERIFIED | UNVERIFIED | Findings attributable to this batch |
| Review duration / comprehension | UNVERIFIED | UNVERIFIED | Reviewer minutes and can explain invariants: yes/no |

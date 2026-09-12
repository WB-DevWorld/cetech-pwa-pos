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
| BR-01 | WS2 | ws2/br-01-health | READY for local implementation when CP-03 is satisfied | CP-04 development baseline satisfied; target installation/service identity and authorized runtime evidence remain separate | Bridge v1 | Local implementation now; live acceptance after applicable gates |
| CORE-01 | WS3 | ws3/core-01-create-pos-operational-schema-and-rls | FINAL PRE-MERGE REMEDIATION on PR #40 | CP-04 development baseline + CP-05 satisfied; no production-site access required for local schema/RLS | POS operational models v1.0.0 | One migration editor; do not recreate PR #40 |

## Central edit lease

- **Editor:** WS3 senior / @wbdevworld.
- **Task:** CORE-01 — Create POS operational schema and RLS (GitHub issue #20).
- **Branch:** `ws3/core-01-create-pos-operational-schema-and-rls`. Rebased onto current `origin/main` after PR #42 (`cd4477f185c159e18ed939a20145865d665099b4`).
- **Lease type:** CORE-01 migration/schema lease plus this final-pass task-specific CI and tooling authorization.
- **Allowed:** `supabase/**`; `docs/architecture/DATA-OWNERSHIP.md`; `tests/integration/rls/**`; this file; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/STATUS.md`; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/HANDOFF.md`; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/TASKS.md` (CORE-01 dependency line); `docs/plans/TASK-INDEX.md` (CORE-01 dependency line only).
- **Task-specific CI scope (this final CORE-01 pass only):** `.github/workflows/ci.yml` solely to add pinned Supabase CLI **2.117.0** local `db reset` / `test db` to the existing Linux `control-plane` job. Required job names `control-plane` and `control-plane-windows` stay unchanged. No remote/linked Supabase, no cloud secrets, no Windows DB stack.
- **Task-specific tooling scope (this final CORE-01 pass only):** `tests/tooling/**` solely to prevent `supabase/tests/rls_isolation.sql` vs `tests/integration/rls/test_rls_isolation.sql` mirror drift.
- **Forbidden:** `apps/pos-web/src/features/**`; `apps/pos-web/src/ui/**`; `wordpress/**`; `docs/contracts/**`; `reference/**`; root `package.json` / lockfile; CORE-02+ implementation; FE-03 sell/cart paths.
- **CI-01 lease:** RELEASED after reviewed merge of PR #38.
- **CP-04:** DEVELOPMENT BASELINE SATISFIED; WRITE-SAFETY / CUTOVER OPEN / DEFERRED. Issue #4 remains OPEN. Training write isolation remains **NOT PROVEN**; email remains **UNSAFE** for affected tests. These findings do not block local synthetic CORE-01.
- **Release condition:** lease releases after reviewed merge of the CORE-01 PR, or explicit senior reassignment.

Required checks remain `control-plane` and `control-plane-windows`. Linux `control-plane` now also runs local Supabase reset/pgTAP. This task does not change branch-protection settings.

Evidence: CP-05 MERGED / VERIFIED (PR #32). CI-01 MERGED / VERIFIED (PR #38). FE-01 MERGED (PR #33 / issue #6). FE-02 MERGED (PR #37 / issue #7). CP-04 2026-09-12 public probes (PR #36 / WS2 intake PR #35) plus authenticated WP-CLI continuation; staging isolation NOT PROVEN; issue #4 OPEN for write-safety/cutover. ADR-011 supersedes the blanket CORE-01 block; PR #40 remains the implementation/review surface. CORE-01 in progress on the canonical branch.

## R1 batch workflow record — current (supersedes earlier lease scope)

- Batch / milestone: **R1**, CORE-01 plus explicitly authorized workflow adoption; PR **#40 CANDIDATE PUBLISHED / FINAL CI AND INDEPENDENT REVIEW PENDING**. #40 is reused as its milestone PR; draft during assembly, ready only after its gate passes. Its live draft/check state and exact final head are recorded in the PR handoff.
- Approved main base SHA: `cd4477f185c159e18ed939a20145865d665099b4`.
- Starting R1 candidate implementation SHA: `860bef52efb53773788f6e06fc1753d8d51670a9` on `ws3/core-01-create-pos-operational-schema-and-rls`. Current candidate SHA is the live #40 head and its final PR handoff; this starting SHA is not permanently current.
- Declared independent upstream for this editor: origin/main. Batch upstream for the R1 editor: NOT_APPLICABLE (own branch is the candidate). Contributors using R1 as a test prerequisite must record its exact named SHA, never infer approval.
- Integration editor / current governance lease: **@wbdevworld / WS3**, one active implementation session. Scope expanded by the senior 2026-09-12 instruction: root authority/coordination, docs/plans/standards/decisions/ai/source-manifest/integration, three workstream policy/queue/status/handoff files, .cursor rules, PR template, CI contributor triggers, `scripts/check_upstream_drift.py`, `tests/tooling/**` for workflow/drift regression. Existing CORE-01 schema lease is preserved; adoption makes no SQL/schema/RLS, feature, bridge, contract or lockfile edit.
- Human reviewer: **@Ben-001-sys**, already requested on #40; final combined-head approval PENDING. Backup technical reviewer UNVERIFIED. Senior cannot self-approve.
- WS3 R1 authorized queue: preserve/review existing CORE-01; implement ADR-012/policy/queues/CI/helper/tests/prompts; run two final freshness passes; deliver #40 for other-human review. CORE-02+ is conditionally queued after R1 acceptance; not implemented here.
- WS1 independent R4 lane: reuse #41 at inspected head `ede771bdbe5f05c8b517ce5168c9d8515a354e28`. Authorized queue FE-03 then FE-04; currently PREP_ONLY frozen mock presentation/failure tests for evidenced gaps. FE-02 accepted; actual CORE-04 and BR-05 prerequisites still block runtime integration/checkout acceptance. No arbitrary import of #40/#41 peer work. Later FE tasks follow TASKS after their milestone activation.
- WS2 independent R2 lane: BR-01 local skeleton/permission/health implementation under ADR-011 and existing task #13. Record actual contributor branch/head at first checkpoint. R3 queue BR-02 → BR-03/BR-04 → BR-05 conditionally follows its prerequisite and declared milestone activation. Local fixture preparation allowed; real parity remains gated.
- Later progression: workstream TASKS queues and [R1–R10 mapping](docs/plans/MILESTONE-REVIEWS.md). Existing task acceptance controls; an open foundation issue alone does not undo an approved contract baseline.
- Authorized environments: local synthetic fixtures; read-only authorized training observations. No new remote installation, database/commerce/payment/email/stock effects granted by adoption. Unsafe training writes remain blocked by CP-04.
- Remote effects allowed for adoption: repository governance commits, existing PR metadata/comments/reviewer request, CI execution. No application deployment or production promotion.
- Checkpoint/freshness evidence: [R1 adoption evidence](docs/integration/evidence/R1-WORKFLOW-ADOPTION.md) and final #40 handoff contain exact heads/cutoffs; no self-referential commit SHA in this file.
- Current blockers: independent final review; full classic protection settings UNVERIFIED (administration GET 403); later runtime gates remain operation-specific. Neither #20 nor #4 is closed by this record.
- Lease release: after final handoff this adoption editor makes no further code changes; next editor records a new lease before changes. Main remains untouched until reviewed integration.

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

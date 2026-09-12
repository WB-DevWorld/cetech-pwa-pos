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
| CORE-01 | WS3 | ws3/core-01-create-pos-operational-schema-and-rls | READY FOR REVIEW (issue #20, PR #40) | CP-04 development baseline + CP-05 satisfied; no production-site access required for local schema/RLS | POS operational models v1.0.0 | One migration editor; do not recreate PR #40 |

## Central edit lease

- **Editor:** WS3 senior / @wbdevworld.
- **Task:** CORE-01 — Create POS operational schema and RLS (GitHub issue #20).
- **Branch:** `ws3/core-01-create-pos-operational-schema-and-rls`. Rebased onto current `origin/main` after PR #42 (`cd4477f185c159e18ed939a20145865d665099b4`).
- **Lease type:** narrow CORE-01 migration/schema lease. Not contracts, lockfile, frontend, or WordPress.
- **Allowed:** `supabase/**`; `docs/architecture/DATA-OWNERSHIP.md`; `tests/integration/rls/**`; this file; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/STATUS.md`; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/HANDOFF.md`; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/TASKS.md` (CORE-01 dependency line); `docs/plans/TASK-INDEX.md` (CORE-01 dependency line only).
- **Forbidden:** `apps/pos-web/src/features/**`; `apps/pos-web/src/ui/**`; `wordpress/**`; `docs/contracts/**`; `reference/**`; root `package.json` / lockfile; CORE-02+ implementation.
- **CI-01 lease:** RELEASED after reviewed merge of PR #38.
- **CP-04:** DEVELOPMENT BASELINE SATISFIED; WRITE-SAFETY / CUTOVER OPEN / DEFERRED. Issue #4 remains OPEN. Training write isolation remains **NOT PROVEN**; email remains **UNSAFE** for affected tests. These findings do not block local synthetic CORE-01.
- **Release condition:** lease releases after reviewed merge of the CORE-01 PR, or explicit senior reassignment.

Required checks remain `control-plane` and `control-plane-windows`. This task does not change branch-protection settings.

Evidence: CP-05 MERGED / VERIFIED (PR #32). CI-01 MERGED / VERIFIED (PR #38). FE-01 MERGED (PR #33 / issue #6). FE-02 MERGED (PR #37 / issue #7). CP-04 2026-09-12 public probes (PR #36 / WS2 intake PR #35) plus authenticated WP-CLI continuation; staging isolation NOT PROVEN; issue #4 OPEN for write-safety/cutover. ADR-011 supersedes the blanket CORE-01 block; PR #40 remains the implementation/review surface. CORE-01 in progress on the canonical branch.

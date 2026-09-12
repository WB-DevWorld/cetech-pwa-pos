# Current work ledger

Updated 2026-09-12. Canonical repo WB-DevWorld/cetech-pwa-pos. Senior @wbdevworld owns integration/migrations/contracts/config. GitHub issues are live task/status evidence; this table is the cross-workstream coordination summary.

| Task | Owner | Branch | Status | Dependencies / blocked by | Contracts | Merge order |
| --- | --- | --- | --- | --- | --- | --- |
| CP-01/02/03 | WS3 | main (foundation) | IMPLEMENTED / VERIFIED; human review available | Commit 9229334; GitHub CI run 34643828253 success | v1.0.0 | First |
| CP-04 | WS3 | ws3/cp-04-authenticated-staging-evidence (issue #4 OPEN) | PARTIAL / BLOCKED: public + authenticated identity/HPOS/stock/tax/gateways recorded; isolation NOT PROVEN; email UNSAFE for write tests | Authenticated WP-CLI 2026-09-12; production DB fingerprint not compared; no write tests | Environment policy | Before live integration |
| CP-05 | WS3 | main | MERGED / VERIFIED | PR #32 merged as `095696f15cd64b546003bc5c77b4600af7bc4c76` after @Ben-001-sys APPROVED; required CI passed; issue #5 CLOSED / COMPLETED | v1.0.0 unchanged | Complete |
| CI-01 | WS3 | main | MERGED / VERIFIED; lease RELEASED | PR #38 merged as `8e058d679bb02e96374c0e79cc32d025b6a9ed03` after @Ben-001-sys APPROVED | none | Complete (before FE-02) |
| FE-01 | @Ben-001-sys / WS1 | main | MERGED / COMPLETED | PR #33; issue #6 CLOSED / COMPLETED | Prototype→v1 mapping | Complete |
| FE-02 | @Ben-001-sys / WS1 | main | MERGED / COMPLETED | PR #37 merged as `ceea3c4ebb3b95d7c3195d6cc089d1f3713d1d19`; issue #7 CLOSED / COMPLETED; CI-01 prerequisite satisfied | none | Complete |
| BR-01 | WS2 | ws2/br-01-health | SPECIFIED | CP-04 staging/plugin facts; live health still needs isolation + service identity | Bridge v1 | After live inputs |
| CORE-01 | WS3 | ws3/core-01-schema | BLOCKED / CP-04 remaining; CP-05 satisfied | Staging identity/HPOS/stock now evidenced; isolation still NOT PROVEN (email UNSAFE; production DB fingerprint unavailable) | POS operational models | One migration editor |

## Central edit lease

- **Editor:** WS3 senior / @wbdevworld.
- **Task:** CP-04 — authenticated staging audit and isolation continuation (GitHub issue #4). Not CORE-01. Not a coding task.
- **Branch:** `ws3/cp-04-authenticated-staging-evidence`. Base `origin/main` `ceea3c4ebb3b95d7c3195d6cc089d1f3713d1d19`.
- **Lease type:** narrow CP-04 evidence/configuration lease only. No migration, dependency, contract, CI, app-routing, or application-feature authority.
- **Allowed:** `LIVE-ENVIRONMENT-FACTS.md`; `docs/runbooks/**`; `docs/integration/evidence/**`; this file; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/STATUS.md`; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/HANDOFF.md`.
- **Forbidden:** `apps/**`; `wordpress/**`; `supabase/**`; `package.json`; `pnpm-lock.yaml`; `pnpm-workspace.yaml`; `.github/**`; `docs/contracts/**`; `docs/decisions/**`; `reference/**`; `tests/**`; WS1 STATUS/HANDOFF.
- **CI-01 lease:** RELEASED after reviewed merge of PR #38.
- **Release condition:** lease releases after reviewed merge of this CP-04 continuation PR, or explicit senior reassignment. This lease does not claim CORE-01.
- Isolation conclusion remains **NOT PROVEN**. No write tests.

Live pricing/health/RLS/payment/hardware/production gates: UNVERIFIED except the public and authenticated CP-04 facts in `docs/integration/evidence/`. GitHub confirms public visibility. Required checks remain `control-plane` and `control-plane-windows`. This task does not change branch-protection settings.

Evidence: CP-05 MERGED / VERIFIED (PR #32). CI-01 MERGED / VERIFIED (PR #38). FE-01 MERGED (PR #33 / issue #6). FE-02 MERGED (PR #37 / issue #7). CP-04 2026-09-12 public probes (PR #36 / WS2 intake PR #35) plus authenticated WP-CLI continuation; staging isolation NOT PROVEN; issue #4 OPEN; CORE-01 remains BLOCKED.

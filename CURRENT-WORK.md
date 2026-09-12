# Current work ledger

Updated 2026-09-12. Canonical repo WB-DevWorld/cetech-pwa-pos. Senior @wbdevworld owns integration/migrations/contracts/config. GitHub issues are live task/status evidence; this table is the cross-workstream coordination summary.

| Task | Owner | Branch | Status | Dependencies / blocked by | Contracts | Merge order |
| --- | --- | --- | --- | --- | --- | --- |
| CP-01/02/03 | WS3 | main (foundation) | IMPLEMENTED / VERIFIED; human review available | Commit 9229334; GitHub CI run 34643828253 success | v1.0.0 | First |
| CP-04 | WS3 + WS2 evidence | main; issue #4 OPEN | DEVELOPMENT BASELINE SATISFIED; write-safety/cutover OPEN / DEFERRED | ADR-011; training audit sufficient for local implementation; unsafe remote effects still gated | Environment policy; v1 unchanged | Relevant evidence before affected operation |
| CP-05 | WS3 | main | MERGED / VERIFIED | PR #32 merged as `095696f15cd64b546003bc5c77b4600af7bc4c76` after @Ben-001-sys APPROVED; required CI passed; issue #5 CLOSED / COMPLETED | v1.0.0 unchanged | Complete |
| CI-01 | WS3 | main | MERGED / VERIFIED; lease RELEASED | PR #38 merged as `8e058d679bb02e96374c0e79cc32d025b6a9ed03` after @Ben-001-sys APPROVED | none | Complete (before FE-02) |
| FE-01 | @Ben-001-sys / WS1 | main | MERGED / COMPLETED | PR #33; issue #6 CLOSED / COMPLETED | Prototype→v1 mapping | Complete |
| FE-02 | @Ben-001-sys / WS1 | main | MERGED / COMPLETED | PR #37 merged as `ceea3c4ebb3b95d7c3195d6cc089d1f3713d1d19`; issue #7 CLOSED / COMPLETED; CI-01 prerequisite satisfied | none | Complete |
| BR-01 | WS2 | ws2/br-01-health | READY for local implementation when CP-03 is satisfied | CP-04 development baseline satisfied; target installation/service identity and authorized runtime evidence remain separate | Bridge v1 | Local implementation now; live acceptance after applicable gates |
| CORE-01 | WS3 | ws3/core-01-create-pos-operational-schema-and-rls | Development prerequisites SATISFIED; implementation submitted in PR #40, not yet merged at this check | CP-04 development baseline + CP-05 satisfied; no production-site access required for local schema/RLS | POS operational models | Review/integrate PR #40; do not recreate it |

## Central edit scope

- CP-04 authenticated evidence lease ended with merged PR #39.
- This senior-authorized CP-04 reconciliation changes only environment/dependency decisions, task metadata, runbooks and coordination documents. It grants no application, bridge, migration, dependency or CI implementation scope and no ongoing implementation lease.
- CORE-01 implementation/review remains on PR #40 under WS3; no changes to its migrations or branch are made here.
- Controlling interpretation: [ADR-011](docs/decisions/ADR/011.md). Remaining operation-specific work: [CP-04 checklist](docs/runbooks/CP-04-REMAINING-WORK.md).
- Training write isolation remains **NOT PROVEN**; email remains **UNSAFE** for affected tests. These findings do not block local synthetic implementation.

Live pricing/health/RLS/payment/hardware/production gates: UNVERIFIED except the public and authenticated CP-04 facts in `docs/integration/evidence/`. GitHub confirms public visibility. Required checks remain `control-plane` and `control-plane-windows`. This task does not change branch-protection settings.

Evidence: CP-05 MERGED / VERIFIED (PR #32). CI-01 MERGED / VERIFIED (PR #38). FE-01 MERGED (PR #33 / issue #6). FE-02 MERGED (PR #37 / issue #7). CP-04 2026-09-12 public probes (PR #36 / WS2 intake PR #35) plus authenticated WP-CLI continuation; staging isolation NOT PROVEN; issue #4 OPEN for write-safety/cutover. ADR-011 supersedes the blanket CORE-01 block; PR #40 remains the separate implementation/review surface.

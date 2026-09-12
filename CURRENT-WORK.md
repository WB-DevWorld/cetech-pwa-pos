# Current work ledger

Updated 2026-09-12. Canonical repo WB-DevWorld/cetech-pwa-pos. Senior @wbdevworld owns integration/migrations/contracts/config. GitHub issues are live task/status evidence; this table is the cross-workstream coordination summary.

| Task | Owner | Branch | Status | Dependencies / blocked by | Contracts | Merge order |
| --- | --- | --- | --- | --- | --- | --- |
| CP-01/02/03 | WS3 | main (foundation) | IMPLEMENTED / VERIFIED; human review available | Commit 9229334; GitHub CI run 34643828253 success | v1.0.0 | First |
| CP-04 | WS3 | main (PR #36 merged; issue #4 OPEN) | PARTIAL / BLOCKED: public evidence recorded; isolation and authenticated Woo/HPOS/stock not proven | Public audit 2026-09-12; WP-CLI/admin unavailable; no write tests | Environment policy | Before live integration |
| CP-05 | WS3 | main | MERGED / VERIFIED | PR #32 merged as `095696f15cd64b546003bc5c77b4600af7bc4c76` after @Ben-001-sys APPROVED; required CI passed; issue #5 CLOSED / COMPLETED | v1.0.0 unchanged | Complete |
| FE-01 | @Ben-001-sys / WS1 | ws1/fe-01-reference-map | READY for bounded reference mapping | Write access verified; pull tooling repair and pass verifier | Prototype→v1 mapping | Independent |
| BR-01 | WS2 | ws2/br-01-health | SPECIFIED | CP-04 staging/plugin facts; live health still needs isolation + service identity | Bridge v1 | After live inputs |
| CORE-01 | WS3 | ws3/core-01-schema | BLOCKED / CP-04 remaining; CP-05 satisfied | CP-04 isolation + HPOS/stock/Woo admin facts remain incomplete; CP-05 is satisfied on main | POS operational models | One migration editor |
| CI-01 | WS3 | ws3/ci-01-broaden-vitest-discovery | IMPLEMENTATION COMPLETE / awaiting PR review | FE-02 PR #37 tests exist outside `src/app`; canonical `pnpm --dir apps/pos-web test` was restricted to `src/app` | none | Before FE-02 merge |

## Central edit lease

- **Editor:** WS3 senior / @wbdevworld.
- **Task:** CI-01 — Broaden Vitest discovery (tooling follow-up, not a CP-04 completion).
- **Branch:** `ws3/ci-01-broaden-vitest-discovery`. Base `origin/main` `58c195ee5b365469449e125f060665f12007ae81`.
- **Lease type:** narrow unit-test discovery / tooling lease only. No migration, dependency, contract, CI workflow, app-routing, or application-feature authority.
- **Allowed:** `apps/pos-web/package.json`; `apps/pos-web/vitest.config.*`; `tests/tooling/**`; this file; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/STATUS.md`; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/HANDOFF.md`.
- **Forbidden:** `apps/pos-web/src/**`; `tests/frontend/**`; `.github/workflows/**`; `wordpress/**`; `supabase/**`; `pnpm-lock.yaml`; `docs/contracts/**`; `docs/decisions/**`; `reference/frontend-approved/**`; `LIVE-ENVIRONMENT-FACTS.md`; `docs/integration/evidence/**`; `docs/runbooks/**`.
- **Why urgent:** FE-02 PR #37 already adds Vitest files under `src/features/**`, `src/ui/**`, and `tests/frontend/**`. The CP-05 script `vitest run --environment node --dir src/app` would not discover them.
- **Release condition:** lease releases after reviewed merge of this CI-01 PR. This lease does not claim CORE-01 and does not continue CP-04 authenticated staging work.
- CP-04 remains PARTIAL / BLOCKED (issue #4 OPEN; isolation NOT PROVEN). Remaining CP-04 evidence work is not claimed by this tooling task.

Live pricing/health/RLS/payment/hardware/production gates: UNVERIFIED except the public CP-04 facts in `docs/integration/evidence/CP-04-LIVE-AUDIT.md`. GitHub confirms public visibility; the private-plan restriction is resolved. Live branch read 2026-09-12 via `gh api repos/WB-DevWorld/cetech-pwa-pos/branches/main`: `protected=true`; required checks include `control-plane` and `control-plane-windows`. CI-01 does not change branch-protection settings. Initial tasks are not proof of implementation.

Evidence: CP-05 remains MERGED / VERIFIED (PR #32 / `095696f…`; issue #5 completed). CP-04 2026-09-12 public probes recorded (PR #36 / WS2 intake PR #35); staging isolation NOT PROVEN; issue #4 OPEN; CORE-01 remains BLOCKED. CI-01 is a separate Vitest discovery fix and does not satisfy CP-04.

# Current work ledger

Updated 2026-09-12. Canonical repo WB-DevWorld/cetech-pwa-pos. Senior @wbdevworld owns integration/migrations/contracts/config. GitHub issues are live task/status evidence; this table is the cross-workstream coordination summary.

| Task | Owner | Branch | Status | Dependencies / blocked by | Contracts | Merge order |
| --- | --- | --- | --- | --- | --- | --- |
| CP-01/02/03 | WS3 | main (foundation) | IMPLEMENTED / VERIFIED; human review available | Commit 9229334; GitHub CI run 34643828253 success | v1.0.0 | First |
| CP-04 | WS3 | ws3/cp-04-audit-live-environment-and-isolate-staging | PARTIAL / BLOCKED: public evidence recorded; isolation and authenticated Woo/HPOS/stock not proven | Public audit 2026-09-12; WP-CLI/admin unavailable; no write tests | Environment policy | Before live integration |
| CP-05 | WS3 | main | MERGED / VERIFIED | PR #32 merged as `095696f15cd64b546003bc5c77b4600af7bc4c76` after @Ben-001-sys APPROVED; required CI passed; issue #5 CLOSED / COMPLETED | v1.0.0 unchanged | Complete |
| FE-01 | @Ben-001-sys / WS1 | ws1/fe-01-reference-map | READY for bounded reference mapping | Write access verified; pull tooling repair and pass verifier | Prototype→v1 mapping | Independent |
| BR-01 | WS2 | ws2/br-01-health | SPECIFIED | CP-04 staging/plugin facts; live health still needs isolation + service identity | Bridge v1 | After live inputs |
| CORE-01 | WS3 | ws3/core-01-schema | BLOCKED / CP-04 remaining; CP-05 satisfied | CP-04 isolation + HPOS/stock/Woo admin facts remain incomplete; CP-05 is satisfied on main | POS operational models | One migration editor |

## Central edit lease

- **Editor:** WS3 senior / @wbdevworld.
- **Task:** CP-04 — Audit live environment and isolate staging (GitHub issue #4).
- **Branch:** `ws3/cp-04-audit-live-environment-and-isolate-staging` in a dedicated clean worktree. Base `origin/main` `52caf39d010687084e0b1e1db74acd0b644ab4b0` (contains PR #34 `ae6bac5cbffae3af13036e0447641e174a9227b5` plus later FE-01 merge PR #33).
- **Lease type:** narrow CP-04 evidence/configuration lease only. No migration, dependency, contract, CI, app-routing, or application-code authority.
- **Allowed:** `LIVE-ENVIRONMENT-FACTS.md`; `docs/runbooks/**`; `docs/integration/evidence/**`; this file; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/STATUS.md`; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/HANDOFF.md`.
- **Forbidden:** `apps/**`; `wordpress/**`; `supabase/**`; `package.json`; `pnpm-lock.yaml`; `pnpm-workspace.yaml`; `.github/**`; `docs/contracts/**`; `docs/decisions/**`; `reference/frontend-approved/**`.
- **Release condition:** lease releases after reviewed merge of this CP-04 evidence PR, or explicit senior reassignment. This lease does not claim CORE-01.
- Unmerged WS2 `ws2/cp-04-commerce-intake` edits only WS2 status/handoff/evidence and does not collide with these paths.

Live pricing/health/RLS/payment/hardware/production gates: UNVERIFIED except the public CP-04 facts in `docs/integration/evidence/CP-04-LIVE-AUDIT.md`. GitHub confirms public visibility; the private-plan restriction is resolved. Live branch read 2026-09-12 via `gh api repos/WB-DevWorld/cetech-pwa-pos/branches/main`: `protected=true`; required checks include `control-plane` and `control-plane-windows`. CP-04 does not change branch-protection settings. Initial tasks are not proof of implementation.

Evidence: CP-05 remains MERGED / VERIFIED (PR #32 / `095696f…`; issue #5 completed). CP-04 2026-09-12 public probes recorded; staging isolation NOT PROVEN; CORE-01 remains BLOCKED.

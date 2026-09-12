# Current work ledger

Updated 2026-09-12. Canonical repo WB-DevWorld/cetech-pwa-pos. Senior @wbdevworld owns integration/migrations/contracts/config. GitHub issues are live task/status evidence; this table is the cross-workstream coordination summary.

| Task | Owner | Branch | Status | Dependencies / blocked by | Contracts | Merge order |
| --- | --- | --- | --- | --- | --- | --- |
| CP-01/02/03 | WS3 | main (foundation) | IMPLEMENTED / VERIFIED; human review available | Commit 9229334; GitHub CI run 34643828253 success | v1.0.0 | First |
| CP-04 | WS3 + WS2 evidence | fix/bootstrap-windows-setup (facts intake) | PARTIAL: user-reported staging facts recorded | HPOS/stock/barcode/currency/tax and independent runtime proof pending | Environment policy | Before live integration |
| CP-05 | WS3 | ws3/cp-05-scaffold | SPECIFIED | CP-03; actual toolchain verification | v1 reexports | Shared foundation first |
| FE-01 | @Ben-001-sys / WS1 | ws1/fe-01-reference-map | READY for bounded reference mapping | Write access verified; pull tooling repair and pass verifier | Prototype→v1 mapping | Independent |
| BR-01 | WS2 | ws2/br-01-health | SPECIFIED | CP-04 staging/plugin facts | Bridge v1 | After live inputs |
| CORE-01 | WS3 | ws3/core-01-schema | SPECIFIED | CP-04/05 | POS operational models | One migration editor |

Central edit lease: WS3 senior, task CP-01/CP-05 tooling repair and CP-04 facts intake, branch `fix/bootstrap-windows-setup`. Allowed: scripts/**, tests/tooling/**, .gitattributes, .github/**, root/current documentation. Forbidden: approved artifact/hash manifest, domain contracts, frontend/bridge feature code, database migrations. Contract changes: none. Acceptance: strict reference check; Windows/Linux tooling tests; dry-run and API failure diagnostics; genuine reference edits preserved; CI evidence in PR. Release this lease after review/merge, then CP-05 may claim root scaffold files.

Live pricing/health/RLS/payment/hardware/production gates: UNVERIFIED. GitHub confirms public visibility; the private-plan restriction is resolved. Main protection remains NOT CONFIGURED at the last 2026-09-12 read; apply needs an admin-capable CLI because the connector exposes no protection write action. Initial tasks are not proof of implementation.

Evidence: all 165 files in foundation tree d32d573f41bfe2e1f5dded57fd2f122704944be5 matched local Git blob hashes; 28 source assets also match SHA-256 manifest. GitHub issues #1–#30 confirmed. CI control-plane passed on 9229334a994760c715a546392eb8f80623708218. Final evidence documentation is a subsequent commit; application runtime tests remain pending.

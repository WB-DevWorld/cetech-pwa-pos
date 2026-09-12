# Current work ledger

Updated 2026-09-12. Canonical repo WB-DevWorld/cetech-pwa-pos. Senior @wbdevworld owns integration/migrations/contracts/config. GitHub issues are live task/status evidence; this table is the cross-workstream coordination summary.

| Task | Owner | Branch | Status | Dependencies / blocked by | Contracts | Merge order |
| --- | --- | --- | --- | --- | --- | --- |
| CP-01/02/03 | WS3 | main (foundation) | IMPLEMENTED / VERIFIED; human review available | Commit 9229334; GitHub CI run 34643828253 success | v1.0.0 | First |
| CP-04 | WS3 + WS2 evidence | main (facts already merged via PR #31) | PARTIAL: user-reported staging facts recorded | HPOS/stock/barcode/currency/tax and independent runtime proof pending | Environment policy | Before live integration |
| CP-05 | WS3 | ws3/cp-05-pin-toolchain-and-create-next.js-ci-scaffold | IMPLEMENTED / local + CI evidence recorded; human review required | CP-03 (met on main 15287691); toolchain verified from official registries 2026-09-12 | v1.0.0 unchanged; canonical re-export wiring deferred | Shared foundation first |
| FE-01 | @Ben-001-sys / WS1 | ws1/fe-01-reference-map | READY for bounded reference mapping | Write access verified; pull tooling repair and pass verifier | Prototype→v1 mapping | Independent |
| BR-01 | WS2 | ws2/br-01-health | SPECIFIED | CP-04 staging/plugin facts | Bridge v1 | After live inputs |
| CORE-01 | WS3 | ws3/core-01-schema | SPECIFIED | CP-04/05 | POS operational models | One migration editor |

## Central edit lease (active)

- **Editor:** WS3 senior / @wbdevworld.
- **Task:** CP-05 — Pin toolchain and create Next.js/CI scaffold (GitHub issue #5).
- **Branch/worktree:** `ws3/cp-05-pin-toolchain-and-create-next.js-ci-scaffold` in a dedicated clean worktree.
- **Base:** `origin/main` `15287691a71081ca2855b5b9bc325a787b2ca7c0` (PR #31 merged). No other open PRs or CP-05 branches existed at lease claim.
- **Stale lease released:** `fix/bootstrap-windows-setup` (PR #31) is merged; it no longer owns root package/CI/app routing files.
- **Allowed (issue #5):** `apps/pos-web/package.json`; `apps/pos-web/src/app/**`; `apps/pos-web/tsconfig.json`; `apps/pos-web/next.config.*`; `apps/pos-web/eslint.config.*`; `apps/pos-web/*test*`; `apps/pos-web/public/**`; `package.json`; `pnpm-lock.yaml`; `.github/workflows/**`; `docs/standards/TOOLCHAIN.md`.
- **Narrow extra paths recorded before edit (assignment §7):**
  - `pnpm-workspace.yaml` — required so root `pnpm install --frozen-lockfile` installs the app package into one lockfile. Not a Turborepo/multi-app architecture.
  - `apps/pos-web/playwright.config.ts` and `apps/pos-web/e2e/**` — required real `test:e2e` smoke.
  - `apps/pos-web/README.md` — remove the stale “no app exists” statement and document Ben/WS1 install commands.
  - `apps/pos-web/next-env.d.ts` — Next.js TypeScript reference file required for `tsc --noEmit` / App Router types. Generated/maintained by Next; not a second contract layer.
  - `scripts/verify_control_plane.py` — required after first `pnpm install`. Generated/install/build trees (`node_modules`, `.next`, `playwright-report`, `test-results`, `coverage`, `dist`, `out`, and `.git`) are excluded from both Markdown-link and secret-tripwire walks. Markdown-link validation continues to skip `artifact` as before CP-05. Secret-tripwire scanning must still cover `artifact`.
  - `tests/tooling/test_control_plane_walks.py` — CP-05 verifier-remediation regression: generated/install paths skipped; `artifact` skipped for Markdown links; `artifact` not skipped for secret tripwire. Recorded before that test file is added.
- **Administrative-only docs:** this file; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/STATUS.md`; `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/HANDOFF.md`.
- **Forbidden:** `apps/pos-web/src/features/**`; `apps/pos-web/src/ui/**`; `wordpress/cetech-pos-bridge/**`; `supabase/**`; `docs/contracts/**`; `docs/decisions/**`; `reference/frontend-approved/artifact/**`; `reference/frontend-approved/SHA256SUMS.json`. No CORE-01/auth/bridge/pricing/payment/PWA work.
- **Contracts:** frozen schema **v1.0.0** remains in `docs/contracts`. CP-05 does not re-export or duplicate Money/Quantity/Quote/Payment/Sale/ports. Canonical app re-export location would require `src/core/**` (out of this task); deferred.
- **Acceptance commands:** `python scripts/verify_control_plane.py`; `python -m unittest discover -s tests/tooling -v`; `pnpm install --frozen-lockfile`; `pnpm --dir apps/pos-web lint`; `pnpm --dir apps/pos-web typecheck`; `pnpm --dir apps/pos-web test`; `pnpm --dir apps/pos-web build`; `pnpm --dir apps/pos-web test:e2e`; `git diff --check`.

Live pricing/health/RLS/payment/hardware/production gates: UNVERIFIED. GitHub confirms public visibility; the private-plan restriction is resolved. Live branch read 2026-09-12 via `gh api repos/WB-DevWorld/cetech-pwa-pos/branches/main`: `protected=true`; required checks include `control-plane` and `control-plane-windows`. The protection endpoint was also readable and confirmed those required checks. This task does not change branch-protection settings. Initial tasks are not proof of implementation.

Evidence: all 165 files in foundation tree d32d573f41bfe2e1f5dded57fd2f122704944be5 matched local Git blob hashes; 28 source assets also match SHA-256 manifest. GitHub issues #1–#30 confirmed. CP-05 GitHub Actions run 34694148734: control-plane SUCCESS and control-plane-windows SUCCESS. Human review of PR #32 remains required.

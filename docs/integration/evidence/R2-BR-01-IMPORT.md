# R2 BR-01 exact-SHA import

UTC: 2026-09-12 (import on combined R2 tree)

START_FRESHNESS_SNAPSHOT: `docs/integration/evidence/R2-START-FRESHNESS-BR01-IMPORT.md` (`2026-09-12T23:15:17Z`)

- origin/main: `aa08d74f2cb99301817e5995f01486acb7e2169f`
- R2 head before import: `8369c442026ce2fc133f13186c0bc697eb3bc7e6`
- Declared contributor SHA: `280a73dbcd53ac0e03883775b4fabdec7465a4a8`
- Stale SHA not consumed: `fbbf0ea7d016b6149e9f095d449fb15b0dcdf930`
- Import method: `git merge --no-commit --no-ff 280a73dbcd53ac0e03883775b4fabdec7465a4a8` then commit
- Combined/import SHA: `0ac2e38befb54c9ada404e6854a80285bebb69b9`
- Parents: `8369c442026ce2fc133f13186c0bc697eb3bc7e6` + `280a73dbcd53ac0e03883775b4fabdec7465a4a8`
- Conflicts: none

## Inspection vs accepted main `aa08d74f…` → `280a73d…`

Owned paths only:

- `wordpress/cetech-pos-bridge/**`
- `tests/bridge/**`
- `tests/fixtures/commerce/**`
- WS2 STATUS/HANDOFF/evidence

No `apps/**` implementation, contracts, `.github/**`, lockfile, or `reference/**`.

Makefile `check` quotes `PLUGIN_DIR`-relative test paths so GNU Make does not split on spaces. Plugin detection/auth/health PHP is unchanged vs the stale SHA (`includes/` and `tests/bridge` empty vs `fbbf0ea7…`).

## Classification

`READY_FOR_R2_INTEGRATION` at inspection, then **INTEGRATED_AND_TESTED** on the combined R2 tree.

This is local/code integration readiness only. Not live WordPress, pricing parity, checkout, or production readiness.

Live authenticated Browser→BFF→bridge→Woo remains **LIVE_ACCEPTANCE_PENDING** / `BLOCKED_REMOTE_ACCEPTANCE` pending authorized CP04-W4 service identity/install. No plugin install, Application Password creation, Woo mutation, or credential minting was performed.

## Combined tests on import SHA `0ac2e38…` (before CORE-03 composition)

| Command | Result |
| --- | --- |
| `python scripts/verify_control_plane.py` | EXIT 0 |
| `python -m unittest discover -s tests/tooling -v` | EXIT 0, 48 tests |
| `make -C wordpress/cetech-pos-bridge check` | EXIT 0 |
| `make -C wordpress/cetech-pos-bridge test` | EXIT 0, **67 passed / 0 failed** |
| `pnpm install --frozen-lockfile` | EXIT 0 |
| `pnpm --dir apps/pos-web lint` | EXIT 0 |
| `pnpm --dir apps/pos-web typecheck` | EXIT 0 |
| `pnpm --dir apps/pos-web test` | EXIT 0, 15 files / 73 tests |
| `pnpm --dir apps/pos-web build` | EXIT 0 |
| `pnpm --dir apps/pos-web test:e2e` | EXIT 0, 1 passed (scaffold smoke) |
| `git diff --check` | EXIT 0 |

Contributor CI on `280a73d…` run 34724744035: Linux `control-plane` SUCCESS including Playwright; `control-plane-windows` SUCCESS. That CI is contributor evidence, not combined-tree proof.

Contracts v1.0.0 unchanged. Lockfile unchanged.

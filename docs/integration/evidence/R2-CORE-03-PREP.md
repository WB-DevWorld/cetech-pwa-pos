# R2 CORE-03 PREP_ONLY checkpoint

UTC: 2026-09-12 (local validation before commit)

## Classification

- CORE-02: CHECKPOINTED `95289a72d88c3b9c1cf86d44c4a44b17188bee46`
- CORE-03: PREP_ONLY against frozen StoreHealth / BridgeHealth / ApiFailure v1.0.0
- BR-01 observed SHA: `fbbf0ea7d016b6149e9f095d449fb15b0dcdf930` on `origin/ws2/br-01-build-bridge-health-and-permission-skeleton`
- BR-01 class: PROVISIONAL_TEST — not accepted, not combined/tested against `aa08d74f…`, no GitHub Actions on that SHA, merge-base still `cd4477f…`
- Not claimed: live Browser→BFF→Supabase; live bridge→Woo detection; pricing parity

## Local validation

| Command | Result |
| --- | --- |
| `python scripts/verify_control_plane.py` | EXIT 0 |
| `python -m unittest discover -s tests/tooling -v` | EXIT 0, 48 tests |
| `pnpm install --frozen-lockfile` | EXIT 0 |
| `pnpm --dir apps/pos-web lint` | EXIT 0 |
| `pnpm --dir apps/pos-web typecheck` | EXIT 0 |
| `pnpm --dir apps/pos-web test` | EXIT 0, 13 files / 51 tests |
| `pnpm --dir apps/pos-web build` | EXIT 0; `ƒ /api/pos/v1/health` |
| `pnpm --dir apps/pos-web test:e2e` | EXIT 0, 1 passed (scaffold smoke only) |
| `git diff --check` | EXIT 0 |

Runtime: Windows, Node v24.21.0, pnpm 12.4.1, Python 3.14.4.

## Safety

No WordPress plugin install/activation; no live bridge credentials; no Woo/stock/payment/email; no remote Supabase migration; no deployment.

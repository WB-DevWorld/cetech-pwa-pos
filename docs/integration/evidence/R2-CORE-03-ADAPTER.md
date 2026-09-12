# R2 CORE-03 adapter checkpoint

UTC: 2026-09-12 (local validation before commit)

Continuation START_FRESHNESS_SNAPSHOT: `2026-09-12T22:22:20Z`.
CORE-02 acceptance remediation: `2f6c0b50cd7889e83df93b87af0b7c165152b5db`.
BR-01 contributor SHA (not imported): `fbbf0ea7d016b6149e9f095d449fb15b0dcdf930`.
Disposable combination SHA (not imported): `f7661a7996317b3e6bad57b395f0bf7010c59e87`.

## What this checkpoint proves

- BFF adapter maps the frozen BridgeHealth envelope (BR-01 success example shape).
- Service identity is HTTP Basic (application password), not a staff session and not a service-role key.
- Injected fetch can surface `wooDetected` / `woodmartDetected` / `b2bkingDetected`.
- `pricingParityVerified` is always false; detection is not pricing parity.
- 401/403/timeout/5xx do not become trusted healthy access.
- Next `GET /api/pos/v1/health` still does not attach the client (no live WordPress from R2).

## Not claimed

- BR-01 accepted
- Live Browser→BFF→bridge/Woo detection
- Pricing parity
- Live checkout
- Production readiness
- Make `check`/`test` PASS

## Local validation

| Command | Result |
| --- | --- |
| `python scripts/verify_control_plane.py` | EXIT 0 |
| `python -m unittest discover -s tests/tooling -v` | EXIT 0, 48 tests |
| `pnpm install --frozen-lockfile` | EXIT 0 |
| `pnpm --dir apps/pos-web lint` | EXIT 0 |
| `pnpm --dir apps/pos-web typecheck` | EXIT 0 |
| `pnpm --dir apps/pos-web test` | EXIT 0, 15 files / 73 tests |
| `pnpm --dir apps/pos-web build` | EXIT 0; `ƒ /api/pos/v1/health` |
| `pnpm --dir apps/pos-web test:e2e` | EXIT 0, 1 passed (scaffold smoke only) |
| `git diff --check` | EXIT 0 |

Runtime: Windows, Node v24.21.0, pnpm 12.4.1, Python 3.14.4. PHP 8.5.0 CLI for disposable BR-01 combination only (`make` missing).

Contracts v1.0.0 unchanged. Lockfile unchanged.

## Classification

CORE-03: **ADAPTER CHECKPOINTED**; Next route remains PREP_ONLY / unattached. Live service-identity runtime remains CP-04-gated. R2 gate not passed.

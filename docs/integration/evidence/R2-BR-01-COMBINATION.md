# R2 BR-01 combination (PROVISIONAL_TEST, not accepted)

UTC: 2026-09-12 (continuation session after CORE-02 `2f6c0b5…`)

This is editor combination evidence. It is **not** an import into draft PR #43 and **not** BR-01 acceptance.

## Refs

| Item | SHA / result |
| --- | --- |
| Contributor branch | `origin/ws2/br-01-build-bridge-health-and-permission-skeleton` |
| Contributor SHA | `fbbf0ea7d016b6149e9f095d449fb15b0dcdf930` |
| Merge-base with `origin/main` | `cd4477f185c159e18ed939a20145865d665099b4` (pre-R1) |
| Divergence vs `origin/main` `aa08d74f…` | 1 / 1 |
| Disposable combination HEAD | `f7661a7996317b3e6bad57b395f0bf7010c59e87` (ort merge, clean) |
| GitHub Actions on contributor SHA | none |
| Classification | PROVISIONAL_TEST; **not accepted**; **not imported** (`wordpress/**` remains forbidden on the R2 lease) |

## PHP / Make

- `php -v`: PHP 8.5.0 CLI available on this Windows host.
- `make`: **not installed**. Canonical `make -C wordpress/cetech-pos-bridge check` and `test` were **not** executed.
- Makefile recipes were run directly with PHP in the disposable tree `C:\Users\Jane\AppData\Local\Temp\cetech-r2-br01-combine` at `f7661a7996317b3e6bad57b395f0bf7010c59e87`:
  - `php -l` on plugin + test sources: no syntax errors
  - `php tests/bridge/run.php`: **67 passed, 0 failed**, EXIT 0
- Missing Make means BR-01 remains **unaccepted** and R2 remains **draft**. Do not invent `make` PASS.

## Owner follow-up

`STALE_REQUIRES_OWNER_REFRESH`: contributor branch is still based on pre-R1 `cd4477f…` with no Actions on `fbbf0ea7…`. Merge into current main was clean in a disposable worktree, so this is not `CONFLICT_REQUIRES_OWNER`. WS2 should refresh/rebase the contributor branch onto current main and provide Make/CI evidence. WS3 must not alter WS2 plugin semantics.

## What WS3 consumed

Frozen BridgeHealth / ApiFailure v1.0.0 plus the published example envelope shape. No `wordpress/**` files were copied onto `batch/r2-auth-bridge-bff`.

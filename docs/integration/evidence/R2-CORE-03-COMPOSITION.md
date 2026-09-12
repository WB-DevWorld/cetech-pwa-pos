# R2 CORE-03 composition (code complete; remote acceptance pending)

UTC: 2026-09-12

Continuation START_FRESHNESS_SNAPSHOT: `2026-09-12T23:15:17Z`.
BR-01 imported SHA: `0ac2e38befb54c9ada404e6854a80285bebb69b9` from `280a73dbcd53ac0e03883775b4fabdec7465a4a8`.
CORE-02 checkpoint: `2f6c0b50cd7889e83df93b87af0b7c165152b5db`.
CORE-03 adapter checkpoint: `88a840c72a01463f78de8df77dd8a04bb7ee1431`.

## What this composition proves

- Next `GET /api/pos/v1/health` composes the BR-01 adapter through `composeBridgeHealthInspect`.
- WordPress username / application password / privileged Supabase credentials stay server-only. `NEXT_PUBLIC_BRIDGE_*` is rejected. `readServerEnv()` does not serialize username or password.
- Placeholders (`REPLACE_WITH_*`) keep the live client unattached. No default WordPress host is contacted from tests.
- Staff session remains the BFF auth boundary. Bridge Basic identity is not a staff session.
- Request `X-Correlation-ID` is sent. Matching echoed `correlationId` is accepted. Missing, malformed, or mismatched correlation (body or header) fails closed (`unavailable`, not trusted).
- Detection flags may surface from an injected/composed inspect. `pricingParityVerified` stays false.
- Ephemeral in-memory session store remains refused for `APP_ENV=production|staging`.

## Not claimed

- Live Browser→BFF→Supabase runtime health
- Live Browser→BFF→bridge→Woo detection on training
- Pricing parity
- Checkout readiness
- Production auth durability
- R2 milestone gate / Ben review

## Combined tests on the composed tree (local)

| Command | Result |
| --- | --- |
| `python scripts/verify_control_plane.py` | EXIT 0 |
| `python -m unittest discover -s tests/tooling -v` | EXIT 0, 48 tests |
| `make -C wordpress/cetech-pos-bridge check` | EXIT 0 |
| `make -C wordpress/cetech-pos-bridge test` | EXIT 0, **67 passed / 0 failed** |
| `pnpm install --frozen-lockfile` | EXIT 0 |
| `pnpm --dir apps/pos-web lint` | EXIT 0 |
| `pnpm --dir apps/pos-web typecheck` | EXIT 0 |
| `pnpm --dir apps/pos-web test` | EXIT 0, 15 files / **79 tests** |
| `pnpm --dir apps/pos-web build` | EXIT 0; `ƒ /api/pos/v1/health` |
| `pnpm --dir apps/pos-web test:e2e` | EXIT 0, 1 passed (scaffold smoke only) |
| `git diff --check` | EXIT 0 |

Runtime: Windows, Node v24.21.0, pnpm 12.4.1, Python 3.14.4, PHP 8.5.0 CLI, GNU Make 4.4.1. No live Woo/WordPress/Supabase calls. No plugin install. No Application Password created.

## Classification

CORE-03: **CODE_COMPLETE_REMOTE_ACCEPTANCE_PENDING**

Required remote gate: CP04-W4 (authorized bridge install + least-privilege service identity) plus issue #4 write-safety remaining open. Keep PR #43 draft. Do not request `@Ben-001-sys` until live authorized health can actually be proven or the repository gate is otherwise satisfied.

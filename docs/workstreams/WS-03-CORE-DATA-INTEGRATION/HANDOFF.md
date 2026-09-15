# WS3 current handoff — RT-01 safe-returns runtime

Kind: TASK_COMPLETION. Date: 2026-09-15T18:31:00Z (pre-push; exact final SHA recorded after push).

Task / batch / workstream: RT-01 WS3 SAFE RETURNS RUNTIME / #27 / WS3.
Owner / integration editor: `@wbdevworld` / WS3.
Mode: IMPLEMENT.
Requested human reviewer: ChatGPT integration control. Do not open a PR from this branch.

Branch: `ws3/rt-01-implement-safe-returns-runtime`
START_SHA: `58d385300bfba784435448029e88f07742048cde`
PAY-01 / R7: `9ab7e5b7cf2b5d4f253f9d41468726c31cbfc091` PROVISIONAL_TEST, PR #58 draft, sandbox-deferred, NOT MERGED.
Post-R6 main: `bd79c2901ce33c3177141d4244cc196be0a719d2`.
Neutral RT-01: `batch/rt01-safe-returns` @ `58d3853…` (not implemented on).

Allowed: `apps/pos-web/src/core/**`, `apps/pos-web/src/server/**`, `supabase/**`, `tests/integration/returns/**`, WS3 STATUS/HANDOFF, vitest discovery for the new suite.
Forbidden preserved: `apps/pos-web/src/features/**`, `apps/pos-web/src/ui/**`, `wordpress/**`, `tests/bridge/**` as implementation, `docs/contracts/**`, `apps/pos-web/src/app/api/**`, CURRENT-WORK.

Contracts: v1.0.0 unchanged. ADR-015 consumed, not reopened.
Database: `supabase/migrations/20260915200000_pos_returns.sql` additive after `20260915180000_pos_electronic_payment.sql`.

## What shipped

Trusted preview from historic sale economics → fingerprint/expiry → optional approval binding → atomic execute claim (quantity + tender caps) → independent cash or provider refund, commercial refund, and stock disposition identities allocated before remote effects → truthful `ReturnResolution` → `ReturnPort.resolve` reconciling the same IDs after restart.

## Remaining runtime blockers

- Paystack refund sandbox / credentials / provider idempotency: fail-closed. Not mocked as Paystack acceptance.
- Issue #27 does not grant `apps/pos-web/src/app/api/**`. Handlers exist for tests; HTTP mounting not done.
- WS2 #60 Woo producer not imported. WS3 uses a deterministic `BridgeReturnEffectsPort` fake.
- WS1 #11 UI not imported.

Terminal intent: `RT01_WS3_READY_FOR_INTEGRATION_PROVIDER_SANDBOX_DEFERRED` after exact-head CI on the pushed SHA.

## Tests executed (pre-push)

- `python scripts/verify_control_plane.py` → PASS (30 tasks, 28 reference files, 81 schemas, 63 fixtures)
- `python -m unittest discover -s tests/tooling -v` → 48 OK
- `pnpm --dir apps/pos-web lint` → ok
- `pnpm --dir apps/pos-web typecheck` → ok
- `pnpm --dir apps/pos-web test` → 63 files / 599 tests PASS
- focused `tests/integration/returns/**` → 26 tests PASS
- `pnpm --dir apps/pos-web build` → ok
- `pnpm --dir apps/pos-web exec playwright test --workers=1` → 7 passed
- `git diff --check` → clean
- Local Supabase reset/pgTAP: NOT RUN on this workstation. CI Linux job must apply `pos_returns.sql` (plan 41).
- Bridge `make -C wordpress/cetech-pos-bridge check/test/parity`: not required for WS3 source; no WordPress edits. If old suite fails only because BR-08 is absent: `EXPECTED_CROSS_OWNER_PENDING`.

Remote effects: none. No real refund, restock, or production mutation.

Pass 3: NOT PERMITTED.
Production promotion NOT AUTHORIZED.

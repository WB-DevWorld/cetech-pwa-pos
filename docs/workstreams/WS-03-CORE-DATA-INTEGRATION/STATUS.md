# WS3 current status

Snapshot 2026-09-15T18:31:00Z. Contributor branch `ws3/rt-01-implement-safe-returns-runtime` for RT-01 / #27 safe-returns runtime.

## Starting truth

| Role | SHA / classification |
| --- | --- |
| Post-R6 `main` | `bd79c2901ce33c3177141d4244cc196be0a719d2` ACCEPTED / MERGED |
| PAY-01 / R7 code-ready head | `9ab7e5b7cf2b5d4f253f9d41468726c31cbfc091` PROVISIONAL_TEST |
| Accepted RT-01 contract | `58d385300bfba784435448029e88f07742048cde` |
| Neutral `batch/rt01-safe-returns` | `58d385300bfba784435448029e88f07742048cde` |
| WS3 runtime branch | `ws3/rt-01-implement-safe-returns-runtime` (implementation in progress on this snapshot) |
| WS2 #60 | `ws2/br-08-implement-return-refund-stock-effects` observed, not imported |
| WS1 #11 | `ws1/fe-06-implement-payment-returns-and-register-states` observed, not imported |

R7 PR #58 remains draft / sandbox-deferred / NOT MERGED. Issue #4 remains OPEN. `pricingParityVerified=false`. Production promotion is NOT AUTHORIZED.

## RT-01 runtime

Owner `@wbdevworld` / WS3. Mode: IMPLEMENT. ADR-015 accepted. Shared contracts frozen; `docs/contracts/**` not edited.

Allowed used: `apps/pos-web/src/core/**`, `apps/pos-web/src/server/**`, `supabase/**`, `tests/integration/returns/**`, this STATUS/HANDOFF, plus WS3 vitest discovery so the new suite is CI-visible.

Forbidden preserved: WS1 features/UI, WS2 WordPress, `apps/pos-web/src/app/api/**`, CURRENT-WORK, contract redesign.

HTTP route mounting was not required to complete WS3 core/server/storage/orchestration/tests. Remaining UI/API mounting is out of issue #27.

No real Woo/Paystack/cash payouts. Deterministic fakes only.

## Policy gaps (fail-closed, not invented)

- No approved numeric/threshold manager-approval rule (no GHS 500, no cashier %). Production preview sets `approvalRequired=false`. Architecture for binding/fingerprint/expiry is implemented; tests inject `requireApproval`.
- `opened_resellable` / `defective` have no bound tenant restock policy → `no_automatic_restock` / `tenant_policy_required`.
- Paystack refund create has no client-controlled idempotency key. Concrete adapter is fail-closed `requires_attention` and never POSTs. Fake provider proves orchestration.

## Local evidence (pre-push)

- `python scripts/verify_control_plane.py` PASS
- `python -m unittest discover -s tests/tooling -v` 48 OK
- `pnpm --dir apps/pos-web lint` ok
- `pnpm --dir apps/pos-web typecheck` ok
- `pnpm --dir apps/pos-web test` 63 files / 599 tests PASS
- `pnpm --dir apps/pos-web build` ok
- `pnpm --dir apps/pos-web exec playwright test --workers=1` 7 passed
- Local Supabase reset/pgTAP not executed on this Windows workstation (npx supabase hung). Linux CI `control-plane` remains the pgTAP runner for `supabase/tests/pos_returns.sql` (plan 41).

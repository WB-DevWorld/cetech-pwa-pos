# R8 reconciliation onto final accepted R7 `main`

Date: 2026-09-16. Integration editor: `@wbdevworld` / WS3. Mode: INTEGRATE. No secrets.

## Refs used

| Role | SHA |
| --- | --- |
| Prior expected `origin/main` (instruction) | `1feb78db36f33e0254c0170396f30112d71577ea` |
| `origin/main` at start of this task | `1feb78db36f33e0254c0170396f30112d71577ea` |
| Accepted R7 merge | `[R7] Verified electronic payment and reconciliation (#58)` |
| R7 post-merge CI | `35136321143` SUCCESS |
| Accepted downstream R8 head | `5fa875eb43c0b2f62b59b80a3dfa3812c2d1e190` |
| Accepted downstream branch | `batch/rt01-safe-returns-ws3-integrated` |
| Recovery branch | `batch/r8-safe-returns-reconciliation` |
| Historical provisional R7 (delta base only) | `9ab7e5b7cf2b5d4f253f9d41468726c31cbfc091` |
| Merge-base (`origin/main` vs accepted R8) | `bd79c2901ce33c3177141d4244cc196be0a719d2` (R6) |

`main` had not moved past `1feb78d…` at reconciliation start. The historical provisional R7 SHA is not current authority.

## Path classification (`R8_BASE` = provisional R7, `R8_ACCEPTED` = `5fa875e…`)

### Rule A — current-main-only (byte-for-byte `origin/main`)

`.github/workflows/deploy-staging.yml`
`apps/pos-web/src/config/env.ts`
`apps/pos-web/src/config/env.test.ts`
`apps/pos-web/src/core/checkout/monotonic.ts`
`apps/pos-web/src/server/payments/apply-verification.ts`
`docs/integration/evidence/R7-PAY-01-CONCURRENCY.md`
`docs/integration/evidence/R7-PAY-01-MILESTONE-FRESHNESS.md`
`docs/integration/evidence/R7-PAY-01-SANDBOX.md`
`docs/runbooks/CD-01-STAGING-DEPLOYMENT.md`
`supabase/migrations/20260916120000_pos_payment_monotonic.sql`
`supabase/tests/payment_monotonic.sql`
`tests/integration/payments/durable-electronic-store.test.ts`
`tests/integration/payments/electronic-payment.test.ts`

### Rule B — R8-only (accepted R8 implementation)

All other paths in `git diff --name-only 9ab7e5b7…..5fa875eb…` except the Rule C set. Git also conflicted on these Rule B paths because the squash R7 rewrite does not share the provisional R7 commits; `R8_BASE` content equals `origin/main` for each, so the R8 side was taken:

`apps/pos-web/src/core/checkout/types.ts`
`apps/pos-web/src/server/sales/authorize-checkout.ts`
`apps/pos-web/src/server/sales/supabase-checkout-store.ts`
`apps/pos-web/vitest.config.mts`
`tests/tooling/test_vitest_discovery.py`

### Rule C — shared (semantic merge; final R7 starting authority + accepted R8 delta)

| Path | Decision |
| --- | --- |
| `CURRENT-WORK.md` | Rewritten to current truth: R7 merged; R8 active on PR #69; R9 not imported; historical provenance preserved. |
| `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/STATUS.md` | Same current-truth rewrite. |
| `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/HANDOFF.md` | R8 reconciliation handoff; R7 completion history retained as provenance. |
| `apps/pos-web/src/core/checkout/in-memory-store.ts` | Keep R7 `mergeStoredSale` / `mergeStoredPayment`; keep R8 `cash_refund` duplicate guard, `listCashRefunds`, `getSaleBySaleId`. |
| `tests/integration/sales/fake-posgrest.ts` | Keep R7 `applyMonotonicAssign`; keep R8 return tables and cash-refund unique `refund_id`. |

Git `add/add` conflicts on `apply-verification.ts` and the two R7 payment test files were resolved as Rule A (`origin/main`).

## Non-goals / non-effects

- No R9 import from `batch/r9-pwa-recovery-operational-close`.
- No rebase, no force-push, no history rewrite of accepted R8 commits.
- No real refund, restock, live Paystack charge, production Woo mutation, production deploy, or VitePOS deactivation.

## Exact new candidate SHA

Recorded after this merge commit on `batch/r8-safe-returns-reconciliation` (cannot be self-referential here). See `git rev-parse HEAD` after the push and the final Cursor report.

## Tests (pre-commit, this workstation)

| Command | Result |
| --- | --- |
| `python scripts/verify_control_plane.py` | PASS |
| `python -m unittest discover -s tests/tooling -v` | 48 OK |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm --dir apps/pos-web lint` | PASS |
| `pnpm --dir apps/pos-web typecheck` | PASS |
| `pnpm --dir apps/pos-web test` | 66 files / 643 tests PASS |
| `pnpm --dir apps/pos-web build` | PASS; `/returns` route present; `.next/static` has no `sk_test_` / `sk_live_` / `PAYSTACK_SECRET` |
| `pnpm --dir apps/pos-web test:e2e` | 7 passed (canonical script; Playwright browsers from `%LOCALAPPDATA%\ms-playwright`) |
| `git diff --check` | clean |
| WSL `make -C wordpress/cetech-pos-bridge check PHP=/mnt/c/tools/php85/php.exe` | PASS |
| Windows `php.exe tests/bridge/run.php` | **1525 passed, 0 failed** |
| Windows `php.exe tests/bridge/parity.php` | **138 passed, 0 failed, 19 skipped**; `pricingParityVerified` remains false |
| `npx supabase@2.117.0 db reset --yes --local` | BLOCKED on Windows cmd quoting (`UnknownError` / `.bat` special character). Not invented PASS. |
| Docker apply `20260915200000_pos_returns.sql` then pgTAP via `docker exec supabase_db_cetech-pwa-pos psql` | `payment_monotonic.sql` 6/6; `electronic_payment.sql` finish; `pos_returns.sql` 41/41; plus rls/prepare/durable/cash uniqueness — all ROLLBACK, exit 0 |

WSL `make … test` could not open Linux-style paths with Windows PHP; the established Windows PHP path above is the executed suite.

## Known limitations

- Controlled training refund/restock rehearsal remains a remaining gate if still required for final R8 human acceptance; not executed here.
- Independent review of mixed WS1/WS2/WS3 work is still required; this editor cannot self-approve PR #69.
- Canonical Vitest include still omits `src/config/env.test.ts`; live-key refusal is covered by `tests/integration/payments/electronic-payment.test.ts`.

## Known limitations

- Controlled training refund/restock rehearsal remains a remaining gate if still required for final R8 human acceptance; not executed here.
- Independent review of mixed WS1/WS2/WS3 work is still required; this editor cannot self-approve PR #69.

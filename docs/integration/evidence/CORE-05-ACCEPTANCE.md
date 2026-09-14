# CORE-05 / issue #24 acceptance evidence

Task: CORE-05 / issue #24. Isolated contributor branch `ws3/core-05-build-cash-and-finalizesale-orchestration` from exact tested predecessor `BR06_INTEGRATION_SHA=15baab1b47a35902b8a3ddde989df55cc4b25436`. Owner / actual implementer: `@wbdevworld` / WS3.

This is not R5 complete. Do not import this SHA into PR #53 from this assignment. Do not start R6 or BR-07. `pricingParityVerified` remains false. Issue #4 remains OPEN. No production promotion.

Shared `CURRENT-WORK.md` and WS3 STATUS/HANDOFF were **not** edited (read-only scheduler). On this branch those files still describe CORE-05 as blocked; issue #24 comment 2026-09-14T14:31:18Z plus the user instruction are the implementation authority.

## Acceptance

| Criterion | Evidence |
| --- | --- |
| Same cash command → one net ledger effect | Same Idempotency-Key + body returns the same `paymentId`; `pos` in-memory `cash_sale` count stays 1; expected cash increases by prepared total once. Overlapping distinct keys for the same transaction still produce one movement. |
| Amount / currency / customer / scope mismatch rejected | Short cash and USD-vs-GHS cash → `VALIDATION_ERROR` and no ledger row. Out-of-scope location → `FORBIDDEN`. Payment from customer A used to finalize customer B's sale → `PAYMENT_NOT_VERIFIED`; sale B has zero `cash_sale` rows. Extra `customerId` on cash body fails frozen schema (`additionalProperties: false`). |
| Woo success then POS persist failure is repairable without a second commercial sale | Injected receipt write failure after mock `SalesPort.confirmPayment` success → `SaleResolution.status=requires_attention` + outbox `sale.receipt_persist_repair`. Retry same finalize key completes with a unique receipt. Mock `commercialSaleCount` stays **1**. |
| Open shift | Second open on the same register → `SHIFT_CONFLICT`. Cash without an open shift → `SHIFT_REQUIRED`. |

Commercial finalizer is the CORE-05 **mock** until BR-07. Durable POS sale/payment/receipt adapter is not in this slice; staging/production composition refuses the ephemeral checkout store.

## Commands (CORE-05 worktree)

```text
python scripts/verify_control_plane.py
pnpm --dir apps/pos-web lint
pnpm --dir apps/pos-web typecheck
pnpm --dir apps/pos-web test
git diff --check
```

Results:

- control-plane: **PASS** (3 workstream packages, 30 scoped tasks/DAG, 28 immutable reference files, 61 schemas, 32 contract fixtures)
- lint: **PASS** (eslint `.` exit 0)
- typecheck: **PASS** (`next typegen && tsc --noEmit`)
- Vitest: **46 files / 323 tests PASS** (includes `tests/integration/sales/cash-finalize-orchestration.test.ts`)
- `git diff --check`: clean

Local Supabase `db reset` / pgTAP was not executed in this worktree (no implied local Docker). The unique `cash_sale` index is a schema invariant for later trusted-server writes; in-memory uniqueness + lock serialization is the CORE-05 harness (pgTAP cannot orchestrate true parallel sessions).

## Contracts / migrations / ADRs

- Contracts changed: **none**. Frozen v1.0.0 consumed (PaymentPort, SalesPort, CheckoutUseCases, ReceiptPort).
- ADRs changed: **none**. ADR-004 consumed.
- Migration: `supabase/migrations/20260914150000_pos_cash_sale_one_per_transaction.sql` — unique index `(organization_id, transaction_id)` where `kind = 'cash_sale'`.

## Bounded extra path

`apps/pos-web/vitest.config.mts` include added `../../tests/integration/sales/**/*.test.*` so issue #24 required `pnpm --dir apps/pos-web test` discovers the sales harness. Same class of WS3 discovery edit as CORE-04 sync tests.

## Next exact action

STOP IMPLEMENTATION. WS3 integration editor imports declared CORE-05 source SHA(s) into `batch/r5-idempotent-prepare-cash` / draft PR #53. Do not start R6.

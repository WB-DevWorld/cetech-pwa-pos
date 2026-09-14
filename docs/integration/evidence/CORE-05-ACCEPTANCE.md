# CORE-05 / issue #24 acceptance evidence (owner remediation)

Task: CORE-05 / issue #24. Isolated contributor branch `ws3/core-05-build-cash-and-finalizesale-orchestration` from exact tested predecessor `BR06_INTEGRATION_SHA=15baab1b47a35902b8a3ddde989df55cc4b25436`. Owner / actual implementer: `@wbdevworld` / WS3.

Rejected head: implementation `602a47457cc69298cec06dbed2e99c4dc4cf8255`, previous final `def73afd35edb4ea099d59a8c8351a0f2ab7081d`. Integration review 2026-09-14T15:07:34Z classified **CORE-05 = BLOCKED_OWNER_REMEDIATION**; nothing imported into PR #53. This tree remediates that review.

This is not R5 complete. Do not import this SHA into PR #53 from this assignment. Do not start R6 or BR-07. `pricingParityVerified` remains false. Issue #4 remains OPEN. No production promotion.

Shared `CURRENT-WORK.md` and WS3 STATUS/HANDOFF were **not** edited (read-only scheduler). On this branch those files still describe CORE-05 as blocked; issue #24 comments are the implementation authority.

## Review blockers closed

| Blocker | Remediation |
| --- | --- |
| 1 CORE-02 authorization bypassed | Handlers call `authorizeStaffMutation` / `authorizeStaffRead` with assignment directory. Mutations require `shift.open`, `payment.cash`, `sale.finalize` plus location and register assignment. Receipt GET uses `authorizeStaffRead` + assignment scope; no new receipt permission. Session `capabilities: ["ui.hint.only"]` still succeeds when assignment/permission is present. Negative tests: unassigned location, unassigned register, CSRF mismatch, origin mismatch. |
| 2 POS persist failure not repaired | Cash: after `cash_sale` ledger write, `savePayment`/`saveSale` failure → `requires_attention` + outbox `sale.cash_persist_repair`; idempotency is not left `sent`. Same key retries without a second ledger row and converges to `verified`. Finalize: after `SalesPort.confirmPayment` success, `saveSale(commercialConfirmed=true)` failure → `requires_attention` + outbox `sale.commercial_persist_repair`; retry does not create a second commercial sale. Receipt-write repair remains. |
| 3 migration not validated | Local reset applied `20260914150000_pos_cash_sale_one_per_transaction.sql`. pgTAP `supabase/tests/cash_sale_uniqueness.sql` asserts duplicate `(organization_id, transaction_id)` `cash_sale` is `23505` while a different transaction and `pay_in` remain allowed. Mirrored `rls_isolation.sql` was not edited. |
| Scope note `vitest.config.mts` | Reverted the out-of-scope `tests/integration/sales` include. Canonical executable harness is `apps/pos-web/src/server/sales/cash-finalize-orchestration.test.ts` so required `pnpm --dir apps/pos-web test` still discovers it. `tests/integration/sales/cash-finalize-orchestration.test.ts` is a pointer on the issue-allowed path. |

## Acceptance

| Criterion | Evidence |
| --- | --- |
| Same cash command → one net ledger effect | Same Idempotency-Key + body returns the same `paymentId`; in-memory `cash_sale` count stays 1; expected cash increases by prepared total once. Overlapping distinct keys for the same transaction still produce one movement. |
| Amount / currency / customer / scope mismatch rejected | Short cash and USD-vs-GHS cash → `VALIDATION_ERROR` and no ledger row. Out-of-scope location → `FORBIDDEN`. Payment from customer A used to finalize customer B's sale → `PAYMENT_NOT_VERIFIED`; sale B has zero `cash_sale` rows. Extra `customerId` on cash body fails frozen schema (`additionalProperties: false`). |
| Woo success then POS persist failure is repairable without a second commercial sale | Receipt-write failure after mock `SalesPort.confirmPayment` → `requires_attention` + outbox `sale.receipt_persist_repair`; retry completes; `commercialSaleCount` stays **1**. Commercial-confirmed `saveSale` failure after Woo → `requires_attention`; peek idempotency is not `sent`; retry completes; count stays **1**. |
| Cash ledger then POS payment persist failure | Injected `savePayment` failure after `cash_sale` → `requires_attention`; peek is `requires_attention` not `sent`; one movement; same key retries to `verified` with still one movement. |
| Open shift | Second open on the same register → `SHIFT_CONFLICT`. Cash without an open shift → `SHIFT_REQUIRED`. |
| CORE-02 assignment | Unassigned location/register → `FORBIDDEN`. CSRF/origin mismatch → `FORBIDDEN`. No ledger row on those denials. |

Commercial finalizer is the CORE-05 **mock** until BR-07. Durable POS sale/payment/receipt adapter is not in this slice; staging/production composition refuses the ephemeral checkout store and assignment directory.

## Commands (CORE-05 worktree)

```text
python scripts/verify_control_plane.py
pnpm --dir apps/pos-web lint
pnpm --dir apps/pos-web typecheck
pnpm --dir apps/pos-web test
git diff --check
npx supabase@2.117.0 --version
<official Windows supabase.exe 2.117.0> db reset --local
<official Windows supabase.exe 2.117.0> test db
```

Results:

- control-plane: **PASS** (3 workstream packages, 30 scoped tasks/DAG, 28 immutable reference files, 61 schemas, 32 contract fixtures)
- lint: **PASS** (eslint `.` exit 0)
- typecheck: **PASS** (`next typegen && tsc --noEmit`)
- Vitest: **46 files / 326 tests PASS** (includes CORE-05 sales harness via `src/server/sales/cash-finalize-orchestration.test.ts`)
- `git diff --check`: clean
- pinned CLI version: **2.117.0** (`npx supabase@2.117.0 --version` printed `2.117.0`)
- `npx supabase@2.117.0 db reset --local`: **FAILED** on this Windows Node 24.21.0 host. Node refused the CLI docker spawn through `npx.cmd` (`args[42]` cmd.exe special-character restriction while recreating the database). Not treated as PASS.
- Local reset via the same-version official GitHub release binary `supabase.exe` **2.117.0** (docker.exe on PATH): **PASS**. Applied `20260912170000_pos_operational_schema.sql`, `20260913140000_pos_staff_sessions.sql`, `20260913200000_pos_catalog_projection.sql`, `20260914150000_pos_cash_sale_one_per_transaction.sql`, then `supabase/seed.sql`.
- `supabase.exe test db`: **PASS**. Files=2, Tests=88. `cash_sale_uniqueness.sql` ok; `rls_isolation.sql` ok.

## Contracts / migrations / ADRs

- Contracts changed: **none**. Frozen v1.0.0 consumed (PaymentPort, SalesPort, CheckoutUseCases, ReceiptPort). Auth contracts unchanged; no new receipt permission.
- ADRs changed: **none**. ADR-004 consumed.
- Migration: `supabase/migrations/20260914150000_pos_cash_sale_one_per_transaction.sql` — unique index `(organization_id, transaction_id)` where `kind = 'cash_sale'`. Reset/pgTAP now executed on this remediated tree.

## Next exact action

STOP IMPLEMENTATION. WS3 integration editor imports declared CORE-05 source SHA(s) into `batch/r5-idempotent-prepare-cash` / draft PR #53. Do not start R6.

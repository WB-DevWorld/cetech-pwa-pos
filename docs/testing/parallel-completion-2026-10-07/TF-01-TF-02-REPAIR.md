# TF-01 + TF-02 repair (WS3)

Status: **SOURCE REPAIRED + disposable PG atomic/claim proof** · hosted migration **PROPOSED NOT APPLIED** · production effects **NONE**  
Tip: `e28e02d…` (+ follow-up for `public.pos_id` RPC fix / proof script) · base `452c446` · branch `ws3/combined-candidate-2026-10-08`  
Staff-documentation impact: **NONE** (cashier UX unchanged; server refuses dual tender / false receipt success)

## Invariants now held

| ID | Before (review) | After |
| --- | --- | --- |
| TF-01 | Cash ledger + failed payment write → electronic initialize/verify succeeds | Atomic `recordVerifiedCashSale`: payment loss → **0** movements + unchanged expected cash; claim still blocks electronic (**0** provider calls) |
| TF-01 concurrent | Cash pause before append → card intent + cash movement | Cash pause before claim → card wins; cash **VALIDATION_ERROR**; **0** cash movements |
| TF-02 | `rcpt-${slice(0,8)}` + 409→ok without row → completed + NOT_FOUND | Full `rcpt-${uuid}`; 409 without same-tx row throws → attention; shared prefix → **2** rows |

## Files

- `apps/pos-web/src/core/checkout/types.ts` — `claimSaleTender` + `recordVerifiedCashSale`
- `apps/pos-web/src/core/checkout/in-memory-store.ts`
- `apps/pos-web/src/server/sales/confirm-cash.ts`
- `apps/pos-web/src/server/payments/initialize-electronic.ts`
- `apps/pos-web/src/server/sales/supabase-checkout-store.ts` — claim + atomic RPC + 409 receipt fix
- `apps/pos-web/src/server/sales/finalize-sale.ts` — full UUID id + verify durable row
- `apps/pos-web/src/server/sales/tender-receipt-integrity.test.ts`
- `supabase/migrations/20261009130000_pos_sale_tender_claims.sql` (**not** applied to hosted)
- `supabase/migrations/20261009130100_pos_sale_tender_claim_atomic_cash.sql` (**not** applied to hosted)

## Proof command

```text
pnpm exec vitest run src/server/sales/tender-receipt-integrity.test.ts
```

Result: **6/6 passed** (Node/Vitest from apps/pos-web toolchain).

Also preserved: `confirm-cash-existing-payment`, `cash-finalize-orchestration`, `payment-reservation-expiry`.

## Disposable PostgreSQL proof (local `supabase_db_cetech-pwa-pos`, rolled back)

Script: `tf-01-disposable-atomic-proof.sql`

| Check | Result |
| --- | --- |
| Force failure after movement / before valid payment | **0** cash_sale rows; expected cash unchanged; no payment |
| Happy-path atomic commit | **1** cash_sale + verified payment; expected cash +1500 |
| Opposite tender claim | unique_violation; held family unchanged; **0** cash moves |
| anon execute RPC | denied |
| Two independent `psql` clients racing cash vs electronic claim | exactly one winner row (DB PK; not process locks) |

Hosted staging was **not** migrated. Migrations remain proposed.

## Remaining

- DB-SEC-02/03 disposable probes
- Hosted apply of tender-claim + atomic-cash migrations + reviewed Preview redeploy (separate)
- Tester device acceptance unchanged (Preview remains 452c446 until reviewed)

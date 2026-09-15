# R6-REM-01 durable runtime — implementation evidence

Kind: IMPLEMENTATION_EVIDENCE
UTC: 2026-09-15T09:20:00Z
Editor: `@wbdevworld` / WS3
Remediation branch: `ws3/r6-rem-01-durable-runtime`
Authority checkpoint (parent): `f547542ca23efaf61243909c320d7dd900709188`
PR: #55 (draft; not review-ready)

This record is **not retroactive**. CORE-06 `0162e408…` still exceeded issue #25 declared paths. Those still-required files were re-examined under R6-REM-01 rather than rewritten to disguise history.

## Scope reconciliation (revalidated)

| Historical out-of-scope path | Disposition under R6-REM-01 |
| --- | --- |
| `apps/pos-web/src/core/checkout/types.ts` | STILL_REQUIRED_FOR_R6. Production `CheckoutStore` no longer carries test-fault switches. `FaultInjectingCheckoutStore` is test/in-memory only. |
| `apps/pos-web/src/core/checkout/in-memory-store.ts` | STILL_REQUIRED_FOR_R6 for local/dev and failure-injection tests. |
| `apps/pos-web/src/server/sales/compose-checkout-runtime.ts` | REPLACED_BY_DURABLE_REMEDIATION for staging/production: durable store required, no memory fallback. |
| `apps/pos-web/src/server/sales/compose-assignment-directory.ts` | REPLACED_BY_DURABLE_REMEDIATION for staging/production. |
| Remaining CORE-06 server/checkout files listed in `R6-REM-01-AUTHORITY.md` | STILL_REQUIRED_FOR_R6; not churned. |

## Durable staff assignments

- Adapter: `apps/pos-web/src/server/auth/supabase-assignment-directory.ts`
- Tables: `pos_staff_location_assignments`, `pos_staff_register_assignments`
- Lookup is actor + organization only. Browser roles/capabilities are ignored. Invalid roles and register rows outside assigned locations are dropped.
- Staging/production: require `SUPABASE_URL` + service-role + server fetch; fail closed; never memory.
- Local: memory empty directory if infrastructure is absent; durable adapter when infrastructure + fetch exist.
- Tests: `tests/integration/auth/staff-assignment-directory.test.ts` (correct org, wrong org, none, stale/invalid, network, 403).

## Durable checkout

Existing tables reused: `pos_registers`, `pos_devices`, `pos_shifts`, `pos_cash_movements`, `pos_pending_operations` (org + operation + key), `pos_outbox_events`.

Additive migration `supabase/migrations/20260915090000_pos_durable_checkout.sql`:

- `pos_pending_operations.outcome` jsonb for acknowledged/repair replay after process loss
- `pos_quote_snapshots`, `pos_checkout_sales`, `pos_checkout_payments`, `pos_checkout_receipts` (POS operational state only; not Woo masters)
- Trusted-server RLS: anon/authenticated revoked; `service_role` infrastructure grants
- `pos_shift_before_insert` / `pos_cash_before_write` allow `service_role` only with explicit cashier/actor id

Adapter: `apps/pos-web/src/server/sales/supabase-checkout-store.ts`

- Idempotency uses `pos_pending_operations` uniqueness; hash mismatch is conflict; acknowledged outcome replays
- `withLock` does not use process Maps; uniqueness/triggers provide concurrency
- Opening-float append is idempotent when the shift trigger already wrote the ledger row
- Test-fault helpers are not on this adapter

Process-restart proof: `tests/integration/sales/durable-checkout-store.test.ts` writes with one adapter instance, constructs a second instance against the same backend, and recovers quote, prepared/completed sale, payment, receipt, cash, and idempotency without a second cash effect.

pgTAP: `supabase/tests/durable_checkout.sql` (17). Combined local suite 105 PASS after fresh reset (was 88).

## Composition

BFF routes pass `createServerRestFetch()` into session, assignment, and checkout composition. Staging/production never select in-memory stores.

## Limits

Remediation source SHA: `29f2da19311c8f7d9442aaa2ee0ab9f3b46ac254` on `ws3/r6-rem-01-durable-runtime`.
Imported SHA / tested combined SHA: `3b30b29d3859539662be7896d3782667cc841732` on `batch/r6-first-real-cash-sale`.

BR-07 training deploy and the isolated staging sale are not claimed here.

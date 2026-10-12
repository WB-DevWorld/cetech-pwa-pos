# RACE-FIX-ORDER-COUNT-01

Acting human: @wbdevworld / WS3. Bridge reviewer: @Emmanuel-coder-prog / WS2 (review only).  
Base: `0e383d84f11573ca89d6533c8cb7c35d79d7b261`. Branch: `ws3/race-fix-order-count-2026-10-08`.  
Staff-documentation impact: NONE. Production effects: NONE. Bridge not installed. No training orders.

## Problem

Prepare used a global `wc_orders` COUNT delta of exactly +1. Concurrent storefront/HPOS inserts made the delta 2 and returned `INTEGRATION_UNAVAILABLE` even when this prepare created exactly one identity-bound POS order (Lane B fixture `7f384b4`). Quote used the same global COUNT equality check across `calculate_totals`.

## Behavior change

- **Prepare:** replace global COUNT with `assert_prepared_order_operation_identity` (unique recovery token + transaction/request-hash identity of the created order).
- **Quote:** replace global COUNT with same-request `woocommerce_new_order` / `woocommerce_new_order_with_order_object` observers; cleanup in `finally`. Raw SQL inserts remain an unsupported bypass.
- **Binder:** one-shot; refuse binding onto already-persisted order ids so nested saves do not inherit POS recovery metadata.

## Tests

Connected bridge suite excluding pre-existing fatal `test-ws3-generated-return-effects.php`: **1909 passed, 0 failed**.

Includes: concurrent storefront during prepare PASS; create+delete disguise PASS; old-code negative control (global delta 2) PASS; static absence of old failure string PASS.

## Rollback

Revert this commit. App rollback does not reverse Woo orders. Do not reintroduce global COUNT predicates.

## Remaining live gates

Staging #143 DDL, live cash/stock/payment, installed PWA/printer, backup/restore — separate authorizations. Profiler lane remains parked.

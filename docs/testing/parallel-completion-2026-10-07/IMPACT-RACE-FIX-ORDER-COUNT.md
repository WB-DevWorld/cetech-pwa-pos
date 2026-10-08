# RACE-FIX-ORDER-COUNT-01 impact

Problem: prepare (and quote) used global `wc_orders` COUNT deltas. Concurrent storefront/HPOS inserts change the delta and reject a valid POS prepare that created exactly one identity-bound order (Lane B fixture at 7f384b4).

Change: replace global COUNT predicates with operation-local evidence.
- Quote: same-request order-create observers (`woocommerce_new_order` / `woocommerce_new_order_with_order_object`); cleanup in finally. Does not observe raw SQL inserts.
- Prepare: prove unique recovery-token (+ transaction/hash) identity of the created order; do not require global COUNT +1.
- Binder: one-shot + refuse binding onto already-persisted order ids so nested saves do not inherit POS recovery metadata.

Staff-documentation impact: NONE. Production effects: NONE. No install.

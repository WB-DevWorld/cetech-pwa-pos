# RACE-FIX-ORDER-COUNT-01 / R144 impact

Problem: prepare (and quote) used global `wc_orders` COUNT deltas. Concurrent storefront/HPOS inserts change the delta and reject a valid POS prepare that created exactly one identity-bound order (Lane B fixture at 7f384b4).

Change: replace global COUNT predicates with operation-local evidence.
- Quote: request-local supported CRUD observers (`woocommerce_before/after_order_object_save` for id-0 creates covering auto-draft/draft/checkout-draft and refunds, plus `woocommerce_new_order*` and delete/trash hooks); cleanup in `finally`; fail closed if observation cannot be armed. Does not observe raw SQL inserts.
- Prepare: prove unique recovery-token (+ transaction/hash) identity of the created order; separately reject unexpected same-request supported creates; do not require global COUNT +1.
- Binder: one-shot on the exact owned `WC_Order` object identity (`spl_object_id`) so a nested fresh order cannot steal POS recovery metadata.

Staff-documentation impact: NONE. Production effects: NONE. No install.

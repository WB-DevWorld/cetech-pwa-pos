# R144-FINAL-CORRECTION-01

Acting human: @wbdevworld / WS3. Bridge reviewer: @Emmanuel-coder-prog / WS2.  
Base reviewed tip: `5ea92dc1258006186ba696e9d4f91f769d97aa11`. Product tip before this correction: `27e95b3565dbdf3c5487257a08042e09a51620a4`.  
Staff-documentation impact: NONE. Production effects: NONE.

## Corrections

1. **R144-3 refund family** — Guard registers `woocommerce_before/after_order_refund_object_save` and `woocommerce_delete_order_refund` alongside ordinary order hooks. Hook tests use disposable `WC_Order_Refund` (not a mislabeled `WC_Order`). Old order-only guard is a negative control that misses refund create/delete.
2. **prices_include_tax** — Owned `WC_Order` path sets `set_prices_include_tax( 'yes' === get_option( 'woocommerce_prices_include_tax' ) )` before first save, matching `wc_create_order`. Also applies IP/UA/currency helpers when available.
3. **Bootstrap filters** — `apply_filters` chains each callback return into the next callback's first argument (WordPress semantics).

## Verdict

NOT READY FOR PRODUCTION. Hosted #143 apply, bridge install, and commercial tracks remain separate decisions.

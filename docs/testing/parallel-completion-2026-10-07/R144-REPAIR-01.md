# R144-REPAIR-01

Acting human: @wbdevworld / WS3. Bridge reviewer: @Emmanuel-coder-prog / WS2 (review only).  
Reviewed head before repair: `7d75c3944d41a5990aa64004c9e96954779c9730`. Branch: `ws3/combined-candidate-2026-10-08`.  
Staff-documentation impact: NONE. Production effects: NONE. Bridge not installed. No training orders.

## Findings closed

| ID | Severity | Repair |
| --- | --- | --- |
| R144-1 | P1 | Own the intended `WC_Order` before save; one-shot binder stamps only that object (`spl_object_id`). Nested fresh orders cannot steal recovery metadata. |
| R144-2 | P1 | Request-local supported create observation during prepare (`arm_same_request_order_crud_guard` + `assert_no_unexpected_same_request_order_creates`). Reject when any create other than the intended order id is observed. Other-request storefront inserts remain allowed. Guard state is a shared object so closure mutations remain visible. |
| R144-3 | P1 | Quote `calculate_totals` observes `woocommerce_before_order_object_save` (id 0) + `woocommerce_after_order_object_save` plus delete/trash hooks so draft/auto-draft/checkout-draft and refund-like creates are covered; fail closed if observation cannot be armed; cleanup in `finally`. |

## Compatibility note

Initial persist still uses HPOS-safe CRUD property writes on the first save. When `WC_Order` is available, create uses an explicitly owned instance + `save()` instead of relying on `wc_create_order()`'s anonymous object. `wc_create_order` availability remains a readiness signal that the Woo order API is loaded.

## Tests

Commands (combined worktree):

```text
php tests/bridge/run-excl-generated.php
→ 1942 passed, 0 failed
```

Includes hook-aware production coverage in `tests/bridge/test-woo-runtime-hooks.php` (working bootstrap action dispatcher + disposable `WC_Order`). Fake-runtime mirrors: concurrent other-request storefront PASS; same-request extra create FAIL.

`tests/bridge/run.php` still includes `test-ws3-generated-return-effects.php` for CI/final qualification. Local Windows PHP fatals in that generated file are environment-dependent and are not grounds to exclude it from final CI.

## Production verdict

NOT READY FOR PRODUCTION. Remaining live gates unchanged (#143 apply, cash/stock/electronic, PWA/printer, backup/restore). Profiler Lane E parked. #115/#132 remain open.

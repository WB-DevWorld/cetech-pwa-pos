# CETECH POS Bridge

Local WordPress plugin workspace for the server-only CETECH POS commerce bridge.

BR-02 implements authenticated `POST /wp-json/cetech-pos/v1/quotes`. The bridge creates an isolated Woo cart/session/customer context, asks Woo runtime to `calculate_totals()`, normalizes the frozen v1 Quote, and restores every mutated global in `finally`. Isolated quotes are counter sales: storefront shipping and positive fees are refused because v1 Quote has no shipping/fee field. Negative Woo fee totals (B2BKing cart-total discounts applied as fees) are mapped into Quote.discount from the Woo cart, not from a copied formula. B2BKing registers those fee callbacks at request init for the authenticated staff user; the bridge re-attaches B2BKing's own `b2bking_dynamic_rule_cart_discount` callback after switching to the quote customer. `rest_post_dispatch` must not re-wrap an already-normalized ok/error envelope (WordPress `as_error()` looks for top-level code/message). Quote runtime aborts return `INTEGRATION_UNAVAILABLE` instead of an empty HTTP 500. `rest_pre_serve_request` writes this namespace's already-normalized JSON body so storefront session shutdown cannot replace a priced quote with an empty 500. It does not copy WoodMart or B2BKing formulas, create orders, reduce stock, take payment, or assert `pricingParityVerified`.

BR-01 health/permission behavior is unchanged: `GET /wp-json/cetech-pos/v1/health` still requires `cetech_pos_bridge_access`, and detection is not parity.

## Local checks

From the repository root, after PHP and GNU make are available:

```text
make -C wordpress/cetech-pos-bridge check
make -C wordpress/cetech-pos-bridge test
make -C wordpress/cetech-pos-bridge parity
```

`check` syntax-checks plugin and test PHP. `test` runs assertions against WordPress function shims and a fake Woo runtime. `parity` compares the redacted corpus. Synthetic isolation rows may match the injected runtime; live training rows are `LIVE_TRAINING_CAPTURE` or `NOT_APPLICABLE_WITH_EVIDENCE` and are skipped by this harness. Passing local tests is not a global `pricingParityVerified=true` claim and not authorization to install the plugin.

## Health semantics (detection only)

`BridgeHealth.status` describes detected dependencies only:

- WooCommerce absent → `unavailable`
- WooCommerce present but WoodMart or B2BKing not detected → `degraded`
- WooCommerce + WoodMart + B2BKing detected → `healthy`

`pricingParityVerified` remains **false** even when training R3 evidence is a gate candidate PASS. Frozen v1 `BridgeHealth` has no environment/artifact field; a global true would claim unverified environments have parity.

## Authorization

Route permission requires an authenticated WordPress user who also has the dedicated capability `cetech_pos_bridge_access`. An ordinary administrator does not pass unless that user possesses the explicit capability. Provisioning the service identity remains a separate operator/CP-04 write-safety task. The R2 W4 grant does not automatically cover an R3 plugin mutation on training.

## Out of scope here

Prepare/finalize/cancel, returns, stock or payment mutation, customer mutation, staging deployment, live credential creation, and checkout/production readiness.

# CETECH POS Bridge

Local WordPress plugin workspace for the server-only CETECH POS commerce bridge.

BR-02 implements authenticated `POST /wp-json/cetech-pos/v1/quotes`. The bridge creates an isolated Woo cart/session/customer context, asks Woo runtime to `calculate_totals()`, normalizes the frozen v1 Quote, and restores every mutated global in `finally`. Isolated quotes are counter sales: storefront shipping/fees are filtered out because v1 Quote has no shipping field and cart total must equal summed line totals. It does not copy WoodMart or B2BKing formulas, create orders, reduce stock, take payment, or assert `pricingParityVerified`.

BR-01 health/permission behavior is unchanged: `GET /wp-json/cetech-pos/v1/health` still requires `cetech_pos_bridge_access`, and detection is not parity.

## Local checks

From the repository root, after PHP and GNU make are available:

```text
make -C wordpress/cetech-pos-bridge check
make -C wordpress/cetech-pos-bridge test
make -C wordpress/cetech-pos-bridge parity
```

`check` syntax-checks plugin and test PHP. `test` runs assertions against WordPress function shims and a fake Woo runtime. `parity` compares the redacted corpus. Synthetic isolation rows may match the injected runtime; live WoodMart/B2BKing rows stay `PERMISSION_REQUIRED` until an explicit R3 training-update authorization. Passing local tests is not live-runtime proof, not a pricing-gate PASS, and not authorization to install the plugin.

## Health semantics (detection only)

`BridgeHealth.status` describes detected dependencies only:

- WooCommerce absent → `unavailable`
- WooCommerce present but WoodMart or B2BKing not detected → `degraded`
- WooCommerce + WoodMart + B2BKing detected → `healthy`

`pricingParityVerified` remains `false` until the R3 gate is actually satisfied. Detection is not compatibility certification.

## Authorization

Route permission requires an authenticated WordPress user who also has the dedicated capability `cetech_pos_bridge_access`. An ordinary administrator does not pass unless that user possesses the explicit capability. Provisioning the service identity remains a separate operator/CP-04 write-safety task. The R2 W4 grant does not automatically cover an R3 plugin mutation on training.

## Out of scope here

Prepare/finalize/cancel, returns, stock or payment mutation, customer mutation, staging deployment, live credential creation, and checkout/production readiness.

# CETECH POS Bridge

Local WordPress plugin workspace for the server-only CETECH POS commerce bridge.

BR-01 implements plugin bootstrap, a dedicated capability guard, and authenticated `GET /wp-json/cetech-pos/v1/health`. It does not install itself on training or production, create users, create Application Passwords, grant capabilities, or execute pricing.

## Local checks

From the repository root, after PHP and GNU make are available:

```text
make -C wordpress/cetech-pos-bridge check
make -C wordpress/cetech-pos-bridge test
```

`check` syntax-checks plugin and BR-01 test PHP. `test` runs assertions against WordPress function shims. Passing local/mock tests is not live-runtime proof, pricing-parity proof, or authorization to install the plugin.

## Health semantics (detection only)

`BridgeHealth.status` describes detected dependencies only:

- WooCommerce absent → `unavailable`
- WooCommerce present but WoodMart or B2BKing not detected → `degraded`
- WooCommerce + WoodMart + B2BKing detected → `healthy`

`pricingParityVerified` remains `false` for BR-01. Detection is not compatibility certification.

## Authorization

Route permission requires an authenticated WordPress user who also has the dedicated capability `cetech_pos_bridge_access`. An ordinary administrator does not pass unless that user possesses the explicit capability. Provisioning the service identity remains a separate operator/CP-04 write-safety task.

## Out of scope here

Quotes, pricing execution, prepare/finalize/cancel, returns, stock or payment mutation, customer mutation, staging deployment, and live credential creation.

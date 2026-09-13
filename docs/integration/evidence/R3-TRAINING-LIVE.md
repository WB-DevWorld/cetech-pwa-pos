# R3 training-live quote capture

Training only: `https://training.cetechbpa.com`. UTC capture `2026-09-13T17:02:00Z`. Plugin **`0.2.3-br02`**.

Authorized start tree was `7b593584cded9c587c135bbfe1eefb238bcbd177` / `0.2.1-br02`. Live quoting found storefront shipping in `WC_Cart::get_total()`, B2BKing `get_price()` returning float, and POS-counter isolation needs. Those are bounded adapter fixes on this branch; they do not copy WoodMart/B2BKing formulas.

## Artifact and host

| Item | Value |
| --- | --- |
| Training origin | `https://training.cetechbpa.com` (`wp_environment_type=staging`) |
| Installed plugin | `0.2.3-br02` active |
| Packaged zip SHA-256 | `a2f36a44d50ecd33553269cedef2a6408b0037e3a44078cf253123046d750824` |
| Installed `cetech-pos-bridge.php` SHA-256 | `41f707dc55badfccd668ea5ac68913de20fcf16809b7aa5bd26d72bcf4b645ef` |
| Service identity | `cetech-pos-bridge-svc` ID 22; `cetech_pos_bridge_access=YES`; Application Password not rotated |
| Rollback 0.1.0 | `/home/cetechtraining/backups/cetech-pos-bridge-0.1.0-br01-20260913T162937Z.tgz` |
| Rollback 0.2.1 | `/home/cetechtraining/backups/cetech-pos-bridge-0.2.1-br02-20260913T165040Z.tgz` |
| Rollback 0.2.2 | `/home/cetechtraining/backups/cetech-pos-bridge-0.2.2-br02-20260913T170126Z.tgz` |

## Fail-closed HTTP (public, no secrets)

| Request | HTTP | Code |
| --- | --- | --- |
| `GET /wp-json/cetech-pos/v1` | 200 | routes include `POST /quotes` |
| `GET /quotes` | 400 | `rest_no_route` (POST-only) |
| `POST /quotes` unauthenticated | 401 | `AUTH_REQUIRED` |
| `GET /health` unauthenticated | 401 | `AUTH_REQUIRED` |
| REST as logged-in user without capability | 403 | `FORBIDDEN` |
| `customer.kind=b2b` for a retail user | 403 | `FORBIDDEN` |

## Side effects (pre `2026-09-13T16:29:37Z` vs post-quote)

| Fingerprint | Before | After |
| --- | --- | --- |
| HPOS `wc_orders` | 51 | 51 |
| `_stock` sum | 5455 | 5455 |
| Woo webhooks | 0 | 0 |
| MailPoet | inactive | inactive |
| W1 MU `cetech-cp04-w1-mail-containment.php` | PRESENT | PRESENT |
| `mailq` | empty | empty |

No rollback executed. No orders, stock, payments, MailPoet reactivation, or production changes.

## Configured commercial facts (no formulas copied)

- WoodMart: one published `wd_woo_discounts` bulk rule; condition type all simple; **from-qty 20**; empty to-qty. Observed: qty 19 unit 40.00; qty 20 unit 38.00; qty 21 unit 40.00.
- B2BKing: 24 published `discount_percentage` `cart_total` rules; 8 groups; 2 custom roles. Guest purchasable disabled. `b2bking_b2buser=yes` classifies B2B. On P-SIMPLE-A through qty 21, B2B totals equal retail except at qty 20 where retail receives WoodMart and B2B does not.
- Tax: `woocommerce_calc_taxes=no` (CP-04). Tax-on remains NOT_APPLICABLE_WITH_EVIDENCE.

## Live quote matrix (isolated counter sale; shipping excluded)

Authoritative column is Woo `calculate_totals()` + `get_price()` after hooks in a **fresh PHP process** (WoodMart keeps an in-request `applied` list; do not compare a second quote of the same product in the same process). Bridge column is `POST /wp-json/cetech-pos/v1/quotes`. Amounts are GHS minor units.

| Case | Auth unit/sub/total | Bridge | Delta |
| --- | --- | --- | --- |
| Guest qty 1 | add_to_cart rejected | 400 VALIDATION_ERROR | REFUSAL_MATCH |
| Retail qty 1 | 4000 / 4000 / 4000 | same | 0 |
| Retail qty 5 | 4000 / 20000 / 20000 | same | 0 |
| Retail variation qty 1 | 20000 / 20000 / 20000 | same | 0 |
| Retail variation qty 2 | 20000 / 40000 / 40000 | same | 0 |
| Retail qty 19 (below 20) | 4000 / 76000 / 76000 | same | 0 |
| Retail qty 20 (at 20) | 3800 / 76000 / 76000 | same | 0 |
| Retail qty 21 (above) | 4000 / 84000 / 84000 | same | 0 |
| B2B qty 1 | 4000 / 4000 / 4000 | same | 0 |
| B2B qty 19 | 4000 / 76000 / 76000 | same | 0 |
| B2B qty 20 | 4000 / 80000 / 80000 | same | 0 |
| B2B qty 21 | 4000 / 84000 / 84000 | same | 0 |

Storefront shipping of GHS 1000.00 is **not** in v1 Quote (no shipping field; cart total must equal summed lines). Isolated quotes filter `woocommerce_cart_needs_shipping` false.

## Gate

`pricingParityVerified` remains **false**. Guest cannot be priced (configured). B2BKing cart_total percentage rules did not change this product through qty 21. Tax-on is unconfigured. R3 pricing gate is **NOT PASSED**. Review is **not** requested. PR #44 stays DRAFT. R4 not started.

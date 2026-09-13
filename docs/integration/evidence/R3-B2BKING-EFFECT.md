# R3 training live — configured B2BKing effect and concurrent HTTP

NEW ADR-012 continuation (not Pass 3 of `R3-TRAINING-LIVE-FRESHNESS.md`). Training only: `https://training.cetechbpa.com`. Start UTC `2026-09-13T17:19:45Z` (`R3-B2BKING-EFFECT-START-FRESHNESS.md`). Live HTTP matrix UTC `2026-09-13T18:06:43Z`. Concurrent UTC `2026-09-13T18:09:14Z`. Plugin **`0.2.6-br02`**.

Senior applicability was treated as authoritative. Guest purchasing, taxes, unconfigured B2BKing types, and customer-specific rules were not enabled or invented.

## Artifact and host

| Item | Value |
| --- | --- |
| Training origin | `https://training.cetechbpa.com` (`wp_environment_type=staging`) |
| Installed plugin | `0.2.6-br02` active (reconfirmed `2026-09-13T18:16:50Z`) |
| Installed `cetech-pos-bridge.php` SHA-256 | `7e0b66dfbd3ed7d0fc903bfdca47ddcae02c31e0a0fa6b9bfce4b2ff9e758df5` |
| Installed `class-woo-runtime.php` SHA-256 | `34231eba9de7b2614fc5d10fcf2e0e0633b25d62be7139276625163c8af20b33` |
| Packaged zip SHA-256 (0.2.5 tree later patched in place to 0.2.6) | `3989eb25b86b37caa39673570b3bac837644dfa9cfe0993c705470bf1f2e3573` |
| Rollback 0.2.4 | `/home/cetechtraining/backups/cetech-pos-bridge-0.2.4-br02-20260913T175500Z.tgz` |
| Rollback 0.2.5 | `/home/cetechtraining/backups/cetech-pos-bridge-0.2.5-br02-20260913T180200Z.tgz` |
| Service identity | ID 22; `cetech_pos_bridge_access=YES`; Application Password not rotated / not logged |
| W1 MU | PRESENT (`cetech-cp04-w1-mail-containment.php`); MailPoet inactive; webhooks 0 |

## Side-effect fingerprint

| Fingerprint | Pre HTTP matrix | Post concurrent (`2026-09-13T18:09:14Z`) | Reconfirm `2026-09-13T18:16:50Z` |
| --- | --- | --- | --- |
| HPOS `wc_orders` | 51 | 51 | 51 |
| `_stock` sum | 5455 | 5455 | 5455 |
| Woo webhooks | 0 | 0 | 0 |
| MailPoet | inactive | inactive | inactive |
| W1 MU | PRESENT | PRESENT | PRESENT |

Quote work created no orders, stock, payments, or mail. Persistent-cart usermeta on the two safe test identities was cleared after an earlier leak (pre-isolation) and again after Woo observe scripts that still persist storefront carts. HTTP quotes now disable `woocommerce_persistent_cart_enabled`.

## Configured B2BKing facts (no PII, no formulas copied)

24 published `b2bking_rule` posts, all `what=discount_percentage` `applies=cart_total`. Conditions are **cart-total quantity**, not cart value. Group **49242** (safe synthetic B2B user 8):

| Rule | howmuch | quantity window |
| --- | --- | --- |
| 49250 | 5 | greater 9 and smaller 20 |
| 49253 | 7 | greater 19 and smaller 50 |
| 49257 | 10 | greater 49 and smaller 100 |
| 49259 | 12 | greater 99 |

Product 49150 (`P-SIMPLE-A`) has group-49242 sale **34.00** (retail catalog 40.00). Guest purchasable remains disabled. `woocommerce_calc_taxes=no`. Currency GHS.

## Adapter notes (bounded; no copied formulas)

1. B2BKing cart-total percentage is a **negative Woo fee**. v1 Quote has no fee field; negative fees are allocated into `Quote.discount`. Positive fees still fail closed.
2. B2BKing registers the fee callback at request init for the staff user. Isolated quotes re-attach `B2bking_Dynamic_Rules::b2bking_dynamic_rule_cart_discount` after switching to the buyer.
3. HTTP `rest_post_dispatch` must not re-wrap an already-normalized ok/error envelope (`as_error()` looks for top-level code/message).
4. After a successful isolated `calculate_totals`, re-attaching the pre-quote storefront session/cart aborted PHP-FPM (empty HTTP 500). Restore now installs a fresh ephemeral session/empty cart. `rest_pre_serve_request` (priority `PHP_INT_MAX`) writes this namespace's JSON and `fastcgi_finish_request()` when available.
5. Persistent Woo carts are disabled for quotes so add_to_cart cannot accumulate on the buyer identity.

## Live HTTP matrix vs independent Woo (`delta 0`)

Authoritative column: fresh PHP process, `WC_Cart::calculate_totals()`, B2BKing fee callback attached for B2B rows. Bridge column: real HTTPS `POST /wp-json/cetech-pos/v1/quotes` to origin (Application Password never printed). Amounts GHS minor.

| Case | Auth unit/sub/disc/total | Bridge HTTP | Delta |
| --- | --- | --- | --- |
| Guest qty 1 | add_to_cart rejected | 400 VALIDATION_ERROR | REFUSAL_MATCH |
| Retail qty 1 | 4000 / 4000 / 0 / 4000 | same | 0 |
| Retail variation qty 1 | (prior isolated 20000) | 20000 / 20000 / 0 / 20000 | 0 |
| Retail variation qty 2 | | 20000 / 40000 / 0 / 40000 | 0 |
| Retail qty 19 | 4000 / 76000 / 0 / 76000 | same | 0 |
| Retail qty 20 | 3800 / 76000 / 0 / 76000 | same | 0 |
| Retail qty 21 | 3800 / 79800 / 0 / 79800 | same | 0 |
| B2B qty 1 | 3400 / 3400 / 0 / 3400 | same | 0 |
| B2B qty 9 (below 49250) | 3400 / 30600 / 0 / 30600 | same | 0 |
| B2B qty 10 (rule 49250) | 3400 / 34000 / 1700 / 32300 | same | 0 |
| B2B qty 19 (rule 49250) | 3400 / 64600 / 3230 / 61370 | same | 0 |
| B2B qty 20 (rule 49253) | 3400 / 68000 / 4760 / 63240 | same | 0 |
| B2B kind on retail user 13 | | 403 FORBIDDEN | AUTH MATCH |

## Concurrent HTTP isolation

12 rounds, two concurrent origin HTTPS POSTs per round (retail user 13 qty 10 vs B2B user 8 qty 10). Distinct cart IDs and correlation IDs.

| Metric | Value |
| --- | --- |
| ok_pairs | 12 |
| pair_fail | 0 |
| crossover | 0 |
| retail totalMinor | always 40000 |
| b2b totalMinor | always 32300 |

No customer-context crossover. Correlation pairing held.

## Gate candidate

| Task | Status |
| --- | --- |
| BR-02 | Guest REFUSAL_MATCH; retail LIVE MATCH_EXACT; variations LIVE MATCH_EXACT; concurrent LIVE VERIFIED |
| BR-03 | WoodMart qty 19/20/21 LIVE MATCH_EXACT (qty 21 unit 3800 in fresh process) |
| BR-04 | Configured cart-total rule effect LIVE MATCH_EXACT; B2B authorization 403; unconfigured types N/A WITH EVIDENCE |
| BR-05 | Overlap LIVE MATCH_EXACT; tax-on N/A WITH EVIDENCE; unexplained minor-unit differences = 0 |
| R3 pricing gate (training / this artifact) | **PASS candidate** |
| `pricingParityVerified` | **false** (frozen v1 global boolean; escalate environment-scoped representation) |
| Issue #4 | stays OPEN |
| R4 | not started |
| Production | not modified |

## `pricingParityVerified` architecture

Do not flip the detector from hard-coded false to hard-coded true. Frozen `BridgeHealth` v1.0.0 has no training-host / Woo-version / commercial-config / plugin-artifact slot. A global true would claim unverified environments have parity. Record this training PASS in evidence; keep the health field false until a later bounded contract allows an environment-specific verification record.

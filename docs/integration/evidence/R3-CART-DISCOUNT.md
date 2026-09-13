# R3 cart-discount semantics — live training evidence

NEW ADR-012 continuation (not Pass 3 of `R3-B2BKING-EFFECT-FRESHNESS.md`). Start: `R3-CART-DISCOUNT-START-FRESHNESS.md` UTC `2026-09-13T18:41:55Z`. Training only: `https://training.cetechbpa.com`. Plugin **`0.2.7-br02`**. Reviewed predecessor head `99dc34fdda4551093ff46a7935b06639371f9cdd`.

Ben’s `CHANGES_REQUESTED` on PR #44 is treated as authoritative. Frozen Quote v1 has no fee field. Negative Woo cart-level fees occupy `Quote.discount` / `QuoteLine.discount` only under [ADR-013](../../decisions/ADR/013.md). Allocation is integer largest-remainder on Woo `line_total` (after line coupons, before cart fees). No B2BKing/WoodMart formula was copied. `pricingParityVerified` remains **false**. Issue #4 stays OPEN. R4 not started. Do not merge.

## Artifact and host

| Item | Value |
| --- | --- |
| Training origin | `https://training.cetechbpa.com` (`wp_environment_type=staging`) |
| Installed plugin | `0.2.7-br02` active |
| Rollback of `0.2.6-br02` | `/home/cetechtraining/backups/cetech-pos-bridge-0.2.6-br02-20260913T185756Z.tgz` |
| Installed `cetech-pos-bridge.php` SHA-256 | `0abcfaef3d6b42a99a483ec5f5070f16dbbe79f9c3ddacbb6c34c77a738f543f` |
| Installed `class-cart-discount.php` SHA-256 | `d040319e43271e571720b6f624b73db13a6af23b647dc1991b10106e51bd4675` |
| Installed `class-money.php` SHA-256 | `b47321e3d35d4ea942b24b31cdf6bf5c15d8d5756284a94147639c32322ea836` |
| Installed `class-woo-runtime.php` SHA-256 | `289a1032bc4c8b4b009fa7d9dfad9a72b6198083790498f202a99560db7c4f0d` |
| Installed `class-quote-engine.php` SHA-256 | `645c1e9f066f6c0cffb6493501048fd9cf0e09249110c9f791f1602024e0dc75` |
| Service identity | ID 22; Application Password host-local, not printed |
| W1 MU | PRESENT; MailPoet inactive; webhooks 0 |

## Side-effect fingerprint

| Fingerprint | Pre deploy quotes `2026-09-13T18:58:23Z` | Post multi-line HTTP `2026-09-13T19:01:28Z` | Post single-line regression `2026-09-13T19:02:19Z` |
| --- | --- | --- | --- |
| HPOS `wc_orders` | 51 | 51 | 51 |
| `_stock` sum | 5455 | 5455 | 5455 |
| Woo webhooks | 0 | 0 | 0 |
| MailPoet | inactive | inactive | inactive |
| W1 MU | PRESENT | PRESENT | PRESENT |
| mail-sink lines | 0 | 0 | 0 |

No orders, stock changes, payments, mail, or webhooks. Persistent carts for identities 8/13 were empty after quotes (`persistent_cart_deleted=0`). B2BKing rules, prices, stock, groups, taxes, guest purchasing, and production were not modified.

## ADR-013 allocation base (Woo)

Independent Woo: isolated `WC_Cart::calculate_totals()` with B2BKing’s own `b2bking_dynamic_rule_cart_discount` re-attached and POS shipping/persistent-cart filters off. Bridge: origin HTTPS `POST /wp-json/cetech-pos/v1/quotes`.

Woo identity held: `get_total() = get_subtotal() - get_discount_total() + get_total_tax() + get_fee_total()`. Fees were negative, untaxed, and summed to `get_fee_total()`. Line coupons were 0. Allocation base per line = Woo `line_total` = `line_subtotal` here = remaining goods before the cart-level fee. That is the amount the negative fee sits beside.

## Live multi-line B2B (GHS minor; delta 0)

Safe products already used in R3: simple **49150**, variation **49164/49165**. B2B user 8, group 49242. Tax calc off.

### Case A — qty 3+7, rule 49250, simple added first (`2026-09-13T18:58:36Z` Woo / HTTP 200)

Fee name `Wholesaler Bulk Discount 10-19`, amount `-75.10` (untaxed). Cart qty 10.

| Source | Line | unitPriceMinor | subtotalMinor | existing line discount | allocated cart-level | final discount | taxMinor | totalMinor |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Woo | 49150 qty 3 | 3400 | 10200 | 0 | 510 | 510 | 0 | 9690 |
| Bridge | same `lineId` …aaa1 | 3400 | 10200 | 0 | 510 | 510 | 0 | 9690 |
| Woo | 49165 qty 7 | 20000 | 140000 | 0 | 7000 | 7000 | 0 | 133000 |
| Bridge | same `lineId` …aaa2 | 20000 | 140000 | 0 | 7000 | 7000 | 0 | 133000 |

| Cart | subtotalMinor | discountMinor | taxMinor | totalMinor |
| --- | ---: | ---: | ---: | ---: |
| Woo | 150200 | 7510 (fee abs; coupons 0) | 0 | 142690 |
| Bridge | 150200 | 7510 | 0 | 142690 |

Invariants: `510+7000=7510`; each line `total = subtotal - discount + tax`; cart `150200-7510+0=142690`. Leftover minor units after floors: **0** (`7510*10200` and `7510*140000` both divide `150200`).

### Case B — qty 7+3, variation added first (fresh Woo `2026-09-13T19:00:47Z` / HTTP 200)

This is **not** a silent allocator change on identical bases. Woo priced 49150 at **4000** (catalog) instead of group sale **3400** when the variation was added first. Fee `-76.00`. Bridge matched those Woo bases: allocated `7000+600=7600`. Recorded as provider add-order pricing, not ADR-013 instability. Stable-`lineId` tie-break with **identical** bases is proven in `tests/bridge/test-cart-discount.php`.

### Case C — qty 1+9, rule 49250, simple first (fresh Woo `2026-09-13T19:00:53Z` / HTTP 200)

| Line | unit | sub | allocated | final disc | total |
| --- | ---: | ---: | ---: | ---: | ---: |
| 49150 qty 1 | 3400 | 3400 | 170 | 170 | 3230 |
| 49165 qty 9 | 20000 | 180000 | 9000 | 9000 | 171000 |
| Cart | | 183400 | 9170 | | 174230 |

Delta 0. Leftover 0.

### Case D — qty 13+7, rule 49253 7% (fresh Woo `2026-09-13T19:00:58Z` / HTTP 200)

Fee name `Wholesaler Bulk 20-49`, amount `-128.94`.

| Line | unit | sub | allocated | final disc | total |
| --- | ---: | ---: | ---: | ---: | ---: |
| 49150 qty 13 | 3400 | 44200 | 3094 | 3094 | 41106 |
| 49165 qty 7 | 20000 | 140000 | 9800 | 9800 | 130200 |
| Cart | | 184200 | 12894 | | 171306 |

Delta 0. Leftover 0. `3094+9800=12894`; `184200-12894+0=171306`.

## Live remainder

Configured `discount_percentage` + `cart_total` rules (5%/7%) on these live two-decimal bases produced **exact integer per-line shares** (`leftoverMinorUnits=0`). No B2BKing rule, price, or tax was changed to force a remainder. Uneven leftover is proven in production-runtime tests (two-line D=100 on bases 1000/2000 → 33/67; three-line D=10 on 100/200/300 → 2/3/5). Classification: **NOT_APPLICABLE_WITH_EVIDENCE** for a live remainder unit on this catalog/rule set.

## Live WoodMart + B2BKing in one cart

Not applicable without mutating config. Retail qty 20+1 (`2026-09-13T19:01:04Z` / HTTP 200): WoodMart unit **3800** on 49150, variation **20000**, **no** B2BKing fee, cart 96000. B2B multi-line carts above use group sale **3400** plus a negative fee and do **not** receive WoodMart 38.00. Overlap remains two independent customer contexts (historical single-line qty 20 still MATCH on `0.2.7-br02` regression). Synthetic allocator test covers WoodMart-priced bases plus a cart-level discount.

## Single-line regression on `0.2.7-br02` (`2026-09-13T19:02:19Z`)

Guest 400 VALIDATION_ERROR. Retail 1/19/20/21, variations, B2B 1/9/10/19/20, kind mismatch 403: same minor totals as `R3-B2BKING-EFFECT.md`. Fingerprint unchanged.

## Gate

| Task | Status |
| --- | --- |
| ADR-013 / Quote v1 semantics | Recorded; structural v1.0.0 unchanged; no fee field |
| BR-02–BR-05 prior matrix | Still MATCH / REFUSAL_MATCH / N/A on `0.2.7-br02` |
| Multi-line cart-level discount | LIVE MATCH_EXACT vs Woo; sum(line.discount)=quote.discount |
| Live remainder unit | N/A WITH EVIDENCE (configured % divides these bases) |
| One-cart WoodMart+B2B | N/A WITH EVIDENCE |
| `pricingParityVerified` | **false** |
| Issue #4 | OPEN |
| R4 | not started |

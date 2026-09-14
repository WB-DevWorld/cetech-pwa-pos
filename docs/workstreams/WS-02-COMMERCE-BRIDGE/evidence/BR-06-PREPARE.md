# BR-06 / issue #18 — HPOS-safe idempotent prepare and resolve

Kind: TASK_COMPLETION evidence (WS2). Not live Woo/HPOS write evidence.

- Task: BR-06 / issue #18 (including independent-review crash-recovery remediation)
- Owner / actual implementer: @Emmanuel-coder-prog / WS2
- Source branch: `ws2/br-06-implement-hpos-safe-idempotent-prepare-and-re`
- Original implementation SHA: `ec5dc534b3c3f5ab2373e1e1783c48ce55cae4cb`
- Original evidence SHA: `230daad09af684dba92a481abce3ec8aad83cdc3`
- Remediation SHA: `4417ed867adb6962025d62184385d394083d1737`
- Stock-reservation remediation SHA: `7f3ca2df3fd0548fed7734c7b87d46ef9d68a168`
- Plugin version: `0.3.0-br06`

## Routes

- POST `/wp-json/cetech-pos/v1/sales/prepare` (`bridgePrepare`)
- GET `/wp-json/cetech-pos/v1/sales/{transactionId}` (`bridgeResolve`)

Required prepare headers: `X-Correlation-ID`, `Idempotency-Key` (distinct UUIDs).
Resolve requires `X-Correlation-ID` only. Resolve never creates a Woo order and never completes stock reservation.

## Claim design

Installation scope is WordPress `get_current_blog_id()`, else `"1"` in the unit harness. That is the real blog/install identity, not a fabricated organization UUID. The bridge is one Woo store per installation.

Bridge-owned table `{$wpdb->prefix}cetech_pos_prepare_claims` (not HPOS):

- UNIQUE `(site_scope, operation_type, idempotency_key)`
- UNIQUE `(site_scope, transaction_id)`
- Version option `cetech_pos_bridge_db_version` = `2`; `maybe_upgrade()` skips DDL when the version matches
- Durable `woo_create_entered` is persisted **before** `wc_create_order`

The INSERT is the atomic claim and is taken **before** `wc_create_order`. Woo order meta (`_cetech_pos_transaction_id`, `_cetech_pos_request_hash`, `_cetech_pos_sale_id`) is recovery evidence only. Recovery accepts an order only when **transactionId and stored request hash** both match the claim. A hash mismatch is `requires_attention` and is never adopted as PreparedSale.

Internal statuses used by BR-06: `preparing`, `prepared`, `terminal_failure`, `requires_attention`. Payment/finalize/cancel transitions are not implemented.

## Request hash

SHA-256 of the semantic `PrepareSaleRequest` with sorted object keys. Correlation ID and transport headers are excluded.

- same key + same hash → original PreparedSale / terminal failure
- same key + different hash → `IDEMPOTENCY_CONFLICT` 409 / retryable=false / contact_manager
- lock held / creator in progress → `OPERATION_IN_PROGRESS` 202 / retryable=true / resolve
- different key + same `transactionId` → `REQUIRES_ATTENTION` (no second order)

## Stock / HPOS

Prepared unpaid orders use Woo `wc_reserve_stock_for_order` when hold-stock minutes > 0.

Complete reservation proof (COUNT>0 is **not** sufficient):

1. Build the expected hold set from order items using Woo ReserveStock rules: skip non-line/qty<=0; skip `!managing_stock()` or `backorders_allowed()`; aggregate by `get_stock_managed_by_id()`.
2. Read current rows from `$wpdb->wc_reserved_stock` with prepared SQL `expires > NOW()`. Canonical table property required; fail closed if missing/unreadable. **No writes** to that table.
3. Every expected product must have a current row whose `stock_quantity` covers the required quantity. Partial set, wrong quantity, or expired hold → not proven.
4. `PreparedSale.expiresAt` is the minimum actual row expiry, not `now + woocommerce_hold_stock_minutes`.
5. `ReserveStockException` (`woocommerce_product_not_enough_stock` / `woocommerce_product_out_of_stock`) maps to STOCK_CHANGED on create. Recovery maps unclassifiable/insufficient completion to REQUIRES_ATTENTION. No new error codes. No uncaught fatal at this boundary.

Hold minutes `0` fails closed. In-memory fake sequential reserve is **not** a live Woo database PASS.

## Crash seams actually tested (supersedes "crash-after-order-create PASS")

Deterministic injected seams at the production runtime boundaries, not only after `create_prepared_order()` returns:

| Seam | Boundary | Proven outcome |
| --- | --- | --- |
| A | immediately after `wc_create_order` returns, before recovery metadata save | retry and resolve: `requires_attention`; `create_calls=1`; POS order count 1; never `stockCommitment=reserved` |
| B | after recovery metadata/order save, before `wc_reserve_stock_for_order` | resolve: `preparing` (no false reserved, no stock mutation); retry completes reservation → `prepared` / `reserved`; order count 1 |
| C | after reservation succeeds, before bridge claim PreparedSale persistence | retry and resolve recover `prepared` with proven `reserved`; order count 1 |
| Partial A/B | A reserved, process dies before B | not initially proven; resolve does not complete stock; retry completes B via official reserve and re-proves A+B; one Woo order; PreparedSale `reserved` only after both current |

Also proven: wrong request hash is not accepted as prepared; exactly one correctly identified order with proven reservation is recovered; ambiguous recovery (seam A) does not call `wc_create_order` again; only-one-row / wrong-qty / expired → not proven; complete current rows → proven; expiresAt matches proven expiry.

## Verification (canonical GNU Make in `php:8.5-cli`)

- PHP **8.5.10** NTS (built 2026-08-31)
- GNU Make **4.4.1**
- `make -C wordpress/cetech-pos-bridge check` PASS (37 files, no syntax errors)
- `make -C wordpress/cetech-pos-bridge test` **674 passed / 0 failed**
- `make -C wordpress/cetech-pos-bridge parity` **138 passed / 0 failed / 19 permission-required-skipped**
- `php wordpress/cetech-pos-bridge/tools/derive-quote-contract.php --check` PASS (`artifact matches the canonical contract`)
- `python scripts/verify_control_plane.py` PASS
- `git diff --check` clean

Last-unit race (injected competing checkout / second prepare): exactly one successful commitment.
In-memory lock interleaving is **not** a database concurrency PASS. UNIQUE indexes are the durable uniqueness evidence.

## Live / staging

No isolated effectful BR-06 rehearsal authority was present. Live HPOS/write rehearsal is **PENDING**. Do not treat local tests as production promotion.

## Unchanged

Contracts: NO. ADRs: NO. Supabase: NO. Dependencies/lockfiles: NO. Pricing semantics: NO.
`pricingParityVerified=false`. Issue #4 OPEN. BR-07 NOT STARTED. CORE-05 NOT STARTED BY WS2. R5 not complete. PR #53 code not modified by this contributor.

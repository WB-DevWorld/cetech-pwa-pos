# BR-06 / issue #18 — HPOS-safe idempotent prepare and resolve

Kind: TASK_COMPLETION evidence (WS2). Not live Woo/HPOS write evidence.

- Task: BR-06 / issue #18
- Owner / actual implementer: @Emmanuel-coder-prog / WS2
- Source branch: `ws2/br-06-implement-hpos-safe-idempotent-prepare-and-re`
- Starting main: `da86434cc471703b8309cea77cda88b7845c299b`
- R5 activation observed (not imported): `origin/batch/r5-idempotent-prepare-cash` `54a9a13e95758d9318260f90dc2ae81b93f7f840`
- Implementation SHA: `ec5dc534b3c3f5ab2373e1e1783c48ce55cae4cb`
- Plugin version: `0.3.0-br06`

## Routes

- POST `/wp-json/cetech-pos/v1/sales/prepare` (`bridgePrepare`)
- GET `/wp-json/cetech-pos/v1/sales/{transactionId}` (`bridgeResolve`)

Required prepare headers: `X-Correlation-ID`, `Idempotency-Key` (distinct UUIDs).
Resolve requires `X-Correlation-ID` only. Resolve never creates a Woo order.

## Claim design

Installation scope is WordPress `get_current_blog_id()`, else `"1"` in the unit harness. That is the real blog/install identity, not a fabricated organization UUID. The bridge is one Woo store per installation.

Bridge-owned table `{$wpdb->prefix}cetech_pos_prepare_claims` (not HPOS):

- UNIQUE `(site_scope, operation_type, idempotency_key)`
- UNIQUE `(site_scope, transaction_id)`
- Version option `cetech_pos_bridge_db_version` = `1`; `maybe_upgrade()` skips DDL when the version matches

The INSERT is the atomic claim and is taken **before** `wc_create_order`. Woo order meta (`_cetech_pos_transaction_id`, `_cetech_pos_request_hash`, `_cetech_pos_sale_id`) is recovery evidence only.

Internal statuses used by BR-06: `preparing`, `prepared`, `terminal_failure`, `requires_attention`. Payment/finalize/cancel transitions are not implemented.

## Request hash

SHA-256 of the semantic `PrepareSaleRequest` with sorted object keys. Correlation ID and transport headers are excluded.

- same key + same hash → original PreparedSale / terminal failure
- same key + different hash → `IDEMPOTENCY_CONFLICT` 409 / retryable=false / contact_manager
- lock held / creator in progress → `OPERATION_IN_PROGRESS` 202 / retryable=true / resolve
- different key + same `transactionId` → `REQUIRES_ATTENTION` (no second order)

## Stock / HPOS

Prepared unpaid orders use Woo `wc_reserve_stock_for_order` when hold-stock minutes > 0. `stockCommitment=reserved` only when that reservation path ran. Hold minutes `0` fails closed with `INTEGRATION_UNAVAILABLE` rather than inventing a TTL. Production create uses `wc_create_order` / `WC_Order` CRUD / `wc_get_orders`; it does not write legacy post tables as order storage.

## Verification (canonical GNU Make in `php:8.5-cli`)

- PHP **8.5.10** NTS (built 2026-08-31)
- GNU Make **4.4.1**
- `make -C wordpress/cetech-pos-bridge check` PASS (37 files, no syntax errors)
- `make -C wordpress/cetech-pos-bridge test` **575 passed / 0 failed**
- `make -C wordpress/cetech-pos-bridge parity` **138 passed / 0 failed / 19 permission-required-skipped**
- `php wordpress/cetech-pos-bridge/tools/derive-quote-contract.php --check` PASS (`artifact matches the canonical contract`)
- `python scripts/verify_control_plane.py` PASS
- `git diff --check` clean

Crash-after-order-create (injected seam): retry recovers the original Woo order; POS order count remains 1.
Last-unit race (injected competing checkout / second prepare): exactly one successful commitment.
In-memory lock interleaving is **not** a database concurrency PASS. UNIQUE indexes are the durable uniqueness evidence.

## Live / staging

No isolated effectful BR-06 rehearsal authority was present. Live HPOS/write rehearsal is **PENDING**. Do not treat local tests as production promotion.

## Unchanged

Contracts: NO. ADRs: NO. Supabase: NO. Dependencies/lockfiles: NO. Pricing semantics: NO.
`pricingParityVerified=false`. Issue #4 OPEN. BR-07 NOT STARTED. CORE-05 NOT STARTED BY WS2. R5 not complete.

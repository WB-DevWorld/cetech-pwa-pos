# BR-08 / issue #60 — independent commercial refund and stock-disposition

Kind: TASK_COMPLETION evidence (WS2). Not live Woo/HPOS write evidence. Not a real DB concurrency PASS. Not PaymentPort.refund. Not RT-01 orchestration. Not FE-06.

- Task: BR-08 / issue #60
- Owner / actual implementer: @Emmanuel-coder-prog / WS2
- Source branch: `ws2/br-08-implement-return-refund-stock-effects`
- Accepted starting SHA: `58d385300bfba784435448029e88f07742048cde`
- Neutral `batch/rt01-safe-returns` starting SHA observed: `58d385300bfba784435448029e88f07742048cde`
- Implementation SHA: `6a8f30dcb50564b97d7fcc3eab8fd0a9d7317ec4`
- Evidence SHA: `4c7f0b5ef29b09e9ed5b3afd30b5a668f0f4569f`
- Plugin version: `0.5.0-br08` (prior `0.4.0-br07`)
- Frozen contracts: v1.0.0 **READ-ONLY** (no `docs/contracts/**` edits)
- ADRs: **NONE** (ADR-015 consumed, not edited; issue #27 contract-gate acceptance of `58d3853…` supersedes stale candidate-status text)
- Supabase: **NONE**
- Dependencies added: **NONE**
- R7 `batch/r7-electronic-payment-reconciliation`: **NOT MODIFIED**
- Neutral RT-01 branch: **NOT MODIFIED**
- main: **NOT MODIFIED**
- WS1 FE-06: **NOT TOUCHED**
- WS3 RT-01 runtime/orchestration: **NOT TOUCHED**
- PaymentPort / Paystack: **NOT TOUCHED**
- Shared `CURRENT-WORK.md`: **NOT MODIFIED**
- `pricingParityVerified`: **false**
- Issue #4: **OPEN**
- Live Woo commercial-refund rehearsal: **PENDING**
- Live Woo stock-disposition rehearsal: **PENDING**
- Real DB concurrency: **PENDING** (deterministic in-memory interleaving only)

## Contracts

NO expected / NO observed. Canonical `docs/contracts/**` untouched.

Mechanical bridge schema derivation roots added (sorted, artifact only):

- `BridgeCommercialRefundRequest`
- `BridgeCommercialRefundState`
- `BridgeStockDispositionRequest`
- `BridgeStockDispositionState`

Existing roots remain. Shipped artifact: `wordpress/cetech-pos-bridge/schema/quote-contract.v1.json`. Canonical authority remains `docs/contracts/pos-domain.schema.json`. Derive `--check` PASS.

Wire fields follow the frozen schema (not the older prompt aliases): `returnId`, `fingerprint`, `reason`, `lineAllocations[].orderLineId` / `historicAmount`; stock `lines[].orderLineId` / `condition` / `disposition`. GET unknown → HTTP 404 `NOT_FOUND` because `BridgeCommercialRefundState` / `BridgeStockDispositionState` cannot be filled without a claim.

## DB migration

YES.

- Prior `DB_VERSION`: **4**
- Final `DB_VERSION`: **5**
- New tables:
  - `{prefix}cetech_pos_return_effect_claims`
  - `{prefix}cetech_pos_return_effect_lines`
- Unique indexes:
  - claims: `UNIQUE(site_scope, operation_type, idempotency_key)`
  - claims: `UNIQUE(site_scope, operation_type, effect_id)`
  - lines: `UNIQUE(site_scope, operation_type, effect_id, line_id)`
- Explicitly **not** added: `UNIQUE(site_scope, transaction_id, operation_type)` — multiple partial effects per original sale are legitimate
- BR-07 `cetech_pos_command_claims` uniqueness **unchanged**
- Install: version-gated `maybe_upgrade` / idempotent `dbDelta`; no DDL per request
- Persist: site_scope, operation_type (`commercial_refund` | `stock_disposition`), effect_id, idempotency_key, request_hash, transaction_id, return_request_id, sale_id, order_reference, provider_reference nullable, internal_status, request_json, outcome_json nullable, woo_effect_entered, timestamps
- No provider secrets or PII dumps
- Financial/stock dedupe evidence is not expired

## Commercial refund

- Claim design: dedicated return-effect row keyed by `(scope, commercial_refund, commercialRefundId)` and `(scope, commercial_refund, Idempotency-Key)`
- Lock: `GET_LOCK('cetech_pos_cr_' . md5(site_scope|transactionId), 0)` — independent of stock and of BR-07 finalize/cancel lock
- Historical-order binding: `transactionId` → prepare claim / PreparedSale / stored `woo_order_id`. Request `saleId` must match PreparedSale. `economicsVersion` must match PreparedSale.quoteFingerprint. Woo loaded from stored order id only. No fuzzy lookup.
- Completed original sale required: durable finalize completed + Woo paid + CETECH-owned. Prepared/cancelled/unknown fail closed.
- historicalGrandTotal proof: Woo saved grand total must equal PreparedSale/Quote total (frozen schema has no `historicalGrandTotal` field)
- Historical line economics: Woo item `_cetech_pos_quote_line_id` vs Quote snapshot subtotal/discount/tax/total/qty/product/variation
- Allocation sum: `sum(lineAllocations.historicAmount.minor) === amount.minor`; qty/amount cannot exceed remaining historic capacity
- Cumulative quantity/amount: prior pending/in_progress/completed/requires_attention claims conservatively consume capacity; `woo_effect_entered=0` + terminal_failure releases
- Woo API: `wc_create_refund` with `refund_payment=false`, `restock_items=false` (order-level exact amount; no invented tax-rate splits)
- Native identity: `woocommerce_before_order_object_save` attaches `_cetech_pos_commercial_refund_id` / tx / request hash during the refund's initial save
- Same-key same-body → previous completed state
- Same-key different-body → `IDEMPOTENCY_CONFLICT`
- Same commercialRefundId + same body + different key → one effect
- Same commercialRefundId + different body → `REQUIRES_ATTENTION`
- R1 (claim before Woo): safe retry, native refund count 1
- R3/R4 (native refund exists, outcome missing): recover same refund, count 1
- Ambiguous multiple native refunds: `requires_attention`, no second `wc_create_refund`
- Native commercial refund max count per commercialRefundId: **1** (ambiguous injected pair retained, never a third)
- Payment-provider refund call count: **0**
- Commercial-path stock mutation count: **0**

## Stock disposition

- Claim design: same return-effect table, `operation_type=stock_disposition`
- Per-line progress: `cetech_pos_return_effect_lines` statuses `not_started` → `applying` → `completed` (or `requires_attention`)
- Lock: `GET_LOCK('cetech_pos_sd_' . md5(site_scope|transactionId), 0)` — independent of commercial
- Historical-line binding: `orderLineId` → CETECH Woo line; product/variation must match Quote snapshot; stock owner via `get_stock_managed_by_id()` / `stock_managed_owner_id()`
- Official stock API: `wc_update_product_stock(..., 'increase')`
- `restock_sellable`: one increase of the stock-managed owner
- `no_automatic_restock`: durable complete, **zero** sellable increase, quantity still consumes cap
- Cumulative cap: restock_sellable + no_automatic_restock against original sold qty; unresolved/ambiguous consume conservatively
- S1 pre-effect: claim exists, lines not APPLYING → safe retry
- S3 post-increment / pre-COMPLETED: APPLYING after process loss → `requires_attention`, increment count remains 1
- Ambiguous retry: no second increment
- Multi-line A completed / B APPLYING: A never re-applied; effect `requires_attention`
- Stock increment max count: **1** per intended restock line
- Variation parent owner: increment parent, not the variation bucket

## GET

GET inspects. POST mutates/repairs.

- Commercial GET completed/pending/unknown: mutation counters unchanged; unknown is 404 `NOT_FOUND`
- Stock GET completed/ambiguous/unknown: no stock increase, no line repair, no claim rewrite

## Independence

- Commercial completed without stock command → sellable stock unchanged, payment-provider refunds = 0
- Stock completed without commercial command → native Woo refunds = 0, payment-provider refunds = 0
- Commercial + `no_automatic_restock` → one Woo refund, stock unchanged
- Commercial + `restock_sellable` → one Woo refund, one intended stock increment
- Effect IDs and Idempotency-Keys are not combined

## Verification

Canonical GNU Make: ephemeral `php:8.5-cli` (PHP **8.5.10**, GNU Make **4.4.1**).

- `make -C wordpress/cetech-pos-bridge check` PASS (**47** files)
- `make -C wordpress/cetech-pos-bridge test` **1525 passed / 0 failed**
- `make -C wordpress/cetech-pos-bridge parity` **138 passed / 0 failed / 19 skipped**
- `php wordpress/cetech-pos-bridge/tools/derive-quote-contract.php --check` PASS
- `python scripts/verify_control_plane.py` PASS
- `git diff --check` clean
- Focused BR-08 matrix: CR-01..CR-40 and SD-01..SD-30 covered in `tests/bridge/test-return-effects.php` (frozen-field mapping; CR-05 `orderReference` is not on the frozen request)
- Existing BR-06 / BR-07 regressions remain in the 1525 count

## Limitations

- No live Woo refund or restock
- No real DB concurrency
- No provider/tender money refund
- Issue #4 OPEN
- `pricingParityVerified=false`

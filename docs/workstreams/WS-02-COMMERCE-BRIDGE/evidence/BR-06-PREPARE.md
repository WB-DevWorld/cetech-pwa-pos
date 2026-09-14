# BR-06 / issue #18 — HPOS-safe idempotent prepare and resolve

Kind: TASK_COMPLETION evidence (WS2). Not live Woo/HPOS write evidence.

Earlier superseded evidence remains available in the published Git history; this file describes the current accepted candidate only.

- Task: BR-06 / issue #18 (WS3 re-review remediation of comment 5664357878)
- Owner / actual implementer: @Emmanuel-coder-prog / WS2
- Source branch: `ws2/br-06-implement-hpos-safe-idempotent-prepare-and-re`
- Prior published head: `312dcc3cebd644d5b6ea206210be437e3f001869`
- Implementation remediation SHA: `fc89e5f03e822224bb8c9c4f2c4e2f663eccce9b`
- Plugin version: `0.3.0-br06`

Preserved published history (do not rewrite): `ec5dc53` → `230daad` → `4417ed8` → `d4b0d2f` → `7f3ca2d` → `63b6d06` → `a48cca6` → `312dcc3`.

## BLOCKER 3 — GET resolve is observational

Architecture: `GET /sales/{transactionId}` → `inspect_recoverable_order()` → `inspect_recovered_order()`. That path loads the durable claim, locates the token-owned or tx+hash Woo order, and classifies `not_found` / `preparing` / `prepared` / `requires_attention`. It does not acquire the creator lock.

GET must not add/remove/update Woo items, rewrite economics, save totals, save transaction/hash/sale/quote metadata, create orders, complete reservation, alter stock, or trigger repair-oriented Woo saves.

Repair belongs only to `POST /sales/prepare` retry: `create_with_lock()` → `try_repair_order()` → `repair_recovered_order()` while the existing creator/idempotency lock is held. There is no second repair lock.

If the claim is already `STATUS_PREPARED`, GET returns the stored SaleResolution. If the claim is still preparing but Woo is already complete and reservation-proven, GET may report `prepared` observationally without persisting PreparedSale onto the claim and without Woo writes. Token-owned incomplete → `preparing`. Ambiguous → `requires_attention`. GET never mutates Woo to turn preparing into prepared.

Zero-write proof (deterministic fake, not live HPOS): deep-snapshot Woo orders, reservation rows, catalog stock, and mutation counters (`order_creates`, `item_adds`/`removes`/`updates`, `repair_saves`, `recovery_meta_writes`, `quote_snapshot_writes`, `stock_reservations`) before GET; after GET they are unchanged. Final totals equality is not used as the sole proof.

Required regressions:

- Token-only earliest crash (`after_initial_order_save`): GET `preparing`; counters/state unchanged; GET again same; no Woo mutation.
- Repeated/interleaved GET (in-memory, not a DB concurrency PASS): no creator lock, no write-repair, no order #2, no stock effect, deterministic `preparing`.
- GET then POST: GET read-only `preparing`; POST under creator lock repairs once, completes/re-proves reservation, persists PreparedSale; subsequent GET `prepared` with no mutation; Woo order count 1; provider create count 1.

## BLOCKER 4 — true initial-save and mid-snapshot recovery

Production effect sequence and honest seams:

1. Persist recovery token on the bridge claim.
2. `persist_initial_order_with_recovery_token()` — recovery token bound into the initial Woo save.
3. Seam **A** `after_initial_order_save` (before first Quote item write).
4. Quote snapshot line-by-line with bridge-private `_cetech_pos_quote_line_id` = frozen `QuoteLine.lineId` attached on `WC_Order_Item_Product` before the item's first durable save. Seam **B** `after_quote_line` fires after each durable line.
5. Seam **C** `after_quote_snapshot` (complete snapshot, before ordinary recovery metadata).
6. Ordinary tx/hash/sale/quote meta. Seam **D** `after_meta_save`.
7. `wc_reserve_stock_for_order`. Seam **E** `after_product_reserve` after each managed stock row.
8. Seam **F** `after_order_create` on the engine (after reservation, before claim PreparedSale persist).

The previous `after_wc_create` name is removed; it implied a boundary after `wc_create_order` that was actually after Quote snapshot.

Seam A proof: durable claim has recovery token; initial Woo order has the same token; zero Quote line items; GET `preparing` with zero Woo writes; POST locates the same order, applies the complete Quote snapshot, completes reservation, returns PreparedSale; `create_calls=1`; Woo order count=1.

Seam B proof (two-line Quote): line A saved, line B not, totals not final, ordinary meta absent, reservation not completed. GET `preparing` / zero writes. POST recognizes line A, does not duplicate it, adds line B once, proves exact Quote line set and economics, completes reservation, returns PreparedSale. Final: create_calls=1, order count=1, exactly two product lines, quantities/economics exact.

## Quote-snapshot reconciliation (POST lock only)

Before mutating lines, prove the order is CETECH-owned: recovery token matches the claim when present, `created_via=cetech-pos` where set, pending/unpaid/prepared-compatible status, not paid/finalized, no contradictory transaction/request identity. Existing reservation rows make incomplete-line repair unsafe → `REQUIRES_ATTENTION` (no destructive line rewrite).

Deterministic line identity is bridge-private item meta `_cetech_pos_quote_line_id` derived from authoritative Quote `lineId`. Not a wire field. Not a pricing formula. Fake/production attach it on first persist.

For each expected QuoteLine:

- A. absent → POST may add that exact line once
- B. exists once and matches → keep; do not duplicate
- C. exists once with recoverable CETECH identity but partial economics → POST may complete it to the Quote snapshot
- D. duplicate bridge line identities → `REQUIRES_ATTENTION`
- E. unexpected non-CETECH product line → `REQUIRES_ATTENTION`
- F. no safe deterministic identity → `REQUIRES_ATTENTION`
- G. identity matches but product/variation contradicts Quote → `REQUIRES_ATTENTION`

Never silently delete or overwrite an unrelated/ambiguous line. After successful POST repair the Woo product-line set equals the Quote line set exactly, then:

- saved Woo subtotal == Quote.subtotal
- saved Woo discount == Quote.discount
- saved Woo tax == Quote.tax
- saved Woo total == Quote.total

Line-by-line equality still holds. Only then may reservation / PreparedSale continue.

Ambiguous regressions: unexpected third product line, duplicate line identity, wrong product/variation, unidentifiable item → `REQUIRES_ATTENTION`, no order #2, no blind deletion, no silent overwrite, no false PreparedSale, no reservation completion. Partial recoverable identity → POST repairs under the creator lock.

## Preserved closed guarantees

High-entropy 64-hex recovery token persisted on the claim before Woo create; UNIQUE `(site_scope, woo_recovery_token)`; token bound into the initial Woo save; supported Woo recovery lookup; Quote economics written explicitly; no `calculate_totals(false)` repricing; provider tax detail only from authoritative Woo pricing snapshot; walk-in/retail/B2B context; ADR-013 allocated discount semantics; forced divergence fail-closed; complete unexpired stock-reservation proof; actual reservation expiry; `ReserveStockException` normalization; last-unit race safety; requestHash mismatch protection; duplicate recovery-token protection; same-key replay/conflict semantics; frozen schemas/contracts; `pricingParityVerified=false`.

Walk-in 1000/0/0/1000; retail 900 under `cust_retail_1`; B2B 800 under `cust_b2b_1`; discount 200/800; ADR-013 150+50 → 1800; tax 150 with provider rate `1`.

## Verification (canonical GNU Make in `php:8.5-cli`)

- PHP **8.5.10** NTS (built 2026-08-31)
- GNU Make **4.4.1**
- `make -C wordpress/cetech-pos-bridge check` PASS (37 files)
- `make -C wordpress/cetech-pos-bridge test` **1020 passed / 0 failed**
- `make -C wordpress/cetech-pos-bridge parity` **138 passed / 0 failed / 19 permission-required-skipped**
- `php wordpress/cetech-pos-bridge/tools/derive-quote-contract.php --check` PASS (`artifact matches the canonical contract`)
- `python scripts/verify_control_plane.py` PASS
- `git diff --check` clean

Live/staging HPOS write rehearsal: **PENDING**. Real DB concurrency: **PENDING**. The fake/injected harness is not live HPOS proof. Issue #4 OPEN. `pricingParityVerified=false`.

Freshness: START 2026-09-14T13:46:13Z, Pass 1 2026-09-14T13:46:58Z, Pass 2 2026-09-14T13:47:23Z. `origin/main` `da86434cc471703b8309cea77cda88b7845c299b`. `origin/batch/r5-idempotent-prepare-cash` `9b617bc9076fa0dc20913265396fc70aa0a8d6d6`. No arrivals. Classification: **FRESH_2**.

## Unchanged

Contracts: NO. Bridge DB schema/version: NO (remains v3). ADRs: NO. Supabase: NO. Dependencies/lockfiles: NO. Pricing formulas copied: NO.
BR-07 NOT STARTED. CORE-05 NOT STARTED BY WS2. R5 not complete. PR #53 code not modified by this contributor. `batch/r5-idempotent-prepare-cash` not edited.

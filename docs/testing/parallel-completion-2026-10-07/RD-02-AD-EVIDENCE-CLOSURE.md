# RD-02 A+D evidence closure

Status: **CLOSED (one-sale cap consumed)**  
Cutoff: 2026-10-08T17:12Z (root read-only POS) + Cursor installer/Woo reconcile  
Acting: `@wbdevworld` / WS3  
Staff-documentation impact: **NONE**  
Production effects: **NONE**  
Verdict: **NOT READY FOR PRODUCTION**  
Cap: **do not repeat A+D sale**

## Mixed-stack identity

| Layer | Value |
| --- | --- |
| App (shared tester) | `dpl_nxWGrSLqaLBGNNN683QjdixNBjF6` / application `816e0bb6963aff760609a3c7e4817e603c4ffdf0` |
| Not candidate freeze | not `f0feb44…` Preview (checkout path code unchanged vs freeze; run supports common path + reported bridge) |
| Bridge tree | `fc8f2d05e7fe36001c3e9265cad0b4754417fedd` |
| Product tip | `ab5c7e1f3849ff65100a84058e92f8b281a14be2` |
| Live bridge main SHA-256 | `63094753eb380b57c1e7e6db1a172ead3a295112e538d6722ffb4325f7ff58ab` |
| Live bridge runtime SHA-256 | `89e4461c3ff7e7ef2dc6ff525751f799f4b92604d655880e9840256128deb76c` |
| Identity method on disk | `assert_prepared_order_operation_identity` count **2** |
| Version header | still `0.6.0-stg05` — **not** generation proof |

## POS authoritative records (root read-only, staging project `iegxncvpsyaitkpzywcr`, 17:10–17:12Z)

| Record | Observed |
| --- | --- |
| Transaction | `33326bbc-1dd7-4582-8409-ea434942d8db` |
| POS sale | `sale-50317`; completed; `commercial_confirmed=true` |
| Context | org_a / loc_a1 / reg_a / shift `e82217c6-3e20-4131-abbb-1b6668e2622b` |
| Payment | Exactly one verified cash payment, 2900 minor GHS; received 2900; `verification_source` cash_ledger |
| Cash movement | Exactly one `cash_sale` +2900 minor GHS, same transaction and shift |
| Receipt | Exactly one `rcpt-33326bbc`; total 2900 minor GHS; one line; `orderReference` 50317 |
| Durable operations | One `sale.prepare`, one `payment.cash`, one `sale.finalize`; all acknowledged; no `last_error_code` |
| Related op window (shift, 16:45–17:10Z) | Only those three operations |

No duplicate POS effects found for this transaction. This is **one successful sale**, not universal exactly-once / last-unit / speed proof.

## Browser / BFF path (Cursor; not independently re-read by root)

### False start (aborted before send) — separate from commercial identity

| Field | Value |
| --- | --- |
| Mode | Client threw before `fetch` sent prepare |
| UI | `prepare_failed` · “Sale couldn't be started” · “previous sale attempt was not found” · Keep cart |
| Server order | **none** created |
| Disposition | Cart kept; discarded as non-commercial false start |

### Actual prepare (server reached) + response-loss

| Field | Value |
| --- | --- |
| Mode | `complete-then-drop`: await prepare response, then discard body (`TypeError: Failed to fetch`) |
| HTTP | **200** |
| Body (sanitized snip) | `transactionId` `33326bbc-…` · `saleId` `sale-50317` · `orderReference` `50317` · total 2900 GHS · `status` prepared · `stockCommitment` reserved · `preparedAt` 2026-10-08T16:56:46Z |
| Correlation prefix | `67fb2222-ef93-4…` |
| Drop at (client) | 2026-10-08T16:56:49.599Z |
| UI after drop | uncertain / resolving → **Choose payment** (no second prepare key) |
| Cash | Exact 29.00 → Confirm cash → finalize |
| UI complete | `data-checkout-stage=receipt_ready` · Order `#50317` · Receipt `POS-50317` · Cash · Total GHS 29.00 · Register A |
| Request latency / cashier timings | **NOT CAPTURED** in retained browser trace (no Server-Timing / resource timing retained). DB `date_*` differences are **not** a substitute. |

Journal/cart: sale completed and cart cleared for new sale UI; no uncertainty deleted from this report.

## Woo reconcile (read-only WP-CLI / `wc_get_order`, training)

| Field | Value |
| --- | --- |
| Order | **50317** |
| Status | **processing** |
| Total / currency | **29.00** / **GHS** |
| Line | product **49111** qty **1** total 29.00 |
| `date_created` | 2026-10-08T16:56:46+00:00 |
| `date_paid` | 2026-10-08T16:58:31+00:00 |
| `date_modified` | 2026-10-08T16:59:06+00:00 |
| Woo `transaction_id` | `786afd45-4f50-45d7-bea1-cd002ccd0017` |
| POS meta | `_cetech_pos_transaction_id=33326bbc-1dd7-4582-8409-ea434942d8db` |
| Extra identity-linked orders | **0** |
| Product 49111 `_stock` | **3** (pre-sale observed **4**; Δ −1) |
| `manage_stock` / `_stock_status` | yes / instock |
| `payment_method` / title | empty on Woo object (POS cash verified in Supabase cash_ledger) |

Unrelated global shop_order counts are **not** this transaction's invariant.

## Training bridge install postconditions

| Check | Result |
| --- | --- |
| Exchange | `rename_exchange.py --signed-off` PLUGIN ↔ staged after FPM idle (`fpm_status_read.py --signed-off`) |
| Exchange log | `/home/cetechtraining/tmp/rd02-bridge-exchange-20261008b.log` (drain reads 1–3 busy/queue; 4 idle; hashes + identity count 2) |
| `.maintenance` | **absent** |
| Timers | `cetech-training-wp-cron.timer` + `mailpoet` **active** |
| Rollback backup | `/home/cetechtraining/backups/cetech-pos-bridge-0.6.0-stg05-pre-ab5c7e1-20261008T164117Z.tgz` SHA-256 `c20239f1245a8697321a4f6ae89bd859ec935e695bfe706ae9c8793db01bfc8f` |

### Loaded-generation / FPM proof (honest limits)

| Claim | Status |
| --- | --- |
| Disk hashes + identity method string after exchange | **VERIFIED** (see hashes above) |
| Native PHP-FPM loaded-generation proof at cutover (SAPI/PID, reflected production method signatures, allowlisted opcode transition bound to this exchange) | **UNVERIFIED** — not captured for this product-tip install |
| Existing `cetech-timing-release/state.json` | Belongs to prior task `REST-INIT-ATTRIBUTION-01` (timing diagnostic), **not** this bridge install; must not be reused as proof |
| Existing `cetech-timing-verifier.php` | Reflects quote-timing helper classes / frozen timing baseline — **wrong package** for production bridge identity method; correctly not used |
| Historical gap | Recorded as **UNVERIFIED**; not inferred from the completed sale |
| Current-generation native FPM reflection for `assert_prepared_order_operation_identity` | **No fixed operator probe present** on host for that method. Narrow new probe would need explicit operator scope; not manufactured here |

## Publish note

Prior published tip `6a7dc31` still said A+D/install stopped. This closure supersedes that progress for installer + sale facts without authorizing another sale.

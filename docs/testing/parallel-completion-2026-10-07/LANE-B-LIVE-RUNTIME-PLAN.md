# Lane B — live cash / stock / payment fixture plan (NOT EXECUTED)

Status: **PLAN ONLY**. No live commerce effects authorized or performed in this lane.
Baseline under test: application SHA recorded in `LANE-B-RESULT.md`.
Host target (when separately authorized): training only — never production.

## Purpose

One concrete, reviewable rehearsal that proves cash prepare → cash tender → finalize
recovery identity on live fixtures, without Lane B executing those effects.

## Preconditions (must all be CURRENT_PASS at execution time)

1. Explicit operator write authorization for training order/stock/tender effects (historical grants do not count).
2. Training W1 containment and W4 identity still CURRENT_PASS; secrets off git / not pasted into agent prompts.
3. Bridge build exposing `POST /sales/prepare`, finalize, and sale resolve (not quote-only).
4. Stock-managed simple product with known `_stock` before-state (do not use manage_stock=NO catalog).
5. Synthetic walk-in customer only (`*.training.invalid` if Woo requires an email).
6. Open shift on seed cashier/register; one Idempotency-Key UUID per command mint at execution.
7. **WS2 global order-count race** either fixed on the installed bridge or accepted as a known fail-closed risk during the rehearsal window (see `LANE-B-RESULT.md`).

## Fixture identity (fill at execution; do not reuse harness UUIDs)

| Slot | Value at execution |
| --- | --- |
| Organization / location / register / device | |
| Cashier actor | |
| Product id / SKU / qty=1 | |
| Quote id + fingerprint | |
| `transactionId` | |
| prepare `Idempotency-Key` | |
| cash `Idempotency-Key` | |
| finalize `Idempotency-Key` | |
| Correlation ids | |

## Exact step sequence (authorized operator only)

1. **Before fingerprints (read-only):** HPOS order count (or agreed query), product `_stock`, hold-stock minutes, plugin version, no production host.
2. **Quote:** BFF authoritative quote; persist snapshot; POS must not invent unit price.
3. **Prepare:** one prepare with recorded key/body → expect unpaid Woo order + reserved/proven commitment; record `saleId` / order reference.
4. **Prepare replay:** same key + same body → same `saleId`; order-count delta +0 vs step 3.
5. **Prepare conflict:** same key + altered body → `IDEMPOTENCY_CONFLICT`; still one POS order.
6. **Lost-response recovery:** drop/ignore prepare HTTP once; `SalesPort.resolve` / GET sale returns original prepared sale; no second order; journal keeps original transaction/idempotency identity.
7. **Cash confirm:** one cash ledger/tender for prepared total; duplicate cash same key → same `paymentId`.
8. **Finalize:** one commercial completion + one intended stock effect; duplicate finalize → no second payment_complete/stock effect.
9. **Reload/remount:** reopen Sell / Needs attention with same register scope; unresolved attempt (if any) restores original transaction + keys; do **not** delete journal/attention rows.
10. **After fingerprints:** order delta = +1 POS order; stock delta = exactly the one intended effect; one receipt id; preserve all evidence rows.

## Explicit non-actions for this plan

- No Paystack / MoMo / card initialize or charge
- No return / refund / restock
- No production host, no secret rotation, no plugin install unless separately granted
- No deletion of attention, journal, pending-operation, or HPOS rows to “clean up”
- No blind Pay retry with a new prepare key while an attempt is unresolved

## Pass / fail bar

PASS only if all of: exactly one Woo POS order for the transaction, one cash tender, one finalize stock/payment effect, stable recovery identity across lost response and remount, and fingerprints match the intended deltas.
FAIL / STOP on second order, second tender, unexplained stock move, production contact, or unresolved money without attention evidence.

## Authority gate

Execution requires a fresh CURRENT-WORK / operator note naming the human authorizer, training host, product id, and write scope. Until that note exists, this file remains a plan.

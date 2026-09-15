# R6 isolated staging cash-sale rehearsal

Status: **EXECUTED 2026-09-15** on training. Evidence: `docs/integration/evidence/R6-TRAINING-REAL-SALE.md`. Production remains unauthorized.

Host: `https://training.cetechbpa.com` only. Combined implementation after timestamp repair: `c6a9318222f11c8b7a150c8bb558749fcf845f76` on `batch/r6-first-real-cash-sale` (later docs-only commits do not change implementation).

Freshness snapshot: `docs/integration/evidence/R6-CP04-CHRONOLOGY.md` (2026-09-15). W1 containment and W4 identity/health are `CURRENT_PASS`. Training plugin is still **`0.2.7-br02`** with only `/health` and `/quotes` — BR-07 sale routes are **DRIFTED**.

Do not start until:

1. W1 containment is still `CURRENT_PASS` at execution time (re-check; do not send a new synthetic email unless separately authorized).
2. W4 identity is still `CURRENT_PASS` without rotating secrets: plugin active, user `cetech-pos-bridge-svc` ID 22 subscriber, `cetech_pos_bridge_access` only, anonymous health 401, authenticated health 200.
3. Training plugin exposes BR-07 `POST /sales/prepare`, `POST /sales/finalize`, and sale resolve. That requires installing/activating the exact R6 `cetech-pos-bridge` `0.4.0-br07` artifact **only after operator grant**, with a rollback tarball, then re-checking containment. Do not invent a sale against quote-only plugin routes.
4. An operator records explicit order/stock/tender-write authorization for this rehearsal. Historical W1/W4 grants do not count. The W2 map recorded `Order writes authorized: NO`.

If any safety prerequisite has drifted, stop. Do not send mail, charge money, or touch production.

## Synthetic actors

| Role | Identity | Notes |
| --- | --- | --- |
| POS cashier | Seed actor `cashier_a` / org `org_a` / location `loc_a1` / register `reg_a` (historical Auth email `cashier.a.synthetic@example.test`) | POS operations identity. Not a Woo administrator. Open one valid shift before prepare. |
| Customer | POS `customer.kind=walk-in`. If Woo requires a billing email, use `r6-cash-sale@training.invalid` only | No real customer email/phone. Do not reuse R3 quote users 8/13 for the commercial sale. |
| Bridge service | `cetech-pos-bridge-svc` ID 22, Application Password label `cetech-pos-bff-r2-health` | CURRENT_PASS 2026-09-15. Do not recreate. Secret stays off git. Workstation `.env.local` was ABSENT; restore server-only env without printing the secret. |

B2B live is **out of scope** for this first rehearsal (WoodMart/B2BKing rules stay untouched).

## Product

Do not change WoodMart/B2BKing configuration. Use a **stock-managed** simple product so the rehearsal can show one intended stock effect.

R3 quote product `49150` (price 40, historically called `P-SIMPLE-A`) is **not** used: 2026-09-15 WP-CLI showed `manage_stock=NO`, empty SKU. A sale of 49150 would not provide a `_stock` fingerprint.

| Field | Planned value | Freshness 2026-09-15 |
| --- | --- | --- |
| Woo product ID | `49111` | CURRENT_PASS simple, published |
| SKU | `49111` | CURRENT_PASS |
| Manage-stock | YES | CURRENT_PASS |
| Stock quantity | **6** | CURRENT_PASS; expected after qty-1 completion: **5**, unless hold-stock only reserves |
| Price | 29 GHS | CURRENT_PASS catalog price; re-quote immediately before prepare |
| Quantity | **1** (below WoodMart bulk-from-qty 20) | planned |
| Location/outlet | POS `loc_a1` / `reg_a`; global `woocommerce_manage_stock=yes`; hold-stock 60 minutes; VitePOS `stockable=N` historically | do not claim VitePOS multi-stock |

Before-state to recapture at execution: product ID, SKU, manage-stock, `_stock`, `_backorders`, prices, `woocommerce_hold_stock_minutes`.

## Expected commercial effect

```text
exactly 1 Woo order
exactly 1 intended stock effect
exactly 1 cash tender/finalization
exactly 1 POS completed sale
exactly 1 receipt
```

No Paystack, MoMo, card, or other electronic payment. No return/refund.

Intended stock effect: BR-07/CORE-06 prepare reservation and/or payment-complete reduction. Record the actual `_stock` delta (6 → ?). Do not assume a formula. Pass only if the observed delta is exactly the one intended effect (no second decrement).

## Recovery / idempotency proof

Record new UUIDs at execution (do not reuse harness fixtures).

| Step | Check |
| --- | --- |
| Quote | Authoritative BFF quote from training bridge; persist snapshot; POS does not invent unit price |
| Prepare | Stable `Idempotency-Key`; one unpaid Woo order |
| Prepare retry (same key, same body) | Same `saleId` / Woo order; HPOS count +0 vs first prepare |
| Prepare conflict (same key, different body) | `IDEMPOTENCY_CONFLICT`; still one order |
| Lost prepare HTTP | `SalesPort.resolve` / GET sale returns the existing prepared sale; no second order |
| Cash | Stable cash attempt identity; one cash ledger/tender |
| Duplicate cash | No second tender |
| Finalize | One commercial completion / one intended stock effect |
| Duplicate finalize | No second stock/payment-complete effect |
| Lost finalize HTTP | payment/sale resolve returns the existing completed transaction |
| Receipt / history | Same receipt id and original sale id |

## Side-effect containment (required before execution)

Re-verify, without sending a new synthetic email unless separately authorized:

- W1 MU `cetech-cp04-w1-mail-containment.php` still loaded
- MailPoet still inactive
- `admin_email` and Woo new-order/stock notify destinations still `training.invalid`
- Woo webhook count still 0
- mail queue empty
- `woo-paystack` still inactive
- `cetech_de_enable_vitepos_adapter` still `0`
- Synthetic identities cannot notify real customers

## Before / after fingerprints

| Fingerprint | 2026-09-15 preflight |
| --- | --- |
| HPOS order count | 51 |
| Product `49111` stock | 6 |
| Woo webhook count | 0 |
| Service-user role/caps | subscriber; bridge YES; manage_options/manage_woocommerce NO |
| MailPoet | inactive 5.37.0 |
| W1 MU | PRESENT |
| mail queue | empty |
| Plugin version / routes | Installed **`0.4.0-br07`** with prepare/finalize. Rollback tarball retained. |
| POS transaction / sale / receipt / Woo order ids | capture at execution |

Pass only if deltas match the expected commercial effect and containment holds.

## Cleanup

- **Keep** the synthetic Woo order, POS sale, cash row, and receipt as the audit trail. Do not delete HPOS or POS rows to hide the test.
- **Do not** automatically erase the order.
- Restore stock **only if** the operator requests it after evidence is recorded, via a normal Woo stock adjustment that cites this rehearsal (6 after rollback if the live effect was −1). Never raw-SQL the order away.
- Do not roll back W1 mail containment or W4 identity as part of this test.
- If a BR-07 plugin install was authorized, keep the rollback tarball; do not auto-revert the plugin after a green sale unless the operator says so.

## Execution topology (when authorized)

Local/authorized BFF with durable checkout store (staging/production must not use ephemeral in-memory checkout). Server-only `BRIDGE_BASE_URL` / `BRIDGE_USERNAME` / `BRIDGE_APPLICATION_PASSWORD`. No `NEXT_PUBLIC_BRIDGE_*`. Local Supabase seed for staff/register/shift. Training WordPress for quote/prepare/finalize.

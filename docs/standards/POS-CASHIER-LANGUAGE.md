# POS cashier language

Owner: WS1 presentation, with WS3 owning this standards path. Controlling contracts and ADRs outrank this document. This is cashier-facing copy, not a contract change.

Normal cashier and manager screens must tell the operator:

1. What happened.
2. What it means operationally.
3. What to do next.

Internal engineering detail belongs in logs, data attributes, diagnostics, or an explicit **Technical details** section.

## Approved terminology

| Concept | Cashier language |
| --- | --- |
| Current cart / sale | Sale or Cart. Never `Rev N`. |
| Confirmed price | Price ready |
| Quote totals | Subtotal, Discount, Tax, Total |
| Catalog | Products, product list, refresh products |
| Customer types | Walk-in, Retail, Wholesale |
| Assigned till | Register |
| Working period | Shift. Start shift / Shift open / End shift |
| Tender | Payment method |
| Present payment | Start payment |
| Payment uncertainty | Checking payment status… Keep **Do not charge again.** |
| Store Health | System status |
| Fix App | Troubleshoot |
| Needs attention | View issues / Attention |
| Historical sale | Original sale |
| Preview / execute return | Review return / Complete return |
| Blind cash count | Count drawer cash |
| X / Z reports | View shift summary (X report) / End-of-shift report (Z report) |

Prefer short sentences, ordinary retail language, and one word for one concept.

## Prohibited on normal UI

Do not routinely expose:

`quote`, `revision` / `Rev`, `provider`, `provider callback`, `server-owned`, `mounted source`, `projection`, `catalog projection`, `API contract`, `local schema`, `bridge`, `WooCommerce`, `B2BKing`, `WoodMart`, `INTEGRATION_UNAVAILABLE`, `IndexedDB`, `WS3`, `seam`, `idempotency`, `payment identity`, `tender`, `reconciling`, `commercial refund`, `stock disposition`, `tenant policy`, raw UUIDs, or internal source IDs.

These may appear only under **Technical details**, in logs, or in data attributes used for diagnostics.

Do not restore synthetic staging customers such as Ada Boateng or Buildworks Ltd.

## Error-writing pattern

Use a presentation mapper (`toCashierError`, `describeQuoteFailure`, `describePaymentState`). Never print a raw `ApiErrorCode` as the primary message. Preserve the raw code and message for diagnostics.

Pattern:

- What happened: ordinary language.
- What it means: operational consequence.
- What to do: a concrete next step.

Do not infer live stock from stale local product cards. Only say **out of stock** when authoritative provider or quote information proves it.

## Examples

| Internal / previous | Cashier-facing |
| --- | --- |
| Cart · Rev 1 | Sale |
| Price confirmed / Quoted total | Price ready / Total |
| INTEGRATION_UNAVAILABLE / WooCommerce rejected a quote line | One or more items can't be sold right now. Remove unavailable items or refresh products and try again. |
| SHIFT_REQUIRED | Start your shift before taking payment. |
| QUOTE_EXPIRED | Price needs to be checked again. |
| AUTH_REQUIRED | Your session ended. Sign in again. |
| PAYMENT_PENDING | Payment is still being checked. Do not charge again. |
| Rebuild catalog / Catalog refreshed. 155 items. Availability fresh. | Refresh products / Products updated — 155 items ready. |
| Blind cash count | Count drawer cash. Enter what you counted. Expected cash will be shown after you finish. |
| Resolve this payment identity. Do not present a replacement tender. | We're checking this payment. Do not start another payment. |
| OPERATIONAL POS RECEIPT | Receipt |
| Store Health | System status |

Unavailable-item copy:

- Authoritative out-of-stock, known item: `<Product> is out of stock. Remove it to continue.`
- Reason unknown, single cart line: `<Product> can't be sold right now. Remove it or refresh products and try again.`
- Offending line not safely known: `One or more items can't be sold right now. Remove unavailable items or refresh products and try again.`

Payment uncertainty must remain strong: **Do not charge again.** Do not collapse distinct pending/reconciling states into a generic retry.

## Technical details exception

A collapsible **Technical details** block may show build SHA, API contract version, local schema, health source IDs, raw error code, correlation ID, device UUID, and bridge/provider detection. Cashiers must not need this block to finish a sale.

## Accessibility

Keep `role="status"` / `role="alert"` and `aria-live` on operational banners. Map enum labels to words; do not announce raw underscore statuses. Desktop and mobile wording must stay consistent. Do not hide legally useful tax rows for aesthetics.

## Safety

This standard does not move pricing or stock authority into the frontend, weaken authentication, CSRF, RLS, device authorization, payment uncertainty, idempotency, register/shift authority, or recovery safeguards, or alter frozen contracts for wording.

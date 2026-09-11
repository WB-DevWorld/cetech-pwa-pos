# Cursor Handoff — Preserve the Approved CETECH POS Frontend

## Mission

Convert this browser prototype into the real Next.js/React/TypeScript PWA and connect production ports/adapters. **Do not redesign the frontend from scratch.** Treat the preview as approved product design and behavior unless the product owner explicitly changes it.

## PRESERVE

- Primary navigation: Sell, Orders, Customers, Returns, Register, Store Health, Needs attention; compact manager Settings.
- Sell as the default operational screen.
- Scan → Sell → Pay → Print cashier mental model.
- Desktop/tablet product + cart split view.
- Phone-specific full-width product flow + sticky cart bar + full-screen cart/payment.
- Semantic design tokens and responsive breakpoints.
- Component names/responsibilities where practical.
- Merchant-facing copy and progressive disclosure.
- Walk-in as default customer; highly visible WHOLESALE customer context.
- Barcode strings with leading zero preservation.
- Exact variation barcode behavior and repeated-scan quantity increment.
- Direct quantity entry for wholesale quantities.
- Cart revision and stale/out-of-order quote protection.
- Whole-cart authoritative quote semantics.
- Pay eligibility with human-readable disabled reason.
- Preparing/checking/order-reserved/payment/pending/reconciling/finalizing/complete state distinctions.
- “Do not charge again” pending-payment safety message.
- Price-changed and stock-changed review before payment.
- Immutable operational receipt layout and statutory-document disclaimer.
- Returns reason + condition + manager approval + separate stock disposition.
- Register opening float, cash movement, X report, blind close, variance and Z report semantics.
- Store Health and Needs attention as visible operational surfaces.
- Offline truthfulness: cart/search okay; final checkout/refund/electronic payment online-required for launch.
- Update Ready safe-point logic, passive second-tab semantics, migration blocked state and non-destructive Fix App flow.
- Accessibility: semantic controls, focus, keyboard, labels, status text, touch targets, reduced motion.

## REPLACE

Delete/replace these preview-only implementations:

- `CetechMockData` fictional products/customers/orders.
- `CetechAdapters` mock adapters and fake delays/outcomes.
- Demo Controls and all fault-injection UI shipped for preview review.
- Preview string-template rendering.
- Preview event delegation.
- `localStorage` preview persistence.
- Fake order/receipt counters.
- Fake service health toggles.
- Fake update/migration/passive-tab switches.

Do not replace the product behavior these mocks demonstrate.

## CONNECT

- `CatalogPort` → real Dexie local catalog adapter; synchronize server projection from Woo during transition.
- `PricingPort` → Next BFF authoritative whole-cart quote → CETECH POS Bridge → Woo runtime (Woo + WoodMart + B2BKing).
- `CustomerPort` → real server-side customer lookup with minimal PII on device.
- `SalesPort` → prepare/resolve/cancel, transaction UUID + idempotency + authoritative quote/stock revalidation.
- `PaymentPort` → cash + Paystack/approved external electronic adapters during transition; later MoneyMove.
- `RegisterPort` → Supabase/POS operational API for register/shift/cash; later independent POS backend.
- `ReturnPort` → authoritative historical refund preview/execution + payment refund/disposition orchestration.
- `ReceiptPort` → immutable receipt snapshots and production reprint.
- `HealthPort` → real Woo/pricing/catalog/payment/local/POS health aggregation.
- `SyncPort` → catalog projection sync, webhook acceleration, periodic reconciliation and manual rebuild.
- `IdentityPort` → temporary Supabase Auth, later AccessLobby/OIDC.
- `CartDraftStore` / `OperationJournal` → Dexie IndexedDB with versioned non-destructive migrations.

## STRICT ANTI-REWRITE RULES

1. Do not let React components call WooCommerce, B2BKing, WoodMart, Paystack or Supabase privileged APIs directly.
2. Do not encode WoodMart or B2BKing rules into browser TypeScript.
3. Do not make projected catalog/display price the checkout price.
4. Do not remove cart revisions or stale-response protection.
5. Do not turn payment into one generic `loading` boolean.
6. Do not offer blind retry when sale/payment result is ambiguous; resolve reality first.
7. Do not clear cart/IndexedDB on connectivity loss or ordinary update.
8. Do not implement routine “clear all storage” as Fix App.
9. Do not hide Store Health/Needs attention in developer-only logs.
10. Do not restock every refund automatically.
11. Do not rewrite old receipts from current product/pricing data.
12. Do not derive authoritative register expected cash in React.
13. Do not squeeze desktop layout onto a phone.
14. Do not turn Settings into a giant provider-specific admin console.
15. Do not add infrastructure terminology to cashier copy.
16. Do not change visual hierarchy merely because a component library has different defaults.
17. Do not introduce split tender/full offline settlement until the production plan explicitly enables those capabilities.
18. Do not claim a normal POS printout is a statutory Ghana invoice without the approved compliance integration.

## Required implementation order for frontend conversion

1. Import `frontend-contracts.ts` concepts into `src/core` and freeze them before provider code.
2. Convert semantic token/CSS foundation.
3. Convert AppShell + responsive navigation.
4. Convert Login/Register gating.
5. Convert Sell + local catalog + barcode + durable cart.
6. Convert quote state machine and centralized checkout eligibility.
7. Convert prepare/resolve transaction flow.
8. Convert cash, then electronic payment state machine.
9. Convert immutable receipt/reprint.
10. Convert Orders/Returns.
11. Convert Register/shift/cash reports.
12. Convert Store Health/Attention/recovery.
13. Convert PWA update/migration/multi-tab coordination.
14. Delete Demo Controls only after equivalent automated failure tests exist.

## Acceptance condition

Cursor should be able to compare the production Next.js build side-by-side with this preview and find the same information architecture, primary screen layouts, copy, interaction states and responsive behavior. Provider changes should be visible mainly in data correctness and real operations—not in a redesigned cashier experience.

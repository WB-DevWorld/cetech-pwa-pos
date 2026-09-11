# Frontend implementation baseline

Preserve reference/frontend-approved/artifact as the design authority; its contracts are historical handoff inputs, superseded by docs/contracts where recorded. Build in apps/pos-web. Sell follows sign-in/open-register; phone uses full-screen cart/payment and sticky summary; desktop/tablet use product/cart split view. Preserve semantic tokens, copy, touch targets, keyboard/focus and reduced motion.

Each material cart change increments revision, saves draft, invalidates quote and blocks Pay until a matching authoritative response is accepted. Customer change and new sale reset commercial context as specified. Barcodes are strings, exact variation scans bypass parent chooser, repeated scans increment quantity. Decimal quantity strings convert only at UI boundaries with explicit validation; never use float pricing rules.

Separate quote state, payment state and sale state. A verified tender can coexist with an unfinalized sale. Pending payment says 'do not charge again'; resolve before any new attempt. Receipts come from immutable snapshots; PrintPort reports dialog handoff, never unproven physical print success.

Orders/returns use historic economics; register uses server expected cash and blind count; Store Health/Needs Attention remain visible. Offline browsing/drafts work; authoritative checkout/refund/close do not. WS3 owns local schema, service worker and update activation; WS1 owns their UX.

Map every demo outage/stock/quote/payment/update/recovery scenario to a test before deleting demo controls. Fictional accounts, counters, mock payments and localStorage preview state must never ship as production implementations.

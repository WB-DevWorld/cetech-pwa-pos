# CETECH POS — Frontend Decision Ledger

Status: controlling frontend decisions for this prototype and its Next.js conversion.

## Source audit

The frontend was reconciled from the current frontend master prompt and the prior Immediate PWA POS transition record. The review used at least 20 materially distinct retrieval passes covering: Sell workflow; phone/tablet/desktop behavior; product search; keyboard-wedge barcode scanning; variations; cart/revision behavior; retail and B2B customer context; Woo/WoodMart/B2BKing pricing presentation; checkout/prepared-sale recovery; cash and electronic payments; receipts; orders; returns/refunds; registers/shifts/cash control; Store Health/sync; offline behavior; PWA update/recovery/multi-tab behavior; FigoBooks-inspired UX/accessibility; modular capability architecture; identity/authorization; hardware/settings; chronology/superseded Medusa/Vendure directions; and final independent POS adapter migration.

Newest explicit decisions control where the historical record conflicts.

## CURRENT

- The approved cashier mental model is **Scan → Sell → Pay → Print**.
- Sell is the default operational surface after sign-in/open shift; no dashboard-first flow.
- The frontend is provider-neutral: UI → application/use cases → domain/contracts → ports → adapters.
- Cashier UI must never calculate WoodMart or B2BKing rules. A whole-cart `PricingPort.quote()` returns the authoritative result.
- Every material cart mutation increments a monotonic cart revision, invalidates the quote, blocks Pay, persists the draft, then requotes.
- Out-of-order quotes must be rejected when their revision is older than the current cart.
- Barcode identifiers are strings. Leading zeroes are preserved. Repeated exact scans increment quantity.
- Exact variation barcodes add the variation directly; an unresolved variable parent opens a variation chooser.
- Walk-in is the default customer. Changing customer immediately invalidates the quote. New sale resets to Walk-in.
- Wholesale context is explicit to the cashier without exposing B2BKing rule IDs or infrastructure terminology.
- Checkout eligibility is centralized and must explain why Pay is unavailable.
- Payment states are explicit: preparing, awaiting customer, pending, verified, finalizing, complete, cancelled, failed, reconciling, needs attention.
- A pending/ambiguous electronic payment explicitly says **do not charge again**.
- Receipts are immutable transaction snapshots. The ordinary receipt must not claim to be a statutory Ghana VAT/E-VAT document.
- Returns separate: return intake, historical refund economics, payment refund, and physical stock disposition.
- Damaged/defective/quarantine returns must not silently become sellable stock.
- POS owns register/shift/cash UX. Expected drawer cash is distinct from counted cash; variance is preserved, not silently erased.
- X report is an in-shift snapshot; Z report closes the shift and is immutable.
- Store Health and Needs Attention are first-class operational surfaces.
- Launch offline behavior is truthful: cached catalog/search/barcode/cart/drafts can work; authoritative pricing, final checkout, electronic payment, refunds and authoritative shift close require connection.
- PWA update UX is controlled: Update Ready may wait; active payment/critical recovery blocks activation; non-destructive Fix App is the default recovery path.
- Phone layout is not a squeezed desktop view. Phone uses product/search flow + sticky cart summary + full-screen cart/payment. Tablet/desktop use a high-throughput split view.
- Accessibility, visible focus, semantic controls, non-color status, large touch targets and reduced-motion support are part of the approved frontend.

## TRANSITIONAL

- WooCommerce remains the current commerce runtime/source for products, customers, orders and current stock where defined.
- WooCommerce runtime + WoodMart quantity pricing + B2BKing customer/group/tier behavior form the transitional authoritative pricing boundary.
- Supabase is transitional POS operational persistence and projection infrastructure, not a second commerce master.
- IndexedDB/Dexie is the production local store direction. The zero-install preview uses replaceable preview persistence only and must be replaced during conversion.
- Next.js Route Handlers/BFF and the CETECH POS Bridge are transitional adapters, not UI identities.
- Cash plus a Ghana-relevant electronic tender (e.g. Paystack/approved external flow) sit behind `PaymentPort`.
- Browser printing is the launch fallback; direct thermal protocol support is not a prerequisite for the preview or the first cut.

## TARGET

- The frontend, domain contracts, state semantics, interaction model, responsive layouts, barcode behavior, payment UX, receipt UX, register UX and recovery UX should survive migration to the independent POS peer.
- `IdentityPort` eventually maps to AccessLobby.
- `CatalogPort` eventually maps to AIM PIM.
- `PricingPort` eventually maps to Pricing / Offers / Commercial Terms.
- `SalesPort` and inventory/order capabilities eventually map to Distributed Inventory + Order/Fulfillment Orchestration.
- `PaymentPort` eventually maps to MoneyMove.
- POS-specific register/device/shift/cash/receipt/recovery truth eventually lives in the independent POS backend/PostgreSQL.
- Optional mature capability packs can add true bounded offline selling, richer hardware, split tender, multi-location fulfillment and other features without rewriting core selling UX.

## SUPERSEDED

- Medusa or Vendure as the current authoritative POS backend for this urgent CETECH transition.
- A CETECH-specific monolith owning product, pricing, inventory, order and POS truth.
- Direct React/browser calls to privileged WooCommerce/B2BKing/WoodMart/Supabase/provider APIs.
- Copying pricing rules into browser JavaScript or a second Supabase pricing engine.
- Full offline sale completion as a launch claim before bounded authority/reconciliation exists.
- Dashboard-first POS design.
- Treating every browser reload/network failure as a generic retry.
- Destructive recovery that routinely clears IndexedDB or all caches.

## PROPOSED / INFERRED FOR THE PREVIEW

- No final CETECH visual brand palette was supplied, so the preview uses a neutral operational palette with a single replaceable accent token.
- Fictional CETECH-style products/customers are used only to exercise UI states; all prices are preview fixtures.
- Preview persistence uses browser `localStorage` solely because the artifact must open under `file://` without packages/server. Production conversion must replace this with the approved Dexie/IndexedDB stores.
- The preview shows a compact left rail on tablet/desktop and bottom navigation on phone.
- A separate Demo Controls panel intentionally triggers outages, stale quotes, price/stock changes, recovery, update and passive-tab states. It is not part of production cashier UX.

## UNRESOLVED FOR PRODUCTION INTEGRATION — NOT BLOCKING THE FRONTEND DESIGN

- Exact CETECH brand assets/accent color.
- Actual scanner/printer models and final printer profile.
- Exact Woo/WordPress/WoodMart/B2BKing versions and current live rule interactions.
- Actual barcode source/meta mapping currently used by CETECH/VitePOS.
- Current statutory Ghana invoicing integration and exact receipt/tax workflow.
- Exact electronic payment provider/account policy for walk-in customers.
- Final production role/capability assignments and cash-variance thresholds.

These unresolved items affect adapters/configuration or production policy, not the approved frontend information architecture.

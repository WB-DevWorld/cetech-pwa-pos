# CETECH POS — Frontend Specification

## Preview architecture

```text
Browser-openable preview
  AppShell / feature views
        ↓
  application-style actions and state machines
        ↓
  provider-neutral concepts
        ↓
  Mock ports/adapters
        ↓
  fictional demo data / simulated results
```

Production conversion:

```text
Next.js PWA
  React feature components
        ↓
  application use cases
        ↓
  core domain + ports
        ↓
  Dexie/local adapters + Next BFF adapters
        ↓
  Supabase / CETECH POS Bridge / Woo runtime / payment providers
```

The preview must be evaluated as the approved frontend shell. Conversion should replace integration/persistence implementations, not redesign flows.

## Information architecture

Primary cashier navigation:

1. **Sell** — product search/scan, customer, cart, quote, Pay.
2. **Orders** — order list/search/detail, reprint, return entry.
3. **Customers** — minimal retail/wholesale lookup/context.
4. **Returns** — return intake, condition, refund preview/approval/status.
5. **Register** — opening float, cash movements, X report, blind close, variance, Z report.
6. **Store Health** — connectivity, commerce/pricing/catalog/payment/local-data/version health.
7. **Needs attention** — payment/refund/sale/shift/sync recovery.
8. **Settings** — device/register, scanner, printer, appearance, diagnostics/build.

Authentication states exist outside the main shell: Login, Session expired, Locked register and Unauthorized.

## Major components

- `App`
- `AppShell`
- `TopBar`
- `PrimaryNav`
- `LoginView`
- `SellView`
- `ProductSearch`
- `ProductResults`
- `ProductCard`
- `VariationDialog`
- `CartPanel`
- `CartLine`
- `CustomerSelector`
- `QuoteStatus`
- `CheckoutEligibility`
- `PaymentDialog`
- `CashPayment`
- `ElectronicPayment`
- `ReceiptView`
- `OrdersView`
- `OrderDetail`
- `ReturnsView`
- `ReturnDialog`
- `RegisterView`
- `XReportView`
- `ShiftCloseFlow`
- `ZReportView`
- `StoreHealthView`
- `AttentionView`
- `SettingsView`
- `UpdatePrompt`
- `FixAppView`
- `MigrationView`
- `DemoControls` (preview only)

## Responsive rules

### Phone (< 821px)

- Bottom primary navigation.
- Product/search area is full width.
- Cart is not permanently squeezed beside products.
- Sticky cart summary shows item count and current/pending total.
- Cart/payment opens as full-screen operational surface.
- Dialogs become bottom/full-width sheets.
- Product results use one or two columns based on width.

### Tablet / compact desktop (821–1050px)

- Left navigation rail.
- Two-pane Sell layout remains, with narrower cart pane.
- Product grid adapts without reducing touch targets.
- Secondary context pills may collapse.

### Desktop / POS terminal (> 1050px)

- Persistent navigation rail.
- High-throughput two-pane Sell layout.
- Keyboard shortcuts: F2/Ctrl+K search, F4 customer, F8 Pay, Esc close transient UI.
- Barcode keyboard-wedge input works without network lookup.

## State rules

### Cart

Every add/remove/quantity/variation/customer mutation:

1. mutates the draft locally;
2. increments `revision`;
3. persists the draft;
4. marks quote stale/offline;
5. disables Pay;
6. schedules a whole-cart authoritative quote.

Only a quote with `quote.cartRevision === cart.revision` may become confirmed. Late older responses are ignored.

### Pay eligibility

Pay is enabled only when:

- active shift is open;
- cart is non-empty;
- current revision has a confirmed, unexpired quote;
- all lines are purchasable;
- online/commercial pricing path is healthy;
- no critical unresolved transaction blocks the register;
- current window is not passive.

The button always explains the blocking reason.

### Checkout

Editable cart → Preparing → Order reserved → Tender selection → Payment states → Finalizing → Complete.

Typed exceptions include Quote changed, Stock changed, Integration unavailable and Needs attention. Ambiguity never becomes a generic retry.

### Payment

Cash: total → cash received → change → confirm → finalize.

Electronic: initialize → awaiting customer → pending/success/cancel/fail/timeout-recovery → verified → finalizing. Pending explicitly blocks duplicate charging.

### Returns

Original sale → select quantities → reason + condition → historical refund preview → manager approval → cash/electronic refund state → stock disposition → refund record/receipt.

### Register

No shift → select register/opening float → active shift/cash movements/X report → closing → blind count → variance → manager approval if policy requires → immutable Z snapshot → closed.

### PWA/recovery

Update Ready is independent from immediate activation. Critical transaction states block update activation. Fix App escalates from health checks and rebuildable projection repair toward destructive reset only as a last resort.

## Accessibility

- Semantic `<main>`, `<nav>`, `<aside>`, `<section>`, tables and forms.
- Real buttons/inputs instead of clickable divs.
- Skip link.
- Visible focus ring.
- Status text plus icons/badges; color is never the only indicator.
- Minimum ~44px interactive targets.
- Dialogs declare `role=dialog`, `aria-modal=true`, labelled title.
- Live regions for app changes/toasts.
- Reduced-motion media query.
- Strong contrast in light and dark themes.

## Performance-oriented UX

- Search and scan render locally and immediately.
- Product images are deliberately non-blocking/absent in this preview.
- Cart mutation never waits for quote response.
- Quote states update inline instead of blocking the whole screen.
- Search results and cart are independently scrollable on desktop.
- Provider outages degrade the affected capability rather than blanking the app.

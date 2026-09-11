# CETECH POS — Next.js / TypeScript Handoff

## Conversion objective

Convert the browser-openable preview into the production Next.js PWA **without redesigning the approved frontend**. Keep layouts, information architecture, copy, responsive behavior, state semantics, keyboard/scanner behavior and receipt styling. Replace mocks and preview persistence with production implementations behind the same conceptual ports.

## Suggested production structure

```text
src/
├── app/
│   ├── (auth)/
│   ├── (pos)/
│   │   ├── sell/
│   │   ├── orders/
│   │   ├── customers/
│   │   ├── returns/
│   │   ├── register/
│   │   ├── health/
│   │   ├── attention/
│   │   └── settings/
│   └── api/
├── features/
│   ├── auth/
│   ├── register/
│   ├── sell/
│   ├── customers/
│   ├── checkout/
│   ├── payments/
│   ├── orders/
│   ├── returns/
│   ├── receipts/
│   ├── sync/
│   ├── recovery/
│   └── settings/
├── core/
│   ├── domain/
│   ├── application/
│   ├── ports/
│   └── errors/
├── adapters/
│   ├── local/
│   ├── commerce/
│   ├── payments/
│   ├── auth/
│   └── devices/
├── server/
├── ui/
└── config/
```

## Component mapping

| Preview component | Future `.tsx` | Destination | State / props | Port dependencies | Client/server | Preserve | Replace/delete |
|---|---|---|---|---|---|---|---|
| `AppShell` | `AppShell.tsx` | `ui/shell` | session, register, health, nav | IdentityPort, HealthPort via feature hooks | Client shell | rail/bottom nav, top status | vanilla string renderer |
| `LoginView` | `LoginScreen.tsx` | `features/auth` | auth state, locked/expired/unauthorized | IdentityPort | Client | state copy/layout | demo staff buttons |
| `SellView` | `SellScreen.tsx` | `features/sell` | CartDraft, catalog query, mobile cart state | CatalogPort, PricingPort | Client | two-pane + phone flow | demo data source |
| `ProductSearch` | `ProductSearch.tsx` | `features/sell/components` | query, focus shortcut | CatalogPort/local search | Client | F2/Ctrl+K behavior | static search implementation |
| `ProductResults` | `ProductResults.tsx` | `features/sell/components` | local results | CatalogPort | Client | operational cards/list | mock product fixtures |
| `VariationDialog` | `VariationDialog.tsx` | `features/sell/components` | product, variations | CatalogPort | Client | exact-variation behavior | preview modal renderer |
| Barcode handler | `useBarcodeScanner.ts` | `features/sell/hooks` | scanner buffer/context | CatalogPort | Client | strings, Enter terminator, repeated scan | preview global listener details if replaced |
| `CartPanel` | `CartPanel.tsx` | `features/sell/components` | CartDraft, CheckoutEligibility | PricingPort via application use case | Client | desktop pane/mobile full screen | HTML renderer |
| `CartLine` | `CartLine.tsx` | `features/sell/components` | CartLine + QuoteLine | none directly | Client | +/- + direct qty + pricing label | preview event delegation |
| `CustomerSelector` | `CustomerSelector.tsx` | `features/customers` | current/search/results | CustomerPort | Client | Walk-in default, WHOLESALE chip | fixture list |
| `QuoteStatus` | `QuoteStatus.tsx` | `features/sell/components` | QuoteState | none directly | Client | explicit missing/stale/quoting/confirmed/failed/offline | fake timer text source |
| checkout policy | `canCheckout.ts` | `core/application` | cart, shift, health, recovery | none | Pure | centralized reason codes | JS helper |
| checkout workflow | `usePrepareSale.ts` + use case | `features/checkout` / `core/application` | transaction state | SalesPort, OperationJournal | Client/use case | preparing/checking/changed/stock/attention | fake prepare adapter |
| `PaymentDialog` | `PaymentDialog.tsx` | `features/payments` | PreparedSale, PaymentState | PaymentPort | Client | tender/state copy | demo outcome buttons |
| `CashPayment` | `CashPayment.tsx` | `features/payments` | amount due, cash received | PaymentPort / RegisterPort | Client | change UX/quick amounts | mock confirmation |
| `ElectronicPayment` | `ElectronicPayment.tsx` | `features/payments` | PaymentState/reference | PaymentPort | Client | pending/do-not-charge-again/reconcile | success/fail demo buttons |
| `ReceiptView` | `ReceiptView.tsx` | `features/receipts` | ReceiptSnapshot | ReceiptPort, PrintPort | Client | 80mm/A4 markup/CSS, disclaimer | preview `window.print()` can remain fallback |
| `OrdersView` | `OrdersScreen.tsx` | `features/orders` | search/filter/results | Sales/Order read port | Client | table/detail/status language | seed orders |
| `OrderDetail` | `OrderDetailDialog.tsx` | `features/orders` | OrderSummary | ReceiptPort, ReturnPort | Client | reprint/return actions | preview lookup |
| `ReturnsView` | `ReturnsScreen.tsx` | `features/returns` | eligible order search | ReturnPort/order read port | Client | online-required message | fixture cards |
| `ReturnDialog` | `ReturnFlow.tsx` | `features/returns` | ReturnCase draft/preview | ReturnPort, PaymentPort | Client | qty/reason/condition/approval/pending | fake refund adapter |
| `RegisterView` | `RegisterScreen.tsx` | `features/register` | Register, Shift, summary | RegisterPort | Client | opening float/active shift/cash movement | fake shift persistence |
| `XReportView` | `XReport.tsx` | `features/register` | authoritative ShiftSummary | RegisterPort | Client | print layout | locally derived preview summary |
| `ShiftCloseFlow` | `ShiftCloseFlow.tsx` | `features/register` | blind count, variance, approval | RegisterPort | Client | variance semantics | preview threshold only |
| `ZReportView` | `ZReport.tsx` | `features/register` | immutable close snapshot | RegisterPort/Receipt-like print | Client | snapshot/print | fake close adapter |
| `StoreHealthView` | `StoreHealthScreen.tsx` | `features/sync` | StoreHealth | HealthPort, SyncPort | Client | first-class navigation/status cards | demo toggles |
| `AttentionView` | `AttentionScreen.tsx` | `features/recovery` | AttentionItem[] | SalesPort, PaymentPort, ReturnPort, RegisterPort | Client | unified recovery queue | canned attention results |
| `UpdatePrompt` | `UpdatePrompt.tsx` | `features/recovery` | release policy, UpdateSafety | release/update coordinator | Client | safe/defer/blocked semantics | demo update flag |
| `FixAppView` | `FixAppDialog.tsx` | `features/recovery` | local health/critical ops | SyncPort/local repair services | Client | escalation order | preview reset behavior |
| `MigrationView` | `LocalDataMigrationView.tsx` | `features/recovery` | migration/lock state | Dexie migration coordinator | Client | blocked-tab copy/data-preservation semantics | simulation |
| `SettingsView` | `SettingsScreen.tsx` | `features/settings` | device/register/printer/scanner/theme/build | Device/Config ports | Client | compact scope | fixture device data |
| `DemoControls` | delete | preview only | demo fault state | mock runtime only | n/a | nothing production-facing | delete entirely |

## Cart and quoting conversion

Preserve these rules exactly:

1. `CartDraft.revision` is monotonic.
2. Every material mutation persists, increments revision and makes the current quote unusable.
3. Quote request carries local cart revision.
4. A response only applies if it still matches the current revision.
5. Aborting an old request is an optimization; revision identity is correctness.
6. Restored carts are requoted before Pay.
7. Quote TTL never replaces final server revalidation during `SalesPort.prepare`.

Production persistence: `CartDraftStore` and `OperationJournal` implemented with Dexie/IndexedDB; do not retain preview `localStorage`.

## Server/client boundary

The listed operational screens are interactive Client Components. Provider credentials and privileged commerce/payment work remain server-side behind Route Handlers/BFF or later the independent POS API. React must not receive Woo consumer secrets, WordPress Application Passwords, Supabase elevated keys or payment secret keys.

## CSS migration

Preserve the semantic CSS custom properties and operational layout rules. They can move to CSS Modules, Tailwind theme tokens or a dedicated token package, but do not replace them with ad-hoc per-component values. Preserve:

- `--color-*` semantics;
- spacing/radius/touch target tokens;
- desktop split layout;
- `≤820px` phone behavior;
- focus-visible rules;
- reduced motion;
- print receipt CSS.

## Mock-to-production adapters

| Preview | Production transition | Long-term replacement |
|---|---|---|
| `MockCatalogPort` | Dexie catalog projection synchronized from Woo | AIM PIM adapter |
| `MockPricingPort` | Next BFF → CETECH POS Bridge → Woo runtime quote | Pricing / Commercial Terms adapter |
| `MockCustomerPort` | server-assisted Woo customer search | future customer/org capability as decided |
| `MockSalesPort` | prepare/resolve/cancel through BFF + bridge | Order/Fulfillment Orchestration adapter |
| `MockPaymentPort` | cash + Paystack/external adapters | MoneyMove adapter |
| `MockRegisterPort` | Supabase POS operational API | independent POS peer backend |
| `MockReceiptPort` | immutable receipt snapshot storage + PrintPort | POS + DonLoft archive where applicable |
| `MockHealthPort` | production Store Health aggregation | permanent POS health capability |
| `MockSyncPort` | Woo webhooks/reconciliation → projections | peer/event projections |
| demo auth | Supabase Auth behind IdentityPort | AccessLobby OIDC |

## Do not infer new product design during conversion

If production integration forces a contract change, update the contract and its tests deliberately. Do not use integration work as an excuse to re-layout Sell, rename cashier concepts, merge explicit payment states into a spinner, remove Store Health, or simplify recovery into destructive reset/retry behavior.

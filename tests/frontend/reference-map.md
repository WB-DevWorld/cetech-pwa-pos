# FE-01 — Approved reference → production implementation/test map

## Metadata

| Field | Value |
| --- | --- |
| Task | FE-01 / GitHub issue #6 — Intake approved prototype and map scenarios |
| Workstream | WS1 Frontend / UX — Developer 1 |
| Repository | `WB-DevWorld/cetech-pwa-pos` |
| Inspected git ref | `15287691a71081ca2855b5b9bc325a787b2ca7c0` (`origin/main`, merge of PR #31 `fix/bootstrap-windows-setup`) |
| Task branch | `ws1/fe-01-intake-approved-prototype-and-map-scenarios` created from that ref |
| Checkout | Dedicated worktree `H:/cursor/cetech-pwa-pos-fe-01` so unrelated dirty files on the original `main` working tree were left untouched |
| Approved reference label | `frontend-approved-intake-2026-09-11` (`reference/frontend-approved/MANIFEST.md`) |
| Provenance | `cetech-pos-frontend-prototype(1).zip`; archive SHA-256 `9882a76c8fe37d83aff04f8f2d8641f8df4dc4e7c078967b0c7a8202612a9e0b`; 28 preserved files; hashes in `reference/frontend-approved/SHA256SUMS.json` |
| Frozen production contract version | **v1.0.0** (`docs/contracts/`, ADR-003) |
| Date | 2026-09-12 |
| Scope | Documentation / reference intake only. No feature code, scaffold, contracts, migrations, or approved-artifact edits. |
| Planning vs created files | **Proposed production component paths in this map are planning targets only. FE-01 does not create them.** CP-05 has not landed; `apps/pos-web` feature/ui trees are not implemented here. |

Authority used (repository truth over prototype types): ADRs 003–008, `docs/contracts/PROTOTYPE-MAPPING.md`, `docs/contracts/ports.ts`, `docs/contracts/domain.generated.ts`, `docs/architecture/FRONTEND-ARCHITECTURE.md`, `docs/architecture/MODULE-BOUNDARIES.md`, WS1 eight-file pack, OWNERSHIP.md.

Prerequisite treatment: CURRENT-WORK.md records CP-01/02/03 as implemented/verified and FE-01 as READY. GitHub issue #6 remains OPEN/unassigned; that older issue state is weaker than repository evidence. CP-05 is **not** a prerequisite for this documentation task.

## Evidence-category legend

Used in the **Acceptance / test target** column. A later WS1 mock, screenshot, or interaction pass **never** proves real pricing parity, exactly-once Woo order effects, RLS, real payment settlement, real stock reservation/reduction, physical print success, or production readiness.

| Code | Category |
| --- | --- |
| FU | Frontend unit/component test |
| FI | Frontend interaction test |
| E2E | Playwright/E2E |
| SS | Screenshot / reference comparison |
| KB | Keyboard / scanner behavior |
| RD | Responsive / device evidence |
| BR | Provider / bridge integration evidence |
| PX | WS2 pricing parity evidence |
| ID | WS3 idempotency / reconciliation evidence |
| PWA | Installed-PWA evidence |
| HW | Hardware evidence |
| REL | Release / cutover evidence |

## Prototype → v1 corrections applied in this map

UX layout, navigation, copy tone, and cashier states are preserved. Prototype *types and adapters* are not production authority.

| Prototype concept | Production v1 treatment |
| --- | --- |
| `Money.minor: number` (implicitly any number) | Nonnegative safe-integer `Money`; `SignedMoney` for variance/ledger deltas |
| `quantity: number` | Canonical positive decimal **string** `Quantity`; no float quantity/pricing arithmetic; convert only at UI boundaries |
| Barcode/SKU as JS numbers | Remain **strings**; preserve leading zeroes (`0012345678901`, `0001112223334`) |
| `CustomerContext` embeds full customer + `pricingKey`/`groupLabel` | `walkin` **or** `retail`/`b2b` + opaque `customerId`; server verifies commercial group/terms; UI kind is a request only |
| `CommerceQuote` optional location; client totals | `Quote` binds `cartId` / `cartRevision` / customer / `locationId`; server snapshot `id` + opaque `fingerprint`; client cannot submit authoritative totals |
| Quote as reservation; `PreparedSale.status: 'reserved'` + `providerOrderId` | Quote is **not** a reservation. `PreparedSale.status: "prepared"`; opaque `saleId`; `stockCommitment: "reserved" \| "reduced"` only after prepare verifies it. Never promise “reserved” from demo copy |
| No standalone prepare/finalize split in payment | `PaymentPort` verifies tender; BFF `CheckoutUseCases.finalize` loads evidence and calls server-only `SalesPort.confirmPayment` |
| `PaymentState.finalizing` / `completed` mixed into tender | Tender `verified` is separate from `SaleResolution.finalizing` / `completed` |
| Pending/timeout → retry buttons | Pending/unknown → **resolve reality**; **Do not charge again**; no new tender/key |
| `ReceiptPort.reprint` / `ReceiptPort.create` | `ReceiptPort.getByTransaction` (immutable snapshot); `PrintPort.print({ reason: "initial" \| "reprint" })`; `dialog_opened` ≠ paper printed |
| Historical `InventoryPort` | **No P0 InventoryPort.** Advisory availability on quote; definitive stock in prepare |
| Optional journal / in-memory `operation` | `OperationJournal.appendBeforeSend` before network effect; `response_unknown` resolved before replay. WS3 owns Dexie schema |
| Demo staff buttons / localStorage session | `IdentityPort.getSession` / `can` / `signOut`; server-validated session. No fictional production login |
| Local sum of cash movements as expected drawer | Server owns `Shift.expectedCash` and actor; variance is `SignedMoney`; corrections append-only |
| Client `refundAmount` / auto-restock | Refund and restock are separate; historic economics; RT-01 still owns execution-wire refinement |

---

## Primary mapping table

Proposed WS1 paths stay under `apps/pos-web/src/features/**` and `apps/pos-web/src/ui/**`. Where the behavior needs core/app/local/server capability, the path column names a **WS3 dependency / integration request**, not a file WS1 will create.

| Reference screen/component/scenario | Source path | Behavior/state | Proposed production component path | Consumed current contract | Preserve / replace treatment | Dependency / owner | Acceptance / test target |
| --- | --- | --- | --- | --- | --- | --- | --- |
| App boot / skip link / live regions | `artifact/index.html`; `js/components.js` `CetechComponents.render` | Skip-to-main; `#app` polite live region; toast assertive live region; light/dark `color-scheme` | `apps/pos-web/src/ui/shell/AppRoot.tsx` | none directly (a11y shell) | Preserve skip link, live regions, semantic landmarks. Replace string-template mount | WS1 UI; WS3 mounts in `src/app` | FU, SS, RD |
| App shell / TopBar / PrimaryNav | `js/components.js` `AppShell` | Rail: Sell, Orders, Customers, Returns, Register, Health, Attention; Settings in bottom; register/cashier/shift/online pills; lock | `apps/pos-web/src/ui/shell/AppShell.tsx`, `TopBar.tsx`, `PrimaryNav.tsx` | `IdentityPort`, `RegisterPort.activeShift`, `HealthPort` | Preserve IA, Sell-default, compact Settings. Delete Demo FAB from production shell | WS1 UI; WS3 route composition | FU, FI, SS, RD |
| Login / authentication | `LoginView`; `js/mock-adapters.js` `IdentityPort.login` | Signed-out, expired (cart kept), unauthorized, locked-register notices; demo staff buttons | `apps/pos-web/src/features/auth/LoginScreen.tsx` | `IdentityPort.getSession`, `can`, `signOut`; `Session` | Preserve layout/copy/states. **Replace** fictional Ama/Kofi buttons with production sign-in; session is server cookie | WS1 screen; WS3 CORE-02 session | FU, FI, E2E; **not** RLS proof |
| Register gate / open register | `RegisterView` no-shift form; `RegisterPort.openShift` | Select register + opening float; online-required; then Sell | `apps/pos-web/src/features/register/OpenRegisterForm.tsx` | `RegisterPort.get`, `open`; `OpenShiftRequest.openingFloat: Money` | Preserve float UX. Replace demo register list and client-set `staffId` — server derives actor | WS1; WS3 register API | FU, FI, E2E |
| Sell screen | `SellView` | Post-open default; product pane + cart; phone sticky cart bar | `apps/pos-web/src/features/sell/SellScreen.tsx` | `CatalogPort`, `PricingPort`, `CartDraftStore`, `CheckoutEligibility` | Preserve two-pane vs phone flow. Replace preview fixtures and demo barcode chips | WS1 FE-03; WS3 CORE-04 local catalog | SS (desktop/phone refs), RD, FI |
| Product search / results | `SellView` toolbar; `ProductCard`; `app.js` `refreshSearch` | Local/immediate search; empty/no-match; loading; out-of-stock cards | `apps/pos-web/src/features/sell/components/ProductSearch.tsx`, `ProductResults.tsx`, `ProductCard.tsx` | `CatalogPort.search`; `CatalogItem.displayPrice` advisory only | Preserve F2/Ctrl+K, card layout. Replace mock search; display price is never checkout price | WS1; WS3 Dexie catalog adapter | FU, FI, KB |
| Barcode scanner (keyboard wedge) | `app.js` scanner buffer; `scanBarcode` | Buffer keys outside inputs; 120ms gap reset; Enter terminator; barcode stays string | `apps/pos-web/src/features/sell/hooks/useBarcodeScanner.ts` | `CatalogPort.search({ barcode })` | Preserve string/leading-zero/Enter behavior. Replace preview global listener only if a production hook is equivalent | WS1 FE-03 | KB, FI; HW later for physical scanner |
| Unknown barcode | demo `9999999999999`; `scanBarcode` no matches | Toast “Product not found…”; query filled; search refresh | `ProductSearch` + unknown-barcode empty state | `CatalogPort.search` empty page | Preserve cashier-visible unknown state; replace demo button | WS1 | FI, KB, E2E |
| Duplicate / collision barcode | `CollisionModal`; demo `scan-collision` | Do not guess; cashier chooses among matches | `apps/pos-web/src/features/sell/components/BarcodeCollisionDialog.tsx` | `CatalogPort.search` may return multiple barcode matches (`DOMAIN-CONTRACTS.md`) | Preserve “choose, don’t guess”. Demo uses canned products (LED panel / 12-way DB) rather than a shared fixture barcode — production must use **real** multi-match results | WS1; catalog projection WS3 | FI, E2E |
| Exact variation scan | barcode `0001112223334` red cable | Exact variation added; chooser bypassed | `useBarcodeScanner` + `addSellable` | `CatalogItem.kind: "variation"` + `parentId`; quote line `productId` + `variationId` | Preserve bypass. Replace nested prototype `variations[]` with flat catalog shape | WS1; WS3 catalog mapping | FI, KB, E2E |
| Variation selector | `VariationModal`; parent product add | Unresolved variable parent opens chooser | `apps/pos-web/src/features/sell/components/VariationDialog.tsx` | `CatalogPort.search({ parentId })` | Preserve sheet/dialog; phone sheet vs desktop dialog | WS1 | FU, FI, RD |
| Repeated scans | `addSellable` existing line `quantity += 1` | Same SKU/variation increments line | `CartLine` quantity controls + scanner | `Quantity` string increment via exact decimal helper (not float) | Preserve increment UX. **Replace** numeric `+= 1` with decimal-string quantity rules | WS1; WS3 may supply quantity helper | FU, KB |
| Quantity editing | `CartLine` +/− / direct input | Direct entry for wholesale qty; each mutation revises cart | `apps/pos-web/src/features/sell/components/CartLine.tsx` | `CartDraft.lines[].quantity: Quantity` | Preserve +/− and direct entry. Parse/validate decimal strings at the input boundary only | WS1 | FU, FI |
| Cart (empty / lines / clear / revision) | `CartPanel`; `freshCart`; `mutateCart` | Empty copy; revision shown; clear; persist; invalidate quote | `apps/pos-web/src/features/sell/components/CartPanel.tsx` | `CartDraftStore`; `QuoteState` | Preserve desktop pane / phone full-screen. Replace `localStorage` with Dexie `CartDraftStore` | WS1 UI; **WS3** local store | FU, FI, E2E |
| Customer selection | `CustomerModal`; `CustomersView` | Search name/company/phone; choose customer; F4 | `apps/pos-web/src/features/customers/CustomerSelector.tsx`, `CustomersScreen.tsx` | `CustomerPort.search`; `CustomerSummary` | Preserve Walk-in default and WHOLESALE chip. **Replace** fixture list and **do not** persist `pricingKey`/`groupLabel` as authority | WS1; server search WS3/BFF | FU, FI |
| Walk-in context | default `customers[0]` Walk-in; New sale reset | Default context; new sale returns to Walk-in | customer chip + new-sale action | `CustomerContext.kind: "walkin"` | Preserve default and reset. Server still verifies walk-in | WS1 FE-03 | FI, E2E |
| Retail context | `Adwoa Mensah` fixture | Retail selection requotes | `CustomerSelector` | `CustomerContext { kind:"retail", customerId }` | Preserve retail chip/list UX. Server verifies visibility/terms | WS1; WS3 customer lookup | FI, PX (live later) |
| B2B / wholesale context | Accra Buildworks / WHOLESALE badge | Visible wholesale mode; mock requote | `CustomerSelector` + quote labels | `CustomerContext { kind:"b2b", customerId }`; `QuoteLine.pricingLabel` | Preserve WHOLESALE visibility **without** B2BKing group IDs. Client kind cannot grant wholesale | WS1; WS2/WS3 quote | FI; **PX** for live wholesale totals |
| Quote missing | empty cart `quoteState: missing` | “Prices will be confirmed after an item is added.” | `apps/pos-web/src/features/sell/components/QuoteStatus.tsx` | `QuoteState.status: "missing"` | Preserve copy | WS1 FE-04 | FU |
| Quoting / stale | `Updating price…` on stale/quoting | Mutation → increment revision → persist → stale/offline → debounce quote | `QuoteStatus` + quote scheduler hook | `QuoteState` quoting/stale; `PricingPort.quote` | Preserve inline non-blocking quote. Request must include `cartId`, `cartRevision`, `locationId`, `Quantity` strings | WS1 FE-04; BFF quote WS3/WS2 | FI |
| Confirmed quote | `Price confirmed` | Only matching revision may confirm; Pay uses quote total | `QuoteStatus` | `QuoteState.confirmed` + `Quote` | Preserve. Drop responses with obsolete revision | WS1 | FU, FI |
| Price changed (quote disclosure) | `priceChanged` + `priceDisclosure`; prepare `QUOTE_CHANGED` | Disclose new total; do not silently replace; review before pay | `QuoteStatus` + checkout `quote_changed` dialog | `QuoteState.changed { previous, current }`; error `QUOTE_CHANGED` / `nextAction: review_quote` | Preserve disclosure UX. Use v1 `changed` state (prototype mixed disclosure onto `confirmed`) | WS1 FE-04; WS2 quote | FI, E2E; PX for live delta |
| Stock changed | prepare fault `STOCK_CHANGED`; line `purchasable` | Payment not started; return to quantity repair | checkout `stock_changed` dialog + line warning | `STOCK_CHANGED`; quote `stockStatus` advisory; prepare definitive | Preserve block-and-repair. **No InventoryPort.** Do not treat quote qty as reservation | WS1; prepare BR-06/CORE | FI, E2E; BR/ID for live stock |
| Expired quote | demo expire; TTL `quoteTtlMs` | Pay blocked “Price expired”; requote | `QuoteStatus` + `CheckoutEligibility.QUOTE_EXPIRED` | `QuoteState.expired`; server clock on `expiresAt` | Preserve block. Client clock is not authority | WS1 FE-04 | FU, FI |
| Failed quote | pricing/commerce down | “Pricing unavailable — cart saved”; Pay blocked | `QuoteStatus` | `QuoteState.failed.code` is `ApiErrorCode` (normally `INTEGRATION_UNAVAILABLE`). `PRICING_UNAVAILABLE` is only a `QuoteProblem.code`, not a failed-quote `ApiErrorCode`. | Preserve cart retention and blocked Pay. Map eligibility through existing v1 reasons (`QUOTE_REQUIRED` / `CONNECTION_REQUIRED`); do not add a `PRICING_UNAVAILABLE` eligibility member | WS1; HealthPort | FI |
| Stale catalog | demo `catalogFresh` toggle; Health row | Advisory stale projection; search still local | health card + optional Sell banner | `CatalogItem.projectionUpdatedAt`; `HealthPort` | Preserve truthful stale UX. Replace demo toggle | WS1 FE-07; WS3 projection | FI, SS |
| Offline quote / browse | demo Go offline | Search/cart edit remain; quote `offline`; Pay “Connection required”; reconnect requotes | Sell banners + `QuoteStatus` | `QuoteState.offline`; `CheckoutEligibility.CONNECTION_REQUIRED`; ADR-005 | Preserve truthful offline (browse/draft only). Settlement stays online | WS1; SW/network WS3 | FI, E2E, PWA |
| Checkout eligibility / disabled Pay explanation | `checkoutEligibility`; `.pay-reason` | Grey Pay is never the only explanation | `CheckoutEligibility` view on `CartPanel` | `CheckoutEligibility` | Preserve reason codes/messages. Align reasons to v1 enum (incl. `UNSUPPORTED_APP_VERSION`, `PASSIVE_WINDOW`, `CRITICAL_RECOVERY_PENDING`) | WS1 FE-04 | FU, FI, E2E |
| Preparation | `prepareSale`; modal “Preparing order…” | Recheck price/stock before money; journal-like `operation` object | `apps/pos-web/src/features/checkout/PrepareSaleDialog.tsx` | `CheckoutUseCases.prepare` / `SalesPort.prepare`; `PrepareSaleRequest` (quoteId/fingerprint/register/shift/device — **not** client lines/totals) | Preserve preparing UX. **Replace** prototype payload (client lines/totals/`providerOrderId`). Copy: prepared sale, **not** “order reserved” unless `stockCommitment` is verified | WS1 FE-05; WS3 journal + BFF | FI, ID |
| Response loss / checking sale status | `RESPONSE_UNKNOWN` → `checking` → `SalesPort.resolve` | Recover existing prepared sale; no duplicate; “Do not create another sale” | same checkout dialog `checking` stage | `SalesPort.resolve`; `OperationJournal.markResponseUnknown`; `SaleResolution` | Preserve checking copy. Journal is WS3; UI consumes pending/unknown | WS1; **WS3** journal/idempotency | FI, ID, E2E |
| Needs-attention preparation | `REQUIRES_ATTENTION`; unresolved resolve | Do not take payment; Attention queue | checkout attention stage + `AttentionScreen` | `SaleStatus.requires_attention`; `ApiErrorCode.REQUIRES_ATTENTION` | Preserve. No generic retry | WS1 FE-07 | FI, ID |
| Tender selection | `PaymentModal` choose tender | Cash, Mobile Money, Card, External electronic; cancel prepared | `apps/pos-web/src/features/payments/TenderSelect.tsx` | `PaymentTender`; `PaymentPort.initialize` for electronic; cash via `confirmCash` | Preserve four tenders and cancel-prepared. Electronic blocked offline. Amount from **prepared sale**, not UI | WS1 FE-05/06 | FU, FI, RD |
| Cash tender | cash stage; Exact/quick amounts; change; confirm | Cash received ≥ total; then finalize | `apps/pos-web/src/features/payments/CashPayment.tsx` | `PaymentPort.confirmCash`; `CashPaymentRequest.cashReceived: Money` | Preserve change UX. Server records append-only cash evidence; UI does not verify money | WS1; CORE-05 | FU, FI, E2E |
| Electronic payment | initialize / awaiting customer | Hosted/terminal wait | `apps/pos-web/src/features/payments/ElectronicPayment.tsx` | `PaymentPort.initialize`; `PaymentState.awaiting_customer` | Preserve waiting copy. **Delete** demo outcome buttons (Success/Fail/Pending/Timeout) | WS1; PAY-01 | FI |
| Pending payment | pending modal | **Do not charge again**; Check again / manager review | `ElectronicPayment` pending | `PaymentState.pending`; `PAYMENT_PENDING`; `nextAction: resolve` | Preserve exact safety copy. Resolve same payment; no new initialize | WS1 FE-06 | FI, E2E, ID |
| Reconciling payment | `reconciling` / timeout recover | Uncertain status; do not charge again | `ElectronicPayment` reconciling | `PaymentState.reconciling`; `PaymentPort.resolve` | Preserve. Timeout is unknown, not failure | WS1; PAY-01 | FI, ID |
| Failed / cancelled payment | failed/cancelled stages | Return to tender; prepared sale recoverable until safely cancelled | `ElectronicPayment` | `PaymentState.failed` / `cancelled`; `SalesPort.cancel` only after authoritative no-success | Preserve. Cancellation blocked if pending/unknown | WS1 | FI, ID |
| Verified payment awaiting commercial finalization | `PaymentPort.finalize`; `finalizing` stage; attention if commerce down | “Payment received / Finalizing”; if incomplete → attention, do not charge again | `apps/pos-web/src/features/checkout/FinalizingSale.tsx` | `PaymentState.verified` + `CheckoutUseCases.finalize` → `SalesPort.confirmPayment`; `SaleResolution.finalizing` | **Replace** prototype `PaymentPort.finalize` (does not exist in v1). UI never calls `confirmPayment`. Verified ≠ completed sale | WS1; WS3 FinalizeSale | FI, ID, BR |
| Receipt | `ReceiptModal` / `ReceiptPaper` | Operational POS receipt; statutory disclaimer; New sale | `apps/pos-web/src/features/receipts/ReceiptView.tsx` | `ReceiptPort.getByTransaction`; `ReceiptSnapshot.documentKind: "operational_pos_receipt"` | Preserve 80mm markup/disclaimer. **Replace** `ReceiptPort.create` and client-built snapshot | WS1 FE-05; WS3 receipt write | FU, SS, E2E |
| Print failure | `PrintFailureModal`; demo next-print-fail | Sale/receipt remain; reprint/retry; no reverse | `PrintFailureDialog.tsx` | `PrintPort.print` → `failed` / `unsupported`; receipt still gettable | Preserve. `dialog_opened` is not physical success | WS1; PrintPort WS3 | FI; **HW** for real printer |
| Reprint | order detail / receipt Print | Audited reprint of immutable snapshot | `ReceiptView` reprint action | `PrintPort.print({ reason: "reprint" })` | Replace prototype `ReceiptPort.reprint` / `window.print()` as sole implementation (browser print may remain fallback adapter) | WS1; WS3 audit | FI, E2E |
| Orders list | `OrdersView` | Search/filter; table; empty; status badges | `apps/pos-web/src/features/orders/OrdersScreen.tsx` | **No v1 OrderPort** — see integration requests. Until then compose `ReceiptPort` + return/sale resolution **if WS3 exposes a read** | Preserve table/filter UX. Replace seed orders | WS1 UI; **WS3** read exposure | FU, FI; BR when live |
| Order detail | `OrderModal` | Customer, tender, lines, reprint, start return | `apps/pos-web/src/features/orders/OrderDetailDialog.tsx` | `ReceiptPort`; `ReturnPort`; sale/payment resolution if exposed | Preserve. Historic lines, not current catalog prices | WS1 | FU, FI |
| Returns / refunds | `ReturnsView` + `ReturnModal` intake/preview/approve | Qty/reason/condition; historical preview; manager approval; online-required | `apps/pos-web/src/features/returns/ReturnsScreen.tsx`, `ReturnFlow.tsx` | `ReturnPort.preview` / `execute` / `resolve`; `ReturnCondition`; **no client refundAmount** | Preserve separation of refund vs restock. Damaged/quarantine not implicitly sellable. RT-01 still owns wire | WS1 FE-06; RT-01 | FI, E2E; BR after RT-01 |
| Pending refund | modal stage pending | Do not issue another refund | `ReturnFlow` pending | `ReturnResolution.refund_pending`; `RefundState.pending` | Preserve copy | WS1 | FI, ID |
| Refund needs attention | modal attention | Ambiguous; manager reconcile | `ReturnFlow` + Attention | `ReturnResolution.requires_attention` | Preserve | WS1 | FI, ID |
| Register active state | `RegisterView` open shift | Metrics, movement history, last Z | `apps/pos-web/src/features/register/RegisterScreen.tsx` | `RegisterPort.get`, `activeShift`, `cashMovement` | Preserve. **Replace** locally summed expected drawer with server `expectedCash` | WS1 FE-06 | FU, FI, SS |
| Cash movement | `CashMovementModal` In/Out/Pickup | Amount + reason; online-required | `CashMovementForm.tsx` | `CashMovementRequest`; server derives `signedAmount` + `actorId` | Preserve kinds. Client must not send actor/signed direction as authority | WS1; WS3 | FI |
| X report | `XReportModal` | Live snapshot; does not close; print | `apps/pos-web/src/features/register/XReport.tsx` | `RegisterPort.report(shiftId, 'X')` | Preserve “does not close”. Replace locally derived preview totals | WS1 | FU, SS |
| Blind register close | `CloseShiftModal` count first | Count before expected revealed | `ShiftCloseFlow.tsx` | `CloseShiftRequest.countedCash` | Preserve blind count | WS1 | FI, E2E |
| Variance | expected vs counted; not rewritten | Variance displayed; not forced to zero | `ShiftCloseFlow` variance step | `Shift.variance: SignedMoney` | Preserve. Prototype used unsigned `Money` difference — production is signed | WS1 | FU, FI |
| Manager approval (variance) | threshold `managerVarianceApprovalMinor` | Large variance needs approval | same flow | `CloseShiftRequest.approvalId`; `IdentityPort.can` hint only | Preserve approval UX. Replace fictional Kofi selector with real approval | WS1; server policy | FI |
| Immutable Z report | `ZReportModal` | Close snapshot; new sale needs new shift | `apps/pos-web/src/features/register/ZReport.tsx` | `RegisterPort.report(..., 'Z')`; `Shift.status: closed` | Preserve immutability copy | WS1 | FU, SS, E2E |
| Store Health | `HealthView` | Connectivity, commerce, pricing, catalog, payments, local DB, version; pending ops; attention count | `apps/pos-web/src/features/health/StoreHealthScreen.tsx` | `HealthPort.getStoreHealth`; `StoreHealth`; `ReleasePolicy` | Preserve first-class nav. Replace demo toggles/`getHealth` shape with v1 `HealthCheck[]` | WS1 FE-07; CORE-03/07 | FU, SS, BR |
| Needs Attention / recovery | `AttentionView` | Queue of ambiguous payment/sale/refund/shift/sync; Check/Recover; all-clear | `apps/pos-web/src/features/recovery/AttentionScreen.tsx` | Compose `OperationJournal.pending`, `SaleResolution`, `PaymentState`, `ReturnResolution`, `HealthPort.attentionCount` — **no AttentionPort** | Preserve unified queue. Replace canned `seedAttention` | WS1 FE-07; WS3 journal | FI, ID |
| Update ready | `UpdateModal` safe | Safe-point apply; local data preserved | `apps/pos-web/src/features/recovery/UpdatePrompt.tsx` | `ReleasePolicy`; WS3 update coordinator | Preserve wait/apply copy. Replace demo flag | WS1; **WS3** SW | FI, PWA |
| Update deferred during active work | cart non-empty | Deferred; finish/clear cart first | `UpdatePrompt` | update safety `defer` | Preserve | WS1 FE-07 | FI, PWA |
| Update blocked during critical work | preparing/payment stages | Blocked until payment/recovery safe | `UpdatePrompt` | update safety `blocked_critical` | Preserve | WS1; WS3 | FI, PWA |
| Unsupported app/version | demo `supportedVersion`; error `UNSUPPORTED_VERSION` | Health unsupported; Pay blocked; preserve local data | Health + eligibility `UNSUPPORTED_APP_VERSION` | `UNSUPPORTED_VERSION` HTTP 426; `ReleasePolicy.minimumSupportedBuild` | Preserve data-preservation UX | WS1; WS3 | FI, PWA |
| Local-data migration | `MigrationModal` running/complete | Preserve cart/journal during schema upgrade | `apps/pos-web/src/features/recovery/LocalDataMigrationView.tsx` | WS3 Dexie migration coordinator (not a v1 port) | Preserve copy. WS3 owns schema/migrations | WS1 UX; **WS3** CORE-04/07 | FI, PWA |
| Another-tab migration block | `migration.state: blocked` | Other window holds upgrade; data not deleted | same view | multi-tab lock (WS3 local) | Preserve | WS1; WS3 | FI, PWA |
| Passive second tab | `secondTabPassive` banner | View-only; mutations denied; Pay `PASSIVE_WINDOW` | Sell banner + eligibility | `CheckoutEligibility.PASSIVE_WINDOW`; WS3 leadership | Preserve. Replace demo toggle with real lock | WS1; WS3 | FI, E2E |
| Fix App / non-destructive recovery | `FixAppModal` | Health → caches → rebuild projection → last-resort reset blocked if critical | `apps/pos-web/src/features/recovery/FixAppDialog.tsx` | `HealthPort`; WS3 repair services; **never** routine IndexedDB wipe | Preserve escalation order. Last-resort reset stays blocked during critical ops | WS1; WS3 | FI, PWA |
| Settings / device summary | `SettingsView` | Device, register, scanner, printer, theme, build; not WP admin | `apps/pos-web/src/features/settings/SettingsScreen.tsx` | `IdentityPort` session; `RegisterPort`; `HealthPort`; `ReleasePolicy` | Preserve compact scope. Replace fixture device strings. **No DevicePort in v1** — compose from session/register/health | WS1; WS3 device identity | FU, SS, RD |
| Phone layout | CSS `max-width: 820px` | Bottom nav; full-width products; sticky cart; full-screen cart/payment; sheets | shell + Sell | none | Preserve behavioral breakpoint (not a squeezed desktop) | WS1 FE-02/07 | SS, RD |
| Tablet layout | `821–1050px` | Rail + split Sell; narrower cart; collapse secondary pills | shell + Sell | none | Preserve | WS1 FE-02 | SS, RD |
| Desktop / POS-terminal layout | `>1050px` | Persistent rail; two-pane Sell; keyboard POS | shell + Sell | none | Preserve | WS1 FE-02 | SS, RD |
| Keyboard focus and shortcuts | `app.js` keydown; `styles.css` `:focus-visible` | F2/Ctrl+K search; F4 customer; F8 Pay; Esc close; dialog focus trap; 3px ring + 2px offset | shell + sell hooks | none | Preserve. Focus-visible required | WS1 | KB, FI |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` | Effectively zero animation/transition | token CSS | none | Preserve | WS1 FE-02 | RD |
| Touch targets | `--touch: 44px`; `.pay-btn` 54px | Min 44px controls; Pay 54px | tokens + Pay button | none | Preserve | WS1 FE-02 | RD, SS |
| Receipt print layout | `@media print`; `.receipt-paper` 80mm | Chrome hidden; 80mm with A4 fallback | `ReceiptView` + print CSS | `PrintPort` | Preserve markup/CSS | WS1; HW later | SS, HW |
| Statutory-invoice disclaimer/boundary | receipt disclaimer; matrix invariant | Ordinary receipt ≠ Ghana VAT/E-VAT invoice | `ReceiptView` footer | `documentKind: "operational_pos_receipt"` | Preserve disclaimer. No compliance claim | WS1 | FU, SS, REL |
| Demo barcode chips on Sell | `SellView` `.demo-barcodes` | Preview-only scan shortcuts | none in production cashier UI | n/a | **Delete** from production; keep as test fixtures/helpers only | WS1 tests | FI (tests only) |
| DemoControls drawer / FAB | `DemoDrawer`; `.demo-fab` | Fault injection; not cashier nav | none | n/a | **Delete** after equivalent automated tests exist (cursor-handoff order) | WS1 tests + later FE tasks | see Demo-only section |

---

## A–K demo scenarios (individual maps)

| Reference screen/component/scenario | Source path | Behavior/state | Proposed production component path | Consumed current contract | Preserve / replace treatment | Dependency / owner | Acceptance / test target |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A. Walk-in retail | `demo-scenarios.md` A; `verification.md` A | Sign-in → open Front Counter 1 → scan `0012345678901` → Price confirmed → Pay → Cash Exact/amount → receipt | `LoginScreen` → `OpenRegisterForm` → `SellScreen` → `CashPayment` → `ReceiptView` | `IdentityPort`; `RegisterPort.open`; `CatalogPort`; `PricingPort`; `CheckoutUseCases.prepare`; `PaymentPort.confirmCash`; `CheckoutUseCases.finalize`; `ReceiptPort`; `PrintPort` | Preserve Scan→Sell→Pay→Print. Replace fictional Ama/register/products and mock quote/cash/receipt create | WS1 FE-02–05; WS2 quote; WS3 BFF/journal | E2E happy path; SS vs `verification-sell-desktop.png`; **PX/BR/ID required before live**; mock E2E ≠ production |
| B. Quantity pricing | `demo-scenarios.md` B; hardener qty tiers in `mock-data.js` | Larger qty → Updating price… → “Quantity pricing applied” | `CartLine` + `QuoteStatus` + `QuoteLine.pricingLabel` | `PricingPort.quote`; `Quantity` string; label is cashier semantic only | Preserve label/UX. **Replace** browser `quoteProfiles` / WoodMart simulation. Totals from server whole-cart quote | WS1 FE-04; **WS2 BR-03** | FI; **PX** golden corpus for live tiers. WS1 screenshot ≠ parity |
| C. Wholesale | `demo-scenarios.md` C; Accra Buildworks | WHOLESALE context + authoritative requote | `CustomerSelector` + quote | `CustomerContext.kind: "b2b"`; server-verified terms; `PricingPort` | Preserve chip and requote-on-customer-change. Replace `pricingKey: b2bA` client authority | WS1 FE-03/04; **WS2 BR-04** | FI; **PX** for B2BKing. Client cannot grant wholesale |
| D. Price changed | `demo-scenarios.md` D; `demo-price-change` | Next quote discloses changed price | `QuoteState.changed` + review | `QUOTE_CHANGED` / changed quote | Preserve disclosure. Replace fault-injection delta | WS1 FE-04; WS2 | FI, E2E |
| E. Stock changed | `demo-scenarios.md` E; `nextPrepare: stock_changed` | Pay does not start payment; cart repair/requote | prepare error UI | `STOCK_CHANGED`; prepare revalidation | Preserve. Not an InventoryPort. Live concurrent last-unit is BR/ID, not UI mock | WS1 FE-05; BR-06 | FI, E2E; **BR/ID** live |
| F. Mobile Money pending | `demo-scenarios.md` F; pending outcome | Do not charge again → Check again resolve success | `ElectronicPayment` | `PaymentPort.initialize` / `resolve`; pending then `verified` then `finalize` | Preserve copy. Replace demo hosted outcome buttons and mock success | WS1 FE-06; **PAY-01** | FI, E2E; **BR** settlement/webhooks. UI resolve ≠ paid |
| G. Offline | `demo-scenarios.md` G | Browse/search/cart OK; Pay blocked; online requotes | Sell + eligibility | ADR-005; `QuoteState.offline`; `CONNECTION_REQUIRED` | Preserve truthful launch offline. No offline settlement | WS1; WS3 SW | FI, E2E, PWA |
| H. Return | `demo-scenarios.md` H | Eligible order → qty/reason/condition → preview → approve → complete; demo pending/attention | `ReturnFlow` | `ReturnPort`; historic economics; refund ≠ restock | Preserve. RT-01 unresolved for execution wire — UI states still mapped | WS1 FE-06; **RT-01** | FI; BR after RT-01. Mock refund ≠ provider refund |
| I. Register close | `demo-scenarios.md` I | Blind count → expected vs counted → variance → manager if large → Z | `ShiftCloseFlow` + `ZReport` | `RegisterPort.close`; `SignedMoney` variance; server expected cash | Preserve variance not rewritten. Replace local expected-cash sum and fictional manager dropdown | WS1 FE-06; CORE-07 | FI, E2E |
| J. PWA update | `demo-scenarios.md` J | Cart defers; active payment blocks; safe apply preserves state | `UpdatePrompt` | `ReleasePolicy`; SW coordinator | Preserve. Replace simulate flag | WS1 FE-07; CORE-07 | FI, **PWA** installed |
| K. Transaction recovery / response loss | `demo-scenarios.md` K; `responseLoss` | Preparing → Checking sale status → recover prepared; no duplicate mock order | checkout checking + `SalesPort.resolve` | `OperationJournal`; `SalesPort.resolve`; unique transaction mapping | Preserve. Replace in-memory `_recoverablePrepared`. Journal-before-send is WS3 | WS1 FE-05; **WS3 ID** | FI, E2E, **ID**. Mock recover ≠ Woo exactly-once |

---

## Other useful states (`demo-scenarios.md`)

| Reference screen/component/scenario | Source path | Behavior/state | Proposed production component path | Consumed current contract | Preserve / replace treatment | Dependency / owner | Acceptance / test target |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Unknown barcode button | Sell demo chip `9999999999999` | Product not found | unknown-barcode empty/search | `CatalogPort` | Production: real unknown scan, not a button | WS1 | KB, FI |
| Collision demo | `scan-collision` | Duplicate match chooser | `BarcodeCollisionDialog` | multi-match barcode search | Production must use catalog collisions, not canned IDs | WS1; catalog | FI, E2E |
| Slow next quote / stale response ignored | `forceOldQuote` + qty change | Older quote dropped; toast | quote scheduler | `Quote.cartRevision` must equal current; obsolete ignored | Preserve correctness rule (abort is optimization only) | WS1 FE-04 | FU, FI, E2E |
| Expire current quote | `demo-expire-quote` | Pay blocked by expiry | `QuoteState.expired` | server `expiresAt` | Replace client-side expire fault | WS1 | FU, FI |
| Next print: fail | `printFailure` | Receipt saved; reprint | `PrintFailureDialog` | `PrintPort` | Preserve | WS1 | FI |
| Next refund: pending | `nextRefund: pending` | Do not issue another | `ReturnFlow` pending | `ReturnPort.resolve` | Replace fault flag | WS1; RT-01 | FI, ID |
| Next refund: needs attention | `nextRefund: attention` | Manager reconcile | Attention + return | `requires_attention` | Replace fault flag | WS1 | FI, ID |
| Catalog fresh/stale | `catalogFresh` | Health card | `StoreHealthScreen` | projection timestamps / HealthPort | Replace toggle | WS1; WS3 | FI |
| Local DB healthy/warning | `localDb` | Health card | `StoreHealthScreen` | HealthPort + Dexie health | Replace toggle | WS1; WS3 | FI, PWA |
| Version supported/unsupported | `supportedVersion` | Health + Pay block | Health + eligibility | `UNSUPPORTED_VERSION`; `ReleasePolicy` | Replace toggle | WS1; WS3 | FI, PWA |
| Data migration | `demo-migration` | Running / complete | `LocalDataMigrationView` | WS3 migrator | Replace simulation | WS1; WS3 | FI, PWA |
| Another-tab blocker | `migration-block` | Blocked upgrade | same | WS3 lock | Replace simulation | WS1; WS3 | FI, PWA |
| Passive second tab | `demo-second-tab` | Passive window | Sell banner | `PASSIVE_WINDOW` | Replace toggle | WS1; WS3 | FI |
| Fix App | `open-fix-app` | Non-destructive first | `FixAppDialog` | HealthPort + repair | Preserve order; no routine clear-all | WS1; WS3 | FI, PWA |
| Session expired | `demo-auth-state expired` | Reauth; cart kept | `LoginScreen` | `AUTH_REQUIRED`; `IdentityPort` | Preserve cart retention | WS1; CORE-02 | FI |
| Unauthorized | unauthorized banner | Access denied | `LoginScreen` | `FORBIDDEN` | Preserve | WS1 | FU, FI |
| Locked register | locked banner | Unlock with staff | `LoginScreen` | session + register membership | Preserve | WS1; CORE-02 | FI |
| Quote changed at Pay | `demo-quote-change` | Prepare returns QUOTE_CHANGED | checkout dialog | `QUOTE_CHANGED` | Preserve review-before-pay | WS1 FE-05 | FI, E2E |
| Provider / commerce outage | toggle `commerce`/`pricing`/`payments` | Capability degrades; Pay/electronic/returns blocked as applicable | Health + eligibility + tender | `INTEGRATION_UNAVAILABLE`; HealthPort | Preserve degraded-not-blank app | WS1; BR-01/CORE-03 | FI, BR |
| New sale reset | receipt `new-sale` | Walk-in reset; new cart | Sell | new `CartDraft` | Preserve | WS1 | FI |
| Critical recovery blocks Pay | eligibility + attention critical | Cannot start another risky sale | Cart Pay | `CRITICAL_RECOVERY_PENDING` | Preserve | WS1 | FI, E2E |

---

## Demo-only behavior and required production replacement

Do not implement replacements in FE-01. Delete demo mechanisms only after equivalent automated failure tests exist.

| Demo-only mechanism | Source path | What it simulates | Why it cannot ship as production authority | Production replacement | Owner / dependency | Later test / evidence |
| --- | --- | --- | --- | --- | --- | --- |
| DemoControls / Demo FAB / drawer | `components.js` `DemoDrawer`; `.demo-fab` | Fault injection for review | Not cashier UX; can fake money/stock/update | Automated tests covering A–K and other states; no production control panel | WS1 tests; delete in FE conversion after coverage | FI/E2E per scenario |
| Fictional staff accounts | `mock-data.js` `staff`; `IdentityPort.login` | Ama cashier / Kofi manager | Not production identity; localStorage session | `IdentityPort` + server session (CORE-02); capabilities are hints | WS3 CORE-02; WS1 LoginScreen | E2E auth; **not** RLS |
| Fictional registers | `registers` Front Counter 1 / Spare | Shift UX | Not POS register truth | `RegisterPort` / Supabase operational registers | WS3 CORE-01 | E2E open/close |
| Fictional customers | Walk-in, Adwoa, Accra Buildworks, etc. + `pricingKey` | Retail/B2B context | Client-owned group/terms would grant wholesale | `CustomerPort` + server-verified `CustomerContext` | WS3/WS2 | FI; PX for B2B |
| Fictional products / barcodes / qty profiles | `mock-data.js` `products` | Search/scan/qty/wholesale labels | Browser reconstructs WoodMart/B2BKing | `CatalogPort` Dexie projection; `PricingPort` whole-cart quote | WS3 CORE-04; WS2 BR-02–05 | PX corpus; catalog tests |
| Fictional orders / attention seed | `seedOrders`, `seedAttention` | Orders/returns/attention | Fake history/payments | Server sale/receipt/return reads | WS3; see order-read gap | E2E with live/staging fixtures |
| Mock adapters (`CetechAdapters`) | `js/mock-adapters.js` | All ports with delays | Throws/returns invented money, stock, reserved orders | v1 ports behind BFF/Dexie | WS3 adapters; WS2 bridge | BR/ID |
| Mock pricing / timers | `PricingPort.quote` delay, `quoteProfiles`, `priceChangeDeltaMinor` | WoodMart-like tiers and quote latency | Binary `Number` qty × minor; client rule tables | Server quote; `Quantity` strings; exact decimal in adapters | WS2/WS3 | **PX**; FU for stale-revision only |
| Simulated WoodMart/B2BKing outcomes | `profileUnitMinor` + customer `pricingKey` | Quantity/wholesale unit prices | Forbidden in browser | CETECH POS Bridge isolated Woo runtime | WS2 | PX, BR |
| Simulated payment outcomes | `PaymentPort.begin/resolveElectronic`; demo Success/Fail/Pending/Timeout buttons | Hosted Paystack-like flow | Button-chosen settlement is not verification | `PaymentPort.initialize/resolve`; provider webhooks/server verify | WS3 PAY-01 | BR; never UI “Success” |
| Mock receipt creation / counters | `ReceiptPort.create`; `receiptCounter`; `orderCounter` | CT-PREVIEW-nnnnn | Client-issued receipt/order numbers | Server unique receipt per completed transaction; `ReceiptPort.getByTransaction` | WS3 CORE-05 | ID; FU display only |
| Locally derived cash/shift values | `expectedCashMinor()` sums movements | Drawer expected | Browser accounting | `Shift.expectedCash` / `ShiftReport` from server | WS3 | FU UI bind; server tests for math |
| Simulated Stock Changed | `faults.nextPrepare = stock_changed` | Concurrent stock | Not Woo/HPOS proof | Prepare revalidation `STOCK_CHANGED` | WS2 BR-06 | BR/ID |
| Simulated response loss | `faults.responseLoss` + `_recoverablePrepared` | Lost prepare HTTP | In-memory recover ≠ durable idempotency | `OperationJournal` + `SalesPort.resolve` + unique mapping | WS3 | **ID** |
| Simulated provider outage | `runtime.services.*` toggles | Commerce/pricing/payments/offline | Flags are not Site Health | `HealthPort` + real adapter errors `INTEGRATION_UNAVAILABLE` | WS3/WS2 | BR |
| Simulated refund outcomes | `faults.nextRefund` | Pending/attention/complete | Not payment-provider refund | `ReturnPort` + `PaymentPort.refund` after RT-01 | WS3 RT-01 | BR/ID |
| Simulated Store Health | HealthView from `services` object | All checks | Not Woo/bridge/Dexie/version truth | `HealthPort.getStoreHealth` aggregation | WS3 CORE-03/07 | BR |
| Simulated update / recovery / migration / passive tab | demo actions | SW/update/lock | localStorage flags | WS3 service worker, release policy, Dexie locks | WS3 CORE-07; WS1 UX | **PWA** |
| Preview `localStorage` persistence | `state.js` `cetech-pos-preview-v1` | Survive refresh on `file://` | Not Dexie; can store session-like state; forbidden token/PII pattern | `CartDraftStore` + `OperationJournal` IndexedDB; HttpOnly session | WS3 local; WS1 consumes | PWA retention tests |
| Demo barcode shortcut chips | Sell toolbar | Easy A/E/unknown demos | Not a cashier control | Test helpers / docs only | WS1 tests | KB tests use real string barcodes |
| `window.print()` as ReceiptPort | `app.js` print-receipt | Browser print dialog | `dialog_opened` ≠ printed; mixed into receipt port | `PrintPort.print`; browser adapter allowed as fallback | WS3 PrintPort; WS1 receipt UI | FI; HW for device |
| Preview reset / last-resort wipe | `resetPreview` | Demo factory reset | Must not be routine Fix App | Non-destructive repair; last resort blocked if journal/critical ops | WS1 UX; WS3 | FI, PWA |

---

## WS3 integration requests / genuine ambiguities

Compare prototype `nextjs-handoff.md` / `frontend-contracts.ts` with **current v1**. Do not recreate obsolete prototype interfaces in WS1.

| Topic | Covered by current v1? | Replacement or gap | WS3 owner action | WS1 must not |
| --- | --- | --- | --- | --- |
| App route mounting `(auth)` / `(pos)/sell|orders|…` | Not a contract; CP-05 scaffold **not landed** | WS3 owns `apps/pos-web/src/app/**` composition; WS1 supplies renderable screens | Mount WS1 components when CP-05 exists | Create `src/app` routes |
| Contract/type reexports | Frozen in `docs/contracts/` | CP-05 should reexport `ports.ts` / `domain.generated.ts` into the app | Scaffold reexports | Copy competing types into features |
| `CartDraftStore` / `OperationJournal` | **Yes** as interfaces | Dexie implementation + versioned payload/hash/append-before-send | CORE-04 expose load/save/pending to UI | Invent localStorage or a WS1 schema |
| PWA / update / multi-tab / migration coordinator | `ReleasePolicy` yes; SW/lock **implementation** not a port | Supply view-model: update safety, migration state, passive window, build ids | CORE-07 | Own service worker / Dexie migrator |
| Prototype `SyncPort` (`syncCatalog` / `rebuildCatalogProjection`) | **No P0 SyncPort** (deliberate) | Catalog rebuild/repair is WS3 local/projection work; surface via Health/Fix App commands WS3 provides | Expose repair/rebuild *application* API if UI must trigger it; do not add Inventory/Sync ports for P0 | Recreate `SyncPort` in features |
| Prototype `InventoryPort` | **Superseded** | Quote advisory + prepare definitive | None — do not add | Request P0 InventoryPort |
| Order list / search / recent sales | **Not in v1 ports.** `ReceiptPort.getByTransaction` only; `SalesPort.resolve` is per-transaction | Genuine gap for Orders/Returns list UX | Provide a read model (BFF list by register/shift/receipt/reference) **or** confirm an existing projection WS1 may consume. WS3 owns the contract if one is added | Invent `OrderPort` locally |
| Device / printer / scanner / config port | **No DevicePort** | Compose Settings from `Session`, `Register`, `HealthPort`, `ReleasePolicy`, WS3-supplied device id/build | Supply device/register assignment + printer profile as config/session fields | Invent DevicePort |
| Prototype `PaymentPort.finalize` | **No.** Finalization is `CheckoutUseCases.finalize` → server `SalesPort.confirmPayment` | UI calls BFF finalize with `transactionId` + `paymentId` only | BFF FinalizeSale | Call `confirmPayment` from the browser |
| Prototype `PaymentPort.begin` / `cancel` | Partial: `initialize` / `resolve` / `confirmCash`; no UI payment cancel port | Cancel sale via `SalesPort.cancel` only when payment is authoritatively unsuccessful | Keep cancel rules server-side | Blind payment cancel |
| Prototype `ReceiptPort.create` / `reprint` | **No create/reprint on ReceiptPort** | Create on server at completion; reprint via `PrintPort` | Receipt uniqueness in CORE-05 | Client receipt counters |
| Prototype `IdentityPort.login(staffId)` | **No login on port** | BFF/OIDC session; `getSession` | CORE-02 | Demo staff picker as production auth |
| Prototype `HealthPort.getHealth()` service flags | Shape differs: `getStoreHealth(): StoreHealth` | Map UI cards to `HealthCheck[]` + counts + `contractVersion: "1.0.0"` | CORE-03 | Keep boolean demo `services` object as contract |
| Prototype `AttentionItem[]` port | **No AttentionPort** | Compose from journal + sale/payment/return/shift `requires_attention` + health counts | If a dedicated DTO is needed, WS3 adds it | Define AttentionPort in WS1 |
| Prototype `CheckoutBlockReason.PRICING_UNAVAILABLE` | Not on `CheckoutEligibility.reason` union | Use `QuoteState.failed` + `QUOTE_REQUIRED` / `CONNECTION_REQUIRED` messages | Optional additive contract later (not required to map UX) | Fork eligibility enum |
| Prototype `PreparedSale.providerOrderId` / status `reserved` | Replaced | Opaque `saleId`, `orderReference`, `status: "prepared"`, `stockCommitment` | Already frozen | Show “reserved” as inventory promise |
| Prototype quote without `cartId` / `locationId` / string qty | Replaced | `QuoteRequest` requires them | Already frozen | Send numeric qty or client totals |
| Return execution / restock wire | Types exist; **RT-01 UNRESOLVED** for bridge refund/restock endpoints | Keep UI states; do not execute unrestricted refunds | RT-01 | Assume restock on refund |
| `canCheckout.ts` in `core/application` (prototype handoff) | Eligibility **type** is v1; implementation owner is application layer | WS3 may own pure eligibility if it needs journal/shift; WS1 may map messages | Confirm in CP-05 whether helper lives in core vs feature | Duplicate incompatible reason codes |

No request is made for a standalone P0 InventoryPort, browser pricing engine, or prototype `PaymentPort.finalize`.

---

## Design / token mapping

Source: `artifact/design-tokens.md` + `artifact/styles.css`. **Do not choose a new brand palette.** No final CETECH palette was supplied; keep semantic names; values may later swap only via tokens.

### Semantic color tokens

`--color-bg`, `--color-surface`, `--color-surface-2`, `--color-surface-3`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-primary`, `--color-primary-hover`, `--color-primary-soft`, `--color-success`, `--color-success-soft`, `--color-warning`, `--color-warning-soft`, `--color-danger`, `--color-danger-soft`, `--color-info`, `--color-info-soft`.

Light and dark sets exist (`html[data-theme="dark"]`). Theme control in Settings: system / light / dark.

### Spacing scale

4px base: `--space-1` 4, `--space-2` 8, `--space-3` 12, `--space-4` 16, `--space-5` 20, `--space-6` 24, `--space-8` 32.

### Radius / elevation

`--radius-sm` 8px; `--radius-md` 12px; `--radius-lg` 18px; `--shadow-sm`; `--shadow-md`.

### Typography

Operational system/UI stack in CSS (`Inter, ui-sans-serif, system-ui, …`). Scale: XS 12 / SM 14 / MD 16 / LG 20 / XL 26 / 2XL 34. Receipt uses monospace. Weights 700–900 for amounts/primary labels only.

### Touch / Pay

`--touch: 44px` minimum control height. `.pay-btn` **54px** min-height, 18px font.

### Focus-visible

3px semantic primary ring, 2px offset, on buttons/inputs/selects/textarea/`[tabindex]`.

### Reduced motion

`prefers-reduced-motion: reduce` zeros animation/transition duration. No decorative transaction animation; toast + skeleton only.

### Breakpoints (behavioral)

| Width | Behavior |
| --- | --- |
| `>1050px` | Desktop / POS terminal; persistent rail; two-pane Sell |
| `821–1050px` | Tablet / compact desktop split; narrower cart; hide secondary cashier pill |
| `≤820px` | Phone: bottom nav, full-width products, sticky cart bar, full-screen cart, sheets |
| `≤480px` | Single-column products/tenders |
| `≤720px` | Orders tools stack (search/filter) |

### Desktop split vs phone cart

Desktop/tablet: `sell-layout` product left, `cart-panel` right (`--cart-width`). Phone: cart hidden until `mobile-open`; `.mobile-cart-bar` above bottom nav.

### Receipt print rules

`@media print` hides chrome; `.receipt-paper` visible; width **80mm**; `@page` auto/5mm margins. Disclaimer remains on the paper. Production may add a PrintPort device adapter later without restyling the snapshot.

Proposed token landing (planning only): `apps/pos-web/src/ui/tokens.css` (or equivalent CSS-variable layer) consumed by features. FE-02 owns conversion **after** CP-05.

Reference screenshots (immutable, not production proof): `artifact/verification-sell-desktop.png`, `verification-mobile-cart.png`, `verification-desktop.png`.

---

## Coverage checklist (FE-01 acceptance)

| Required item | Mapped |
| --- | --- |
| Every discovered approved reference screen (login through settings, all modals in `Modal()`) | Yes |
| Every A–K demo scenario | Yes |
| Every additional documented failure/recovery state in demo-scenarios “Other useful states” | Yes |
| Phone / tablet / desktop | Yes |
| Keyboard / scanner | Yes |
| Customer switching and quote invalidation | Yes (`mutateCart` / customer change) |
| Stale / out-of-order quote handling | Yes |
| Pending tender / reconciliation | Yes |
| Receipt vs printing corrected to ReceiptPort + PrintPort | Yes |
| Register / cash / variance | Yes |
| Offline browsing/draft limitations truthful | Yes |
| PWA update / recovery / multi-tab | Yes |
| Prototype → production contract corrections | Yes |
| Demo-only data/controls/persistence identified | Yes |
| Proposed paths respect WS1 vs WS3 ownership | Yes |
| Genuine WS3 requests without redesign | Yes |
| Approved reference bytes/hashes unchanged by this task | Yes (worktree from clean `origin/main`; no writes under `reference/`) |

### Inspected artifact files (read-only)

`reference/frontend-approved/README.md`, `MANIFEST.md`, `SHA256SUMS.json`; artifact `README.md`, `index.html`, `styles.css`, `js/app.js`, `js/components.js`, `js/state.js`, `js/mock-adapters.js`, `js/mock-data.js`, `frontend-contracts.ts`, `design-tokens.md`, `docs/frontend-spec.md` (no root `frontend-spec.md` in the 28-file snapshot), `screen-state-matrix.md`, `demo-scenarios.md`, `nextjs-handoff.md`, `cursor-handoff.md`, `frontend-decision-ledger.md`, `verification.md`, `PACKAGE-MANIFEST.txt`, and the three verification PNGs listed in the manifest.

### Explicit non-claims

This map does not implement FE-02. It does not create Next.js files. It does not assert pricing parity, RLS, payment settlement, stock reservation, physical print, installed-PWA behavior, or production readiness.

# Data ownership

Canonical ownership is per fact, including during partial failure. No duplicate master tables or hidden pricing engines.

| Fact | Current canonical owner | Derived/local state | Target |
| --- | --- | --- | --- |
| Products, variants, SKU, images, barcode source | Woo configuration (training development baseline: barcode source = SKU; production mapping is a cutover delta) | Catalog projection / local index | AIM PIM |
| Retail/tier prices, B2B groups and terms | Woo + configured WoodMart/B2BKing runtime | Display hints only | Pricing / Commercial Terms |
| Taxes, coupons and commercial discounts | Woo configured commerce/tax runtime | Historical accepted snapshots | Relevant commerce/tax owners |
| Customers and addresses | Woo customer record | Minimal masked lookup/cache | Customer domain adapter (target owner unresolved) |
| Stock and reservation/reduction | Woo where live stock mode proves it | Advisory availability only | Inventory/Order Orchestration |
| Commercial orders and refunds | Woo | Order read models / workflow links | Inventory/Order Orchestration |
| Electronic tender execution and settlement | Approved payment institution/provider | Verified payment evidence/workflow | MoneyMove execution; underlying provider references retained |
| Registers/devices/shifts/cash movements | POS in Supabase | Local UX view | Independent POS backend |
| POS workflow, audit and reconciliation | POS in Supabase | Device journal is unacknowledged intent | Independent POS backend |
| Operational receipt snapshot | POS immutable snapshot from completed sale | Local printable copy | Independent POS backend |
| Receipt product-name/SKU presentation settings | POS operational settings in Supabase | Cashier/manager UI later | Independent POS backend |
| Return intake / physical disposition intent | POS workflow; Woo applies authorized stock/commercial effects | Local draft only | POS + inventory/order adapter |
| Staff auth identity | Supabase Auth via IdentityPort | Session only | AccessLobby |
| POS authorization/configuration | POS server/Supabase | Capability display, not authorization | Independent POS backend |
| Cart drafts and pending local commands | Device-local Dexie (uncommitted intent) | Not a commercial sale | Local durable edge state |
| Statutory invoice | UNVERIFIED current process | Ordinary POS receipt is not this truth | Compliance owner integration must be decided |

Cash ledger writes are append-only: corrections require an approved reference to the original movement and an exact reversing effect; they do not edit history. Electronic payment evidence records observations; it does not become an independent payment execution authority. Receipt snapshots never recompute from current product/tax data, current catalog names/SKUs, or current receipt settings. Historical refunds use original line economics and separately approved stock disposition.

Local CORE-01 schema (`supabase/migrations`) owns POS operational tables only: organizations, locations, devices, registers, staff assignments, shifts, cash movements, pending operations, outbox events, and rebuildable integration watermarks. CORE-04 adds rebuildable `pos_catalog_items` as a trusted-server catalog/PIM projection (source ids, versions, tombstones, string barcodes). It is not a Woo/PIM master and not live inventory. REC-01 adds `pos_receipt_settings` as trusted-server POS operational receipt presentation settings (organization+location). Absence of a row means shortening off, max 40 characters, SKU hidden. It is not Woo/catalog truth. REC-01 also adds additive `pos_pending_operations.intent_snapshot` as the pre-effect `sale.prepare` command intent (sale-time presentation bound before `SalesPort.prepare`). The first non-null snapshot is immutable: later writers must read it, not replace or clear it. It is not `outcome`, not a fabricated `PreparedSale`, and not current catalog state. Device Dexie holds the cashier-facing catalog cache plus durable cart drafts and the operation journal. CORE-02 adds `pos_staff_sessions` as a POS-owned durable staff-session cache for the BFF; it is not a commerce table, not `pos_pending_operations`, and not IndexedDB. `anon`/`authenticated` have no session access; `service_role` there is infrastructure for the session store, not cashier authorization. It does not own products, Woo customers, price rules, WoodMart/B2BKing commercial rules, Woo orders, payment-provider settlement, or live Woo inventory. External references use provider-neutral identifiers and snapshots; there are no cross-database foreign keys. Expected cash is nonnegative contract Money; a movement that would make it negative is rejected by an atomic `UPDATE` of the open shift row (`expected_cash_minor = expected_cash_minor + signed_amount_minor`). Opening float initializes expected cash; the generated `opening_float` ledger row is already represented and is not added twice. Authenticated cashier cash kinds are `pay_in` / `pay_out` / `cash_pickup` / `correction` and require a reason; internal kinds `opening_float` / `cash_sale` / `cash_refund` are trusted-server only. Incompatible cash currency is rejected. Command idempotency is claimed only on `pos_pending_operations` as `organization_id + operation + idempotency_key`. Authoritative shift close / immutable Z orchestration is CORE-07; CORE-01 stores expected/count/variance, one-active-shift, closed-shift immutability, and non-deletable shift history only. The transactional outbox and integration watermarks are trusted-server surfaces; authenticated clients cannot select or insert them. Register/shift/cash SELECT remains location-scoped in CORE-01; finer cashier-versus-manager register operational-read distinction is deferred to CORE-02 because JWT capability/manager semantics are not frozen enough to guess a manager policy. Same-shift cash writers serialize on the expected-cash `UPDATE` row lock; a true two-session concurrency harness is recorded for CORE-05/QA-01 because pgTAP cannot safely orchestrate parallel sessions. Internal SECURITY DEFINER triggers are not authenticated RPC surfaces.

`service_role` bypasses RLS. That is a platform fact, not cashier/manager authorization. CORE-02+ server paths must authorize explicitly. `service_role` grants are least-privilege per table (no ordinary DELETE on operational history; cash is SELECT/INSERT only).

Training Woo (`WP_ENVIRONMENT_TYPE=staging`) is the current development integration baseline. The schema is environment-neutral and must not hard-code a hostname.

## Cutover deltas (production unknown)

These do not block local CORE-01 schema/RLS. Verify before real-money payments, live stock mutation, production deployment, or cutover.

| Fact | Training baseline | Production value | Affected capability | When it must be verified | Fallback / flag |
| --- | --- | --- | --- | --- | --- |
| Production DB fingerprint vs training | Staging DB fingerprint recorded in CP-04 evidence | unknown | Isolation / write-safety | Before live writes and cutover | Keep issue #4 OPEN; no production writes |
| Production mail routing | MailPoet active; admin-email domain matches public site domain (UNSAFE for staging write tests) | unknown | Notification side effects | Before staging write tests and cutover | Do not run live write tests until isolated |
| Production payment credentials / enabled gateways | Paystack plugin installed inactive; runtime gateways invoice + COD | unknown | Tender capture | Before real-money enablement | Feature-flag payments; do not design PaymentPort around the training gateway list |
| Production stock isolation | Woo `manage_stock=yes`; hold 60 minutes; observed `_backorders=no`; public `stockable=N` | unknown | Prepare / stock mutation | Before live stock mutation | Quote remains advisory; prepare is definitive later |
| Dataset sanitization | Training catalog/customers exist on staging | unknown | PII / fixture policy | Before any dataset copy | Synthetic fixtures only in POS tests |
| GRA fiscal process | UNVERIFIED | unknown | Statutory invoice | Before production fiscal enablement | Ordinary POS receipt is not statutory truth |
| Physical hardware | UNVERIFIED | unknown | Print / drawer / scanner | Before hardware certification | PrintPort remains a side-effect port |
| Live settlement | No enabled card/MoMo gateway on training | unknown | Settlement reconciliation | Before production payments | Provider-neutral PaymentPort later |
| HPOS / Woo version drift | HPOS on; custom-order tables authoritative; data-sync off; Woo 11.1.0 | unknown | Bridge adapter, not POS tables | Before production bridge cutover | Adapter/config; POS domain tables do not mirror HPOS |

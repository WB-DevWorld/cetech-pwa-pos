# Data ownership

Canonical ownership is per fact, including during partial failure. No duplicate master tables or hidden pricing engines.

| Fact | Current canonical owner | Derived/local state | Target |
| --- | --- | --- | --- |
| Products, variants, SKU, images, barcode source | Woo configuration (barcode mapping UNVERIFIED) | Catalog projection / local index | AIM PIM |
| Retail/tier prices, B2B groups and terms | Woo + configured WoodMart/B2BKing runtime | Display hints only | Pricing / Commercial Terms |
| Taxes, coupons and commercial discounts | Woo configured commerce/tax runtime | Historical accepted snapshots | Relevant commerce/tax owners |
| Customers and addresses | Woo customer record | Minimal masked lookup/cache | Customer domain adapter (target owner unresolved) |
| Stock and reservation/reduction | Woo where live stock mode proves it | Advisory availability only | Inventory/Order Orchestration |
| Commercial orders and refunds | Woo | Order read models / workflow links | Inventory/Order Orchestration |
| Electronic tender execution and settlement | Approved payment institution/provider | Verified payment evidence/workflow | MoneyMove execution; underlying provider references retained |
| Registers/devices/shifts/cash movements | POS in Supabase | Local UX view | Independent POS backend |
| POS workflow, audit and reconciliation | POS in Supabase | Device journal is unacknowledged intent | Independent POS backend |
| Operational receipt snapshot | POS immutable snapshot from completed sale | Local printable copy | Independent POS backend |
| Return intake / physical disposition intent | POS workflow; Woo applies authorized stock/commercial effects | Local draft only | POS + inventory/order adapter |
| Staff auth identity | Supabase Auth via IdentityPort | Session only | AccessLobby |
| POS authorization/configuration | POS server/Supabase | Capability display, not authorization | Independent POS backend |
| Cart drafts and pending local commands | Device-local Dexie (uncommitted intent) | Not a commercial sale | Local durable edge state |
| Statutory invoice | UNVERIFIED current process | Ordinary POS receipt is not this truth | Compliance owner integration must be decided |

Cash ledger writes are append-only: corrections reference original entries. Electronic payment evidence records observations; it does not become an independent payment execution authority. Receipt snapshots never recompute from current product/tax data. Historical refunds use original line economics and separately approved stock disposition.

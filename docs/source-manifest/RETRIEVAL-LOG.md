# Recovery log — 27 distinct dimensions

Performed 2026-09-11, before repository structure creation. Each pass ran a separate case-insensitive ripgrep query across S1, the extracted S2 handoff and S3 Markdown. Hit count is retrieval evidence, not proof of a decision. Context rereads included S1 44590–44735, 44930–45045; prototype contracts/ledger/handoff and Transfer Kit methods. Current S0 resolves remaining ambiguities.

| Pass | Dimension / query | Hits | Reconciled finding |
| --- | --- | --- | --- |
| 01 | Current architecture: `Next.js BFF / Next BFF / 60.hour / canonical architecture` | 161 | Next PWA/BFF, 60-hour transition |
| 02 | Transition versus target: `NestJS / Medusa / Vendure / transitional architecture` | 125 | NestJS target only; Medusa/Vendure superseded |
| 03 | Data ownership: `canonical owner / operational truth / duplicate commerce` | 85 | Woo commerce versus Supabase operations |
| 04 | Frontend architecture: `feature modules / frontend architecture / src/features / provider.neutral` | 66 | Provider-neutral features/use cases/adapters |
| 05 | Prototype handoff: `immutable / redesign / production conversion / approved frontend` | 141 | Preserve immutable reference, fix production contract gaps |
| 06 | WooCommerce integration: `HPOS / WooCommerce runtime / isolated.*cart / WC_Cart` | 87 | Isolated Woo quote and HPOS-safe CRUD required |
| 07 | WoodMart pricing: `WoodMart.*tier / WoodMart.*pricing / quantity.*discount` | 129 | WoodMart configured tier behavior controls prices |
| 08 | B2BKing pricing: `B2BKing.*pricing / customer.specific pricing / group.*pricing` | 137 | B2B context resolved server-side; overlap must be proven |
| 09 | Supabase operations: `Supabase.*own / registers.*shifts / RLS` | 86 | Operational tables/RLS, no duplicate commerce master |
| 10 | IndexedDB and PWA: `Dexie / IndexedDB / offline.*draft` | 179 | Dexie local projections/drafts/journal, not canonical settlement |
| 11 | Payments: `PaymentPort / SalesPort / PAYMENT_PENDING / cash.*confirm` | 148 | PaymentPort separate; explicit sale finalization required |
| 12 | Registers shifts cash: `close.*shift / cash movements / opening float` | 162 | Append-only cash, blind count, X/Z snapshots |
| 13 | Idempotency reconciliation: `idempotency / reconciliation / OperationJournal` | 574 | Durable idempotency; unknown result resolved before retry |
| 14 | Security: `service.role / server.only / privileged / independent.*recovery` | 89 | No browser secrets; server authorization and independent recovery |
| 15 | PWA update recovery: `Update ready / skipWaiting / clear.*IndexedDB / non.destructive` | 59 | Non-destructive repair and safe activation required |
| 16 | CI/CD: `GitHub Actions / required.*check / pnpm / deployment` | 162 | Incremental CI; no nonexistent app checks |
| 17 | Git collaboration: `staging branch / protected.*main / worktree / CODEOWNERS` | 83 | Protected main intent, short-lived branches; no explicit staging branch requirement |
| 18 | Cursor workflow: `allowed files / forbidden files / \.mdc / AGENTS.md` | 102 | Path scoped rules, bounded tasks, evidence handoff |
| 19 | Multi-agent coordination: `parallel.*agent / central.*file / migration.*owner / shared.*lock` | 21 | One editor per central file; worktree isolation |
| 20 | Authority hierarchy: `approved ADR / source.of.truth / superseded / private.*memory` | 106 | Latest approved repository decisions outrank history/memory |
| 21 | Testing release: `pricing parity / negative.*test / release gate / failure injection` | 53 | Pricing/RLS/failure/release evidence gates |
| 22 | VitePOS cutover: `VitePOS.*queue / VitePOS.*stock / cutover / rollback` | 374 | Drain queues, verify stock mode, staged reversible cutover |
| 23 | Transfer Kit: `Audit first / audit.*remediation / kit_version / v1.0.1` | 15 | Reuse upstream methodology; do not clone general kit |
| 24 | Workstream ownership: `Developer 1 / Developer 2 / Workstream 3 / WS.01` | 6 | Exactly three roles assigned by S0; identities unresolved except live senior |
| 25 | Existing implementation plans: `critical path / Hour [0-9] / H0 / IMPLEMENTATION.PLAN / 60.HOUR` | 155 | Pricing-first critical path; budget time for failure/rehearsal |
| 26 | Unresolved live facts: `UNVERIFIED / printer model / barcode source / PHP version / GRA` | 892 | Live versions, tax, hardware, stock and provider remain UNVERIFIED |
| 27 | Adapter replacement contracts: `InventoryPort / PrintPort / replace adapters / AccessLobby / MoneyMove` | 180 | No standalone P0 InventoryPort; PrintPort split; adapters replaceable |

Additional targeted contextual reads addressed stock prepare/race recovery, refund/restock separation, source timestamps, prototype checksums, and GitHub live reality. Search results were not treated as current implementation evidence.

# Decision register

Current baseline established 2026-09-11 under explicit bootstrap authorization. Status is design authority, not deployment evidence.

| ID | Decision | Status | Date | Rationale | Supersedes | Contracts | Workstreams |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ADR-001](ADR/001.md) | Immediate Next BFF transition | TRANSITIONAL | 2026-09-11 | Immediate production objective without cashier rewrite. | Older generic ecosystem stack recommendations as P0 dependencies | All ports | WS1/2/3 |
| [ADR-002](ADR/002.md) | Canonical data and module ownership | CURRENT | 2026-09-11 | Single canonical owner per fact and recoverable projections. | Any historical duplicate-master suggestion | All domain contracts | WS1/2/3 |
| [ADR-003](ADR/003.md) | Freeze v1 wire and application contracts | CURRENT | 2026-09-11 | Prevent three incompatible implementations and preserve source UX. | Prototype types where mapped in PROTOTYPE-MAPPING.md; older InventoryPort P0 suggestions | Money, Quantity, Quote, SalesPort, PrintPort, envelope, journal | WS1/2/3 |
| [ADR-004](ADR/004.md) | Tender verification and commercial finalization | CURRENT | 2026-09-11 | A charge/order/receipt cannot be retried blindly after a timeout. | Prototype omission of explicit finalizer and mixed tender/sale completion states | PaymentPort, SalesPort, VerifiedPaymentEvidence, ReceiptPort | WS1/2/3 |
| [ADR-005](ADR/005.md) | Safe local state and PWA lifecycle | CURRENT | 2026-09-11 | Protect unsynced business intent and truthful customer promises. | Full offline completion claim or destructive routine reset | OperationJournal, ReleasePolicy, QuoteState | WS1/2/3 |
| [ADR-006](ADR/006.md) | Immutable approved frontend | CURRENT | 2026-09-11 | Design fidelity and one reference without divergent copies. | Independent conversions/redesign of duplicated archives | PROTOTYPE-MAPPING; frontend features | WS1/2/3 |
| [ADR-007](ADR/007.md) | Three workstreams and single-editor core | CURRENT | 2026-09-11 | Reduce central conflicts for three developers/AI accounts. | Unnecessary permanent branch trees and competing migrations | All shared configuration/contracts | WS1/2/3 |
| [ADR-008](ADR/008.md) | Pricing and idempotent preparation gate | TRANSITIONAL | 2026-09-11 | Protect both online and POS commercial truth. | Raw product prices as checkout authority; assumed reservation behavior | Quote, PreparedSale, SaleResolution | WS1/2/3 |
| [ADR-009](ADR/009.md) | Evidence-based release and VitePOS cutover | CURRENT | 2026-09-11 | Correctness over feature count and recoverable operations. | Prototype-only readiness or automatic deactivation | Release gates and all enabled capabilities | WS1/2/3 |
| [ADR-010](ADR/010.md) | Toolchain and capability scope | CURRENT | 2026-09-11 | Avoid bloat and lockfile races while keeping adapters replaceable. | Mandatory heavyweight monorepo/microservices in P0 | Toolchain, environment, capability config | WS1/2/3 |
| [ADR-011](ADR/011.md) | Training development baseline; operation-specific CP-04 gates | CURRENT | 2026-09-12 | Unblock local implementation while retaining remote-write/release evidence | Blanket CORE-01 block on full production isolation/fingerprint comparison | Environment/dependency policy; v1 unchanged | WS1/2/3 |
| [ADR-012](ADR/012.md) | Milestone batching, bounded continuation and exactly two freshness passes | CURRENT decision; R1 merge activates team-wide | 2026-09-12 | Reduce interruptions with executable checks and bounded drift correction | Only ADR-007 cadence / old single-task stop clauses; ten is a review budget | Workflow/handoff only; v1 unchanged | WS1/2/3 |

| Fact/proposal | Status | Controlling treatment |
| --- | --- | --- |
| Medusa/Vendure as urgent POS backend | SUPERSEDED | ADR-001; no current implementation |
| NestJS independent backend / AccessLobby / MoneyMove / AIM PIM / Inventory Orchestrator | TARGET | Future adapter migration, not sprint infrastructure |
| Standalone P0 InventoryPort | SUPERSEDED | ADR-003; quote/prepare handle immediate availability |
| Performance budgets | PROPOSED | Measure then lead records acceptance or revision |
| Staging runtime versions / URL | User-reported evidence, 2026-09-12 | CP-04/live facts preserve provenance; no independent runtime test implied |
| Stock mode, payment execution/settlement, tax, hardware | UNVERIFIED | CP-04/live facts; payment methods user-confirmed in use |
| Repository visibility and developer access | CURRENT operational fact, 2026-09-12 | User made repo public; GitHub confirms public visibility and both developer write permissions; supersedes private bootstrap default |
| Refund bridge execution wire endpoints | UNRESOLVED for M2 execution | RT-01 explicit refinement before implementation |
| Multi-stock/fully offline/split tender scope | PROPOSED future capabilities | Disabled/deferred unless new approved decision |

New ADRs require rationale, date, status, supersedes, affected contracts/owners and compatibility/evidence. Preserve history; do not overwrite accepted decisions to hide changes.

# Target independent POS peer

Status: TARGET, not implemented here. Independently useful/deployable POS with a backend/PostgreSQL and stable domain contracts. NestJS is a future backend option under ecosystem standards, not required in this sprint.

| Transitional dependency | Future owner/adapter |
| --- | --- |
| Woo catalog | AIM PIM |
| Woo + WoodMart + B2BKing pricing | Pricing / Commercial Terms |
| Woo stock and commercial orders | Distributed Inventory / Order / Fulfillment Orchestration |
| Direct approved payment provider | MoneyMove |
| Supabase staff auth | AccessLobby |
| Supabase POS operational persistence | Independent POS backend/PostgreSQL |

Migration order: implement alternate adapter; replay contract/semantic tests; backfill mappings and projections; compare read outcomes; shadow non-mutating operations; controlled single-writer cutover; preserve historical provider references and rollback route. Never dual-execute charges/orders during comparison. No cross-peer DB foreign keys, shared tables or mandatory ecosystem-wide deployment. Peers are consumed like external providers. Add separate inventory capability only when a concrete use case warrants a new ADR/version.

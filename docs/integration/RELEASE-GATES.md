# Release gates

Resolve the applicable [CP-04 production deltas](../runbooks/CP-04-REMAINING-WORK.md) before enabling the affected production capability. Their deferral from local development under ADR-011 is not release approval.

All enabled production capabilities must pass; human release approval is a separate final gate.

- Actual Woo/WoodMart/B2BKing pricing/tax parity; no unexplained stock discrepancy or duplicate order.
- Cash/electronic pending/failed/late/duplicate payment and refund reconciliation; no double charge/refund/restock.
- RLS negative tests and BFF scope checks including elevated-adapter path; no browser secret exposure.
- Register open/cash movements/blind close/variance/X/Z idempotency and concurrency.
- Actual installed PWA update, skipped-version/local-schema migration, offline drafts/journal and non-destructive recovery.
- Actual hardware/printing; operational receipt distinguished from verified current statutory invoicing process.
- Backup restore demonstrated in isolation; rollback preserves subsequent real transactions.
- All VitePOS devices' queues/shifts and stock mode checked; pilot avoids competing POS writers.
- Observability/reconciliation queue/independent recovery contacts and staff runbook ready.

Record exact commit/config, dates, evidence and signoff. A duplicate money/stock effect, privilege bypass, lost intent, destructive recovery or statutory process gap is NO-GO. No runtime evidence exists at bootstrap.

# WS3 current handoff — STG-01 integration composition

Kind: PROGRESS_CHECKPOINT. Date: 2026-09-17.

Task / batch / workstream: STG-01 / #70 / WS3.
Owner / integration editor: `@wbdevworld` / WS3.
Mode: INTEGRATE.
Branch: `batch/stg-01-staging-runtime-acceptance`
Starting exact head: `acd4a2f009c58f734186cf9e44f278da93499a4b`
Start `origin/main`: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`

This file is the integration snapshot. It does not erase STG-02 or STG-04 contributor evidence files.

## Combined semantics

- Staff: restore/establish BFF session; CSRF cookie + `x-csrf-token`; cashier/register/shift from server; fail closed when unsigned/expired.
- Catalog: staging `provider_required` never seeds `CASHIER_SEED_CATALOG`; BFF `/api/pos/v1/catalog/sync`; local search/scan; stale/unavailable without clearing carts/journal.
- Bridge: imported STG-05 producer; training deploy still pending.

Contracts changed: none. Database migrations: none. Architecture decisions: none.

Do not merge to main. Do not close #70/#25/#54. Do not merge R9 #63. Independent human review required.

## Previous contributor handoff — STG-02 session/CSRF/register composition

Kind: TASK_COMPLETION. Date: 2026-09-17.
Branch: `ws3/stg-02-session-runtime-composition`
Source SHA: `8a6aba2ce82ebe265a154f89999c2caab7a08beb`
Evidence: `docs/integration/evidence/STG-02-SESSION-RUNTIME.md`

## Previous contributor handoff — STG-04 training catalog projection

Kind: TASK_COMPLETION. Date: 2026-09-17.
Branch: `ws3/stg-04-training-catalog-projection`
Source SHA: `01e4438d3553c633e7b0234de44743ff4cea2368`
Evidence: `docs/integration/evidence/STG-04-TRAINING-CATALOG.md`
STG-04 `CURRENT-WORK.md` was not imported.

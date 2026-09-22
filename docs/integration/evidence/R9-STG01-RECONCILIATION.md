# R9 reconciliation onto accepted STG-01

Date: 2026-09-19

## Authority

- Canonical protected main: `c320be8c5ad41c190200381cd52f853dd95212dc` (accepted STG-01 / PR #77).
- Prior R9 source head: `f9317467207b5a45eb7e3a4512b145b21d262240`.
- STG-01 remains authoritative on staff/session, catalog/customer projection, Sell/payment UX, Orders/Customers/Returns/Register/System-status workspaces, attention recovery, and current cashier language.
- R9 remains authoritative only for CORE-07 PWA lifecycle/recovery and operational-close behavior that is compatible with the accepted runtime.

## Semantic reconciliation

The replacement candidate preserves:

- server-driven installed-client update discovery through ReleasePolicy;
- root-mounted PWA lifecycle across the existing PosSessionProvider;
- controlled waiting-worker activation;
- lifecycle lease and final safety recheck;
- durable cross-tab tender marker;
- non-destructive local recovery diagnostics;
- manifest/offline shell/service worker;
- fail-closed operational close with immutable one-per-shift Z evidence;
- R8 variance authority: non-zero variance remains `requires_attention`, no close/Z, no invented approval authority.

The replacement candidate also extends tender protection to the current STG-01 electronic paths:

- payment initialize marks tender activity before provider presentation;
- cash confirmation and payment resolution retain the marker;
- sale resolve clears only on terminal outcome;
- sale cancel marks activity and clears only when terminal;
- finalize clears only on terminal completed/cancelled outcome.

## Superseded R9 presentation

The old duplicate FE-07 `features/health/**` / `app/health/health-runtime.tsx` screen is intentionally not carried forward. STG-01 already owns the accepted operational System-status workspace.

R9 recovery is integrated into that workspace instead:

- saved carts / pending work / attention counts are read non-destructively;
- pending work blocks destructive repair and app-update activation;
- check-for-update is available from System status;
- the shared root lifecycle owns the approved Update-ready dialog;
- cashier-facing terminology follows the current language standard.

Historical R9-R8 evidence remains retained as provenance, not current candidate acceptance.

## Still required

This reconciliation is source preparation only until all of the following pass on the exact replacement head:

1. Linux + Windows CI;
2. fresh independent exact-head review;
3. installed supported-client build A → deployed B → waiting B → safety-gated activation;
4. reconnect with unacknowledged durable work preserved and resolved before retry;
5. real multi-tab tender-in-progress blocking / lifecycle lease evidence;
6. staging operational-close migration/runtime verification;
7. final ADR-012 two-pass freshness after code and runtime evidence are frozen.

No production promotion, live electronic charge, real refund/restock, or VitePOS cutover is authorized.

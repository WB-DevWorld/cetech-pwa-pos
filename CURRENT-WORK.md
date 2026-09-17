# Current work ledger

Updated 2026-09-17. Canonical repo `WB-DevWorld/cetech-pwa-pos`. Historical scheduler detail remains in Git/PR/evidence history. This file controls current assignment and implementation authority.

## Current authority

- `main`: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` — squash-merged `[R8] Safe returns and payment/register states (#69)`. Protected.
- R7 remains `1feb78db36f33e0254c0170396f30112d71577ea`. R6 remains `bd79c2901ce33c3177141d4244cc196be0a719d2`.
- ADR-012, ADR-014 and accepted ADR-015 are active; ownership-preserving milestone execution remains required.
- Issue #4 remains **OPEN**. `pricingParityVerified=false`. Production promotion is not authorized.
- Live Paystack / live electronic payment is not authorized. Live refund/restock is not authorized. VitePOS remains active.
- R9 is **not** imported. Do not merge R9 #63. Do not start R10.
- STG-01 staging-runtime acceptance remains the active milestone. Do not close #70, #25, or #54.

```text
human: @wbdevworld
workstream: WS3
mode: IMPLEMENT
task: STG-04 / issue #73 — training Woo catalog projection
```

## STG-01 continuation (do not restart)

Milestone integration branch remains `batch/stg-01-staging-runtime-acceptance` (STG-02 + STG-04 + STG-05 + Ben meet later). This contributor branch implements only STG-04.

- STG-04 branch: `ws3/stg-04-training-catalog-projection`
- STG-04 start SHA: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`
- STG-05 producer (consume contract only, do not cherry-pick): `ws2/stg-05-training-bridge-runtime` `4d549167f7d6dcecf0eff24f35e1f24a3429d3d8` (exact-head CI `35232630899` Linux+Windows SUCCESS)
- STG-02 ready but isolated: `8a6aba2ce82ebe265a154f89999c2caab7a08beb` — do not cherry-pick onto this branch

## Active assignment — STG-04 / #73

Replace synthetic cashier seed with a provider-derived training Woo catalog projection in staging.

- Allowed: `apps/pos-web/src/core/catalog/**`, `apps/pos-web/src/server/**`, `apps/pos-web/src/local/**`, `apps/pos-web/src/app/api/**` catalog sync composition, `tests/integration/sync/**`, bounded WS3 handoff/evidence.
- Forbidden: `wordpress/**`; STG-02/STG-05 cherry-picks; B2BKing/WoodMart pricing in CatalogPort; silent staging fallback to `CASHIER_SEED_CATALOG`.
- Training plugin `0.6.0-stg05` is **not** deployed. Live `GET /catalog` → `rest_no_route` is `BLOCKED_TRAINING_PLUGIN_NOT_DEPLOYED_STG05`, not an STG-04 code failure.
- Do not merge this branch. Do not close #73, #70, #25, or #54.

Evidence: `docs/integration/evidence/STG-04-TRAINING-CATALOG.md`.

## R8 closure (historical)

R8 PR #69 was squash-merged to `main` as `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`. That SHA is the STG-04 starting baseline. Prior R8 remediation evidence remains `docs/integration/evidence/R8-REVIEW-REMEDIATION.md`.

## R7 — merged to protected main (historical)

PAY-01 / #26 and integration issue #57 closed by squash merge of PR #58 as `1feb78db36f33e0254c0170396f30112d71577ea`.

## Safety boundaries retained

- No production mutation, promotion, or VitePOS deactivation is authorized.
- No live Paystack/provider refund or live electronic payment is authorized.
- Authoritative prices remain quote-time `POST /quotes`. Catalog projection has no prices.
- Issue #4 remains OPEN. `pricingParityVerified` remains false.

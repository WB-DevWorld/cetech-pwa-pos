# WS3 current status

Snapshot 2026-09-17. Protected `main` `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` is accepted/merged R8 PR #69. STG-01 / #70 is the active P0 recovery gate on `batch/stg-01-staging-runtime-acceptance`. R9 PR #63 must not merge while STG-01 is open.

## STG-01 integration (active)

Mode: INTEGRATE. Owner `@wbdevworld` / WS3. Integration base `acd4a2f009c58f734186cf9e44f278da93499a4b`.

Imported contributor sources (provenance recorded in CURRENT-WORK after combined composition):

| Task | Source SHA | Classification |
| --- | --- | --- |
| STG-02 / #71 | `8a6aba2ce82ebe265a154f89999c2caab7a08beb` | staff session/CSRF/register authority |
| STG-05 / #74 | `4d549167f7d6dcecf0eff24f35e1f24a3429d3d8` | WS2 catalog producer `GET /catalog` |
| STG-04 / #73 | `01e4438d3553c633e7b0234de44743ff4cea2368` | BFF catalog sync / staging refuses synthetic seed |

Composition rule: mounted POS keeps STG-02 staff authority **and** STG-04 catalog authority. STG-04 contributor `CURRENT-WORK.md` was not accepted onto this integration ledger.

`BLOCKED_TRAINING_PLUGIN_NOT_DEPLOYED_STG05` remains. Do not claim live catalog/quote/cash-sale PASS. Do not close #70/#25/#54. Do not merge. Do not start R10.

## R8 (historical / accepted on main)

PR #69 squash-merged as `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`. Production, live Paystack, live refund/restock, and VitePOS deactivation remain NOT AUTHORIZED.

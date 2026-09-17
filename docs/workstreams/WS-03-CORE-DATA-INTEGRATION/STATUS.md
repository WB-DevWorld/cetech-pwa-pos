# WS3 current status

Snapshot 2026-09-17. Protected `main` `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` is accepted/merged R8 PR #69. STG-01 is the active staging-runtime milestone. STG-04 / #73 is the current WS3 contributor task.

## STG-04 (active)

Mode: IMPLEMENT. Owner `@wbdevworld` / WS3. Branch `ws3/stg-04-training-catalog-projection` from `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`.

| Role | SHA / classification |
| --- | --- |
| Current `main` / accepted R8 | `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` ACCEPTED / MERGED |
| STG-04 start | `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` |
| STG-05 producer contract (not imported) | `4d549167f7d6dcecf0eff24f35e1f24a3429d3d8` PROVISIONAL_TEST / contract-only |
| STG-02 (not imported) | `8a6aba2ce82ebe265a154f89999c2caab7a08beb` isolated |

Staging refuses synthetic `CASHIER_SEED_CATALOG`. Local/test/demo may still seed. Live training `/catalog` is `rest_no_route` until plugin `0.6.0-stg05` is deployed (`BLOCKED_TRAINING_PLUGIN_NOT_DEPLOYED_STG05`). Do not close #73/#70/#25/#54. Do not merge. Do not start R10. Do not merge R9 #63.

## R8 (historical)

PR #69 squash-merged as `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`. R9 is not imported.

## Remaining disposition

Push STG-04 exact tested SHA. Independent review later on `batch/stg-01-staging-runtime-acceptance`. Production, live Paystack, live refund/restock, and VitePOS deactivation remain NOT AUTHORIZED. Issue #4 remains OPEN.

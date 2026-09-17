# WS3 current status

Snapshot 2026-09-17. Protected `main` `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` is accepted/merged R8 PR #69. STG-01 / #70 is the active P0 recovery gate on `batch/stg-01-staging-runtime-acceptance`. R9 PR #63 must not merge while STG-01 is open.

## STG-01 integration (active)

Mode: INTEGRATE. Owner `@wbdevworld` / WS3. Integration base `acd4a2f009c58f734186cf9e44f278da93499a4b`.

Imported contributor sources (provenance recorded in CURRENT-WORK):

| Task | Source SHA | Imported SHA | Classification |
| --- | --- | --- | --- |
| STG-02 / #71 | `8a6aba2ce82ebe265a154f89999c2caab7a08beb` | `9bfb535ca86f7bd27108b3a82c6876e4b5f19c81` | staff session/CSRF/register authority |
| STG-05 / #74 | `4d549167f7d6dcecf0eff24f35e1f24a3429d3d8` | `7cab23415d622cef7369ddc03e007e6576cc4ce7` | WS2 catalog producer `GET /catalog` |
| STG-04 / #73 | `01e4438d3553c633e7b0234de44743ff4cea2368` | `981722e7c8ff6ea7163532f03218f59ea2b9e20d` | BFF catalog sync / staging refuses synthetic seed |
| STG-03 / FE-07 | `169f8155fe4cb34b6fe27db3bb6b445a13ade712` | `8073ef59dbf481160387000886b0b7da4a25d237` | WS1 presentation; WS3 mounts |
| STG-07 / #76 | `4a978b9a67291c34c34f6cb75fddf31d14a7cbdd` | same | CD summary quoting only |

Mounted routes: `/sell` `/orders` `/customers` `/returns` `/register` `/health` `/attention` `/settings`. Generic R4 placeholder is gone for those paths. Combined local tests are green except Windows `supabase db reset` (cmd.exe heredoc) and GNU Make `command -v` (Docker PHP lint + host PHP runners used).

Composition rule: mounted POS keeps STG-02 staff authority **and** STG-04 catalog authority. STG-04 contributor `CURRENT-WORK.md` was not accepted onto this integration ledger.

`BLOCKED_TRAINING_PLUGIN_NOT_DEPLOYED_STG05` remains. Do not claim live catalog/quote/cash-sale PASS. Do not close #70/#25/#54. Do not merge. Do not start R10.

## R8 (historical / accepted on main)

PR #69 squash-merged as `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`. Production, live Paystack, live refund/restock, and VitePOS deactivation remain NOT AUTHORIZED.

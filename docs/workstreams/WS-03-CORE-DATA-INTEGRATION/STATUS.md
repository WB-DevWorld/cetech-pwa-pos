# WS3 current status

Snapshot 2026-09-19. Protected `main` `c1f659ea118a885180fe6a543797efa908abf210` (PR #81 merged). Controlling assignment for this checkout is REC-01 main-reconciliation in CURRENT-WORK.md. This does not permanently alter OWNERSHIP.md.

## Active contributor assignment (this checkout)

Mode: IMPLEMENT / INTEGRATE. Owner `@wbdevworld` / WS3.
Task: REC-01 — reconcile exact-SHA Preview main into immutable receipt snapshots.
Branch: `ws3/receipt-product-name-sku` / PR #80.
Previous REC-01 head: `7e9da309bddbccdabf41b8ba753351e8697041d9`.
New main parent: `c1f659ea118a885180fe6a543797efa908abf210`.
Zero changed-file overlap with PR #81; REC-01 source unchanged by the two-parent merge.
Independent reviewer: `@Ben-001-sys` on the replacement exact head. Do not review obsolete `7e9da309...`. `@Emmanuel-coder-prog` is unavailable and is not requested.
Do not merge #80. Do not dispatch Exact SHA Preview. Do not create a Woo sale.

## Prior assignment (CD-01 exact-SHA Preview, merged)

Mode: IMPLEMENT / INFRASTRUCTURE SECURITY REMEDIATION. Owner `@wbdevworld` / WS3.
Branch: `ws3/exact-sha-preview` / PR #81, squash-merged as `c1f659ea118a885180fe6a543797efa908abf210`.
Preview dispatch remains a later authorized action after Ben exact-head approval of reconciled REC-01.

## Prior snapshot 2026-09-18 (retained)

Protected `main` `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` is accepted/merged R8 PR #69. STG-01 / #70 remains the active P0 recovery gate. R9 PR #63 must not merge while STG-01 is open.

## Prior contributor assignment (STG-06, retained)

Mode: REMEDIATE. Owner `@wbdevworld` / WS3.
Branch: `ws3/stg-06-quote-identity-register-authority` from exact start `a02cd21875d0717adb6694d293b41575302b2415`.
Scope: persist rebuildable `pos_catalog_items` during catalog sync; translate POS quote IDs to Woo source IDs server-side; preserve last-known register/shift on transient refresh failure; related quote URL, shift-open idempotency, register error, rebuild-catalog observability. Implementation SHA `5119054a2059ff5903a50d8b96644b63c38fdd48`. Freshness FRESH_2; not imported into `batch/stg-01-staging-runtime-acceptance` from this status file. Do not merge.

## STG-01 integration (active, not this branch)

Mode: INTEGRATE. Owner `@wbdevworld` / WS3. Integration base `acd4a2f009c58f734186cf9e44f278da93499a4b`. Combined candidate SHA observed at STG-06 freshness cutoff: `a02cd21875d0717adb6694d293b41575302b2415` (previously recorded `4e47a1f793bb8b75f6cf4fa03ee8f66675b4a897`).


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

STG-05 plugin is deployed on training Woo; authenticated bridge health/catalog/quote are verified (product 14985 equal 3000 GHS minor totals prove customer-context routing, not B2B parity). `BLOCKED_TRAINING_PLUGIN_NOT_DEPLOYED_STG05` is not current truth. Live Preview catalog is blocked by BFF service-identity denial (`bridge denied the BFF service identity`). Cash-sale acceptance is pending. `pricingParityVerified=false`. CP-04 / issue #4 remains OPEN. Do not close #70/#25/#54. Do not merge. Do not start R10.

## R8 (historical / accepted on main)

PR #69 squash-merged as `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`. Production, live Paystack, live refund/restock, and VitePOS deactivation remain NOT AUTHORIZED.

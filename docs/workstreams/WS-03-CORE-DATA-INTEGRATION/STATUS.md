# WS3 current status

Snapshot 2026-09-20. Protected `main` `c49045dd02c46574af5d341cc65c177116fa7306` (PR #79 / R10 Prep squash-merged). R10 Prep is MERGED / PREPARATION COMPLETE. QA-01 / #29 and REL-01 / #30 remain OPEN. Production remains unauthorized. Current active task is PR #63 R9 reconciliation / runtime qualification. Closeout `cf78330f2c5f1b9b8d231aad5b7bdc9a24e2d731` is consumed as an R9 ancestry parent and is not separately merged to main. This does not permanently alter OWNERSHIP.md.

## Active contributor assignment (this checkout)

Mode: RECONCILE / RUNTIME QUALIFICATION. Owner `@wbdevworld` / WS3.
Task: R9 — PWA recovery, operational close, update safety and genuine installed-client evidence.
Branch: `batch/r9-pwa-recovery-operational-close` / PR #63 (DRAFT).
Previous R9 head: `5592c29ca5a74ca59d7684ccf1a376ae10b37a13`.
Current main: `c49045dd02c46574af5d341cc65c177116fa7306`.
R10 closeout consumed: `cf78330f2c5f1b9b8d231aad5b7bdc9a24e2d731`.
Independent reviewer: `@Ben-001-sys` CHANGES_REQUESTED on `51c2c9bf...` (SHA BUILD_ID minimum-version deadlock). Current slice is that bounded review-fix. `@Emmanuel-coder-prog` is UNAVAILABLE / NOT REQUESTED.
Do not implement #82–#88. Do not close #29 or #30. Do not self-merge. Keep #63 DRAFT. Do not start installed-device evidence until Ben confirms the source fix.

## Prior assignment (R10 Prep closeout, consumed into R9)

Mode: CLOSEOUT. Owner `@wbdevworld` / WS3.
Task: Record PR #79 squash-merge and leave R9 / #63 as the next active task.
Branch: `ws3/r10-prep-close`.
Merged PR: #79. Source SHA: `bb35b8790e1370bc1b0aed6f39fc73c92549019a`. Resulting main: `c49045dd02c46574af5d341cc65c177116fa7306`.
Independent reviewer of #79: `@Ben-001-sys`. `@Emmanuel-coder-prog` is UNAVAILABLE / NOT REQUESTED.
This closeout did not edit PR #63. R9 now consumes it as ancestry.

## Prior assignment (R10 Prep, merged / preparation complete)

Mode: RECONCILE / QUALIFICATION PREPARATION. Owner `@wbdevworld` / WS3.
Task: R10 Prep — reconcile QA/release qualification framework onto accepted REC-01 main.
Branch: `ws3/r10-qa-release-preparation` / PR #79, squash-merged as `c49045dd02c46574af5d341cc65c177116fa7306`.
Source SHA: `bb35b8790e1370bc1b0aed6f39fc73c92549019a`.
Main CI: `35512758174` SUCCESS (Linux `control-plane` + Windows `control-plane-windows`).
Staging CD: `35512916881` SUCCESS — immutable URL `https://cetech-pos-staging-fgzk1bb00-wbdevworlds-projects.vercel.app`. Ordinary staging delivery is not R9 evidence.

## Prior assignment (REC-01, merged / closed)

Mode: IMPLEMENT / INTEGRATE. Owner `@wbdevworld` / WS3.
Task: REC-01 — immutable receipt product-name and SKU snapshots.
Branch: `ws3/receipt-product-name-sku` / PR #80, squash-merged as `7c5d6ca0cd93d7aeb5a7a1c97153ca187548c3fb`.
Accepted source SHA: `6995e1c2324432e4cba234f6844bcb224e3d7a57`.
Application acceptance PASS only for the behavior actually exercised. Follow-ups #82–#88 are separate.

## Prior assignment (CD-01 exact-SHA Preview, merged)

Mode: IMPLEMENT / INFRASTRUCTURE SECURITY REMEDIATION. Owner `@wbdevworld` / WS3.
Branch: `ws3/exact-sha-preview` / PR #81, squash-merged as `c1f659ea118a885180fe6a543797efa908abf210`.
Exact-SHA Preview infrastructure is accepted. Dispatch remains a later authorized action and is not production promotion.

## Prior snapshot 2026-09-18 (retained; not current)

Protected `main` `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` was accepted/merged R8 PR #69. At that time STG-01 / #70 was the active P0 recovery gate and R9 PR #63 must not merge while STG-01 was open. STG-01 is now accepted.

## Prior contributor assignment (STG-06, retained)

Mode: REMEDIATE. Owner `@wbdevworld` / WS3.
Branch: `ws3/stg-06-quote-identity-register-authority` from exact start `a02cd21875d0717adb6694d293b41575302b2415`.
Scope: persist rebuildable `pos_catalog_items` during catalog sync; translate POS quote IDs to Woo source IDs server-side; preserve last-known register/shift on transient refresh failure; related quote URL, shift-open idempotency, register error, rebuild-catalog observability. Implementation SHA `5119054a2059ff5903a50d8b96644b63c38fdd48`. Freshness FRESH_2; not imported into `batch/stg-01-staging-runtime-acceptance` from this status file. Do not merge.

## STG-01 integration (historical; accepted on main as `c320be8c...`)

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

Historical STG-05/Preview snapshot (not current assignment truth): STG-05 plugin is deployed on training Woo; authenticated bridge health/catalog/quote were verified (product 14985 equal 3000 GHS minor totals prove customer-context routing, not B2B parity). `BLOCKED_TRAINING_PLUGIN_NOT_DEPLOYED_STG05` is not current truth. Later STG-01 acceptance closed #70/#25/#54. Later REC-01 acceptance proved a controlled staging cash sale (order `49606` / receipt `POS-49606`) on exact immutable Preview. `pricingParityVerified=false`. CP-04 / issue #4 remains OPEN. Production remains unauthorized. R10 Prep is MERGED / PREPARATION COMPLETE. Current assignment is R9 / PR #63.

## R8 (historical / accepted on main)

PR #69 squash-merged as `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`. Production, live Paystack, live refund/restock, and VitePOS deactivation remain NOT AUTHORIZED.

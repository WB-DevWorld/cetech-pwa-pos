# WS3 current status

Snapshot 2026-09-17. Protected `main` `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` is accepted/merged R8 PR #69. STG-01 / #70 is the active P0 recovery gate. R9 PR #63 must not merge while STG-01 is open.

## STG-02 / #71 (this branch)

Mode: IMPLEMENT. Owner `@wbdevworld` / WS3. Branch `ws3/stg-02-session-runtime-composition`.

Mounted POS now bootstraps the existing Identity/BFF session instead of hard-coded `Staff member` / `shiftOpen=true`. Contributor tests are green on this branch. Live staging session cookies remain UNVERIFIED until this SHA is deployed and dedicated staging staff authenticate.

## R8 (historical / accepted on main)

PR #69 squash-merged as `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`.

| Role | SHA / classification |
| --- | --- |
| Current `main` / accepted R8 | `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` ACCEPTED / MERGED |
| STG-02 contributor start | `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` |

Production, live Paystack, live refund/restock, and VitePOS deactivation remain NOT AUTHORIZED.

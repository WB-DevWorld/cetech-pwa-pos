# CP04-W4 bridge service access — EXECUTED

Observer: WS3 senior / @wbdevworld
Host: `https://training.cetechbpa.com` (`cetechtrainingappserver`, `WP_ENVIRONMENT_TYPE=staging`)
START_FRESHNESS_UTC: `2026-09-13T06:15:28Z`
START_MAIN_SHA: `aa08d74f2cb99301817e5995f01486acb7e2169f`
START_R2_SHA: `3a1b6b579781130afc9bd9792405b182c7bfe5ca`
Apply window UTC: `2026-09-13T06:20:14Z`–`2026-09-13T06:23:54Z`
Operator authorization: 2026-09-13 training-only CP04-W4 Actions A–G (not production, not R3, not orders/stock/payments).

Remote mutation authorization: **GRANTED** for W4 Actions A–G on training.
W1 mail containment: **preserved** (`FILTER_YES`, MailPoet inactive, `admin_email` domain `training.invalid`, mail queue empty, sink still 2 lines).

## Exact artifact / security model

| Item | Value |
| --- | --- |
| Plugin slug/path | `wordpress/cetech-pos-bridge` at BR-01 SHA `280a73dbcd53ac0e03883775b4fabdec7465a4a8` |
| Git tree | `a339e2c64a64d2f016f45268750bd4361545a303` (matches R2 import tree) |
| Installed `cetech-pos-bridge.php` SHA-256 | `1849cf334fded93b3054681fb07ad4fce052ca5de84ff7e6d15d489baa07a013` |
| REST route | `GET /wp-json/cetech-pos/v1/health` |
| Capability | `cetech_pos_bridge_access` only |
| Service user | `cetech-pos-bridge-svc` numeric ID **22**, role **subscriber** |
| Application Password label / uuid | `cetech-pos-bff-r2-health` / `6bd36d36-1da6-424f-af0f-d54809f78bd5` |
| Secret location | host-local `/home/cetechtraining/cetech-cp04-w4-app-password.secret` mode `600` |
| BFF pointer (no secret) | `/home/cetechtraining/cetech-cp04-w4-bff.env` keys `BRIDGE_BASE_URL`, `BRIDGE_USERNAME` only |
| Forbidden public env | not created |

A first Windows zip used backslash paths and was **removed** before activation. Final install is a POSIX extract of `git archive` for SHA `280a73d`. No Application Password was printed, committed, or placed in `NEXT_PUBLIC_*`.

No pos-web/BFF process exists on this WordPress host. Server-side WordPress identity is retained for the imminent R2 BFF attach; BFF process env remains a separate runtime step.

## Actions A–G

| Action | Description | Executed |
| --- | --- | --- |
| A | Install exact bridge artifact | **yes** |
| B | Activate exact plugin | **yes** (`0.1.0-br01`, namespace `cetech-pos/v1`) |
| C | Dedicated subscriber service user | **yes** (ID 22) |
| D | Application Password | **yes** (secret not printed) |
| E | Negative authorization before capability | **yes** |
| F | Grant only `cetech_pos_bridge_access` | **yes** (`manage_woocommerce=no`, `manage_options=no`) |
| G | Authenticated + negative health | **yes** |

## Results

| Check | Result |
| --- | --- |
| Plugin installed | yes |
| Plugin activated | yes |
| Dedicated service user created | yes |
| Dedicated capability | `cetech_pos_bridge_access` |
| Application Password provisioned | yes |
| Secret committed/logged | **NO** |
| Anonymous health | HTTP **401** `AUTH_REQUIRED`; public GET echoed `550e8400-e29b-41d4-a716-446655440000` |
| Authenticated no-cap health | HTTP **403** `FORBIDDEN` |
| Authenticated with-cap health | HTTP **200** `ok=true` `status=healthy` |
| Correlation echoed | **yes** (success and 401/403 used the request UUID) |
| Malformed correlation | HTTP **400**; returned a **new** UUID `9213c3ad-a011-4ea7-b9ea-e44157a5aebd` (did not echo `not-a-uuid`) |
| Woo detected | **yes** |
| WoodMart detected | **yes** |
| B2BKing detected | **yes** |
| Contract version | `1.0.0` |
| Pricing parity verified | **false** |
| Unexpected orders | **0** (HPOS still 51) |
| Unexpected stock changes | **0** / not written |
| Unexpected external mail | **0** (W1 intercept still loaded; sink line count unchanged at 2; mailq empty) |
| Unexpected webhooks | **0** (count still 0) |
| User count | 20 → **21** (approved service user only) |
| Credential retained for R2 live BFF test | **yes** (host-local secret, least privilege) |
| Rollback | `docs/runbooks/CP04-W4-ROLLBACK.md` plus preserved W1 rollback JSON |

This health result is **not** quote parity, checkout readiness, stock semantics, payment readiness, or production readiness.

## Classification

CP04-W4 = **PASS** for training WordPress bridge install/identity/health.
R2 bridge remote gate: **READY_FOR_R2_RUNTIME_TEST** (WordPress side). Browser→BFF→Supabase and durable staff-session composition remain separate R2 runtime items.
Issue #4: remains **OPEN**
Production touched: **NO**
R3: **NOT STARTED**

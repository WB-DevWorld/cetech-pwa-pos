# R2 live runtime acceptance

Observer: WS3 senior / @wbdevworld
UTC: `2026-09-13T13:37:50Z`
R2 implementation tree: local `batch/r2-auth-bridge-bff` (pre-commit; exact SHA recorded at checkpoint)
Topology: local Next BFF `http://127.0.0.1:3000` + local Supabase (`127.0.0.1:54321`, Docker) + training WordPress `https://training.cetechbpa.com`

This is **not** a unit-mock PASS. Commands below used the running R2 BFF.

## Paths proven

| Hop | Result |
| --- | --- |
| Synthetic staff → BFF → durable `pos_staff_sessions` → HttpOnly `cetech_pos_sid` | **VERIFIED** |
| Authenticated BFF health → real PostgREST `pos_organizations?select=id&limit=1` | **VERIFIED** (`healthy`, connectivity only) |
| Authenticated BFF health → BR-01 `GET /wp-json/cetech-pos/v1/health` | **VERIFIED** (Woo/WoodMart/B2BKing detected; `pricingParityVerified=false`) |
| Anonymous BFF health | **401 AUTH_REQUIRED** |
| Sign-out | **200** `localWorkPreserved=true`; session cookie cleared |
| Public JSON secret scan | **no** Application Password / service-role / JWT blob |

Synthetic identity only: Auth user `cashier.a.synthetic@example.test` mapped to actor `cashier_a` / org `org_a`. No production or customer identity.

Application Password remained host-local and was copied into a gitignored operator file (`apps/pos-web/.env.local`, ignored). It was not printed, committed, or returned in HTTP bodies. Next server logs did not contain it.

`BRIDGE_BASE_URL` on the WordPress host pointer is the site origin. The BFF adapter canonicalizes to `GET /wp-json/cetech-pos/v1/health`.

## Health claims that remain false / not tested

- pricing parity
- checkout readiness
- stock semantics
- payment readiness
- production readiness

No quote, order, stock write, or payment was executed from this BFF.

## Environment safety

Read-only training WP-CLI after the BFF health GET:

- `WP_ENVIRONMENT_TYPE=staging`
- MailPoet inactive
- W1 MU intercept present
- `admin_email` domain `training.invalid`
- `home=https://training.cetechbpa.com`
- Production not touched

Order-count fingerprint was **not** re-used as a delta (different `wc_get_orders` query than CP-04 W4). This session issued only authenticated `GET` health plus session establish/revoke.

Durable store row counts after the run (no ids): active and revoked rows existed in `pos_staff_sessions`. Revoke is `revoked_at`, not DELETE.

## Local combined suite on this implementation tree

Recorded separately from this live hop. pgTAP 74-case denial tests are in the tree; local Docker Postgres did not have the `pgtap` extension. Linux CI `supabase test db` remains the pgTAP runner.

Issue #4 remains **OPEN**. R3 not started.

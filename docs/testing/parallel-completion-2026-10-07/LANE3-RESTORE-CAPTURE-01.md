# Lane 3 — local disposable capture / restore (2026-10-09)

Status: **WOO CAPTURE + LOCAL RESTORE PASSED** · **POS STAGING DUMP BLOCKED** (credential) · B/C **NOT EXECUTED**  
Acting: `@wbdevworld` / WS3 · cutoff Woo `20261009T062133Z`  
Staff-documentation impact: **NONE** · Production effects: **NONE** · no shared/production restore · RD-01 not re-applied

## Named disposable targets

| Name | Role | Location |
| --- | --- | --- |
| `cetech-pos-r10-woo-20261009` | Woo/MariaDB restore rehearsal | Docker container (loopback `127.0.0.1:3310`) + private files under `%LOCALAPPDATA%\CETECH-POS-R10\cetech-pos-r10-woo-20261009\` |
| `cetech-pos-r10-pg-20261009` | POS PG restore target (empty pending dump) | Docker `postgres:17` loopback `127.0.0.1:55432` |
| Local Supabase stack | Repo-compatible auth/extensions host | Existing `supabase_*_cetech-pwa-pos` containers (healthy); **not** used as staging dump sink |

Raw dumps stay out of Git/chat. Only sizes/checksums and verification IDs are published here.

## Woo capture (training host, read-only export)

| Field | Value |
| --- | --- |
| Host | `cetechtrainingappserver` via BatchMode + `sudo -n -u cetechtraining` |
| WP root | `/home/cetechtraining/htdocs/training.cetechbpa.com` |
| DB name | `cetechtraining` |
| Cutoff UTC | `20261009T062133Z` |
| DB artifact (host) | `/home/cetechtraining/backups/databases/cetech-pos-r10-woo-20261009-20261009T062133Z.sql.gz` |
| DB bytes / SHA-256 | `15517138` / `575b1e102f077eca479e8adf946fb213aab781fd40b23a41e27c489ff33ecf61` |
| Files artifact (host) | `…-woo-files-20261009-20261009T062133Z.tgz` (config + bridge plugin + uploads) |
| Files bytes / SHA-256 | `197224227` / `58093638eb2d866506312a6fb4811fb8b873e50c9e6301d3f86975bd34feff78` |
| Local private copy | DB + meta only under `%LOCALAPPDATA%\CETECH-POS-R10\…` — local SHA-256 **matches** host |
| Pre-capture fixture read | order **50317** present; `_stock` **49111=3**; **49663=1** / `_price=12500` / `_backorders=no` |

## Local Woo restore rehearsal

| Step | Result |
| --- | --- |
| First attempt `mysql:8.0` | **FAILED** — dump collation `utf8mb3_uca1400_ai_ci` (MariaDB source) |
| Disposable target | `mariadb:11.4` container `cetech-pos-r10-woo-20261009`, publish `127.0.0.1:3310` only |
| Import | **PASSED** (`RESTORE_EXIT=0`) |
| Verify order 50317 | **50317** |
| Verify stock 49111 | **3** |
| Verify stock / price 49663 | **1** / **12500** |
| Outbound network / payments / cron | Container not wired to app boot; no WP PHP boot in this rehearsal |
| Application boot against restore | **NOT RUN** (dump+SQL verify only) |

## POS staging capture

| Field | Result |
| --- | --- |
| Staging project | `iegxncvpsyaitkpzywcr` (unchanged identity) |
| Named local PG target | **Created** — `cetech-pos-r10-pg-20261009` / `postgres:17` / `127.0.0.1:55432` |
| Staging schema/data dump | **BLOCKED** — observed missing operator tools: no `supabase` CLI on PATH, no `%USERPROFILE%\.supabase\access-token`, no `DATABASE_URL` / DB URL in linked Vercel pull (`.env.local` held only `VERCEL_OIDC_TOKEN`), no shell `SUPABASE_*` dump credentials |
| Hosted migration mapping (prior RD-01) | source `20261006025100` ↔ hosted `20261008151307` — **not re-applied** |
| Local Supabase migrations tip | `20261006025100` present in local `supabase_db_cetech-pwa-pos` (source tree), distinct from hosted apply id |
| Cross-system atomicity | Woo cutoff `20261009T062133Z` is **independent** of any POS dump; do not claim Woo↔POS atomic snapshot |

## Consistency limits

Independent Woo dump and (future) POS dump cannot prove simultaneous consistency. This capture includes completed sale **50317** on Woo; POS txn `33326bbc…` / receipt `rcpt-33326bbc` remain on staging until a credentialed dump lands.

## Forbidden / not done

- Shared training host restore overwrite
- Production restore
- Paid remote restore (RD-03)
- Re-apply RD-01
- Boot restored WP with outbound webhooks/payments
- Commit raw dumps

# Lane 2 — isolated POS backup/restore (a4f3284 remaining qualification)

Status: **BLOCKED — OPEN**  
Task: `A4-REMAINING-QUALIFICATION-01` · Acting: `@wbdevworld` / WS3  
UTC assess: `2026-10-10T02:15Z` (approx)  
Product freeze: `a4f3284c35785dbb0efe3843d38084f12911ac15`  
Hosted project: `iegxncvpsyaitkpzywcr`  
Staff-documentation impact: **NONE**  
Secrets: not printed · no hosted password reset · no shared/paid/production restore

## Reassessment vs LANE4-POS-DB-RECOVERY-01

| Prior blocker (452 window) | Current reassessment |
| --- | --- |
| No Management API token on workstation | **RESOLVED for API access** — `SUPABASE_ACCESS_TOKEN` present in operator environment; Management API `/database/query` SELECT works (`supabase_migrations.schema_migrations` count **30**) |
| No dumpable backup artifact | **STILL MISSING** — see exact gap below |

`LANE4-POS-DB-RECOVERY-01.md` remains historically accurate for the 452 credential gap. This file is the current a4 gate.

## Management API backup probe (presence + capability)

| Probe | Result |
| --- | --- |
| `GET /v1/projects/iegxncvpsyaitkpzywcr/database/backups` | **200** — `region=eu-west-1`, `walg_enabled=true`, `pitr_enabled=false`, **`backups=[]`**, `physical_backup_data={}` |
| `GET .../database/backups/config` | **404** |
| `GET .../database/backups/download` | **404** |
| `GET .../database/backups/downloadable` | **404** |
| Direct / session-pooler Postgres URI in env or `%LOCALAPPDATA%\CETECH-POS-R10\private\staging-db.url` | **absent** |
| SELECT via Management API | **available** — not a restorable backup |

## Exact missing supported capability

A **downloadable / restorable platform backup export** (or Direct/session-pooler Postgres URI written only to the private local path outside Git) whose coverage includes roles, schema, data, ACL/RLS, POS-relevant Auth, and `supabase_migrations` history for project `iegxncvpsyaitkpzywcr`.

What is **not** sufficient alone:

1. Management API token with SELECT/`/database/query`
2. Empty `backups:[]` listing even when `walg_enabled=true`
3. Vercel API/service-role keys (not DB dump credentials)
4. Plain empty Postgres 17 on `127.0.0.1:55432` without Auth schemas/roles

## Restore / verification (not run)

| Step | Result |
| --- | --- |
| Authorized export artifact | **NOT AVAILABLE** |
| Restore into named isolated Supabase-compatible local target | **NOT RUN** |
| Verify five a4 migrations `20261009214234`…`38`, RLS/grants/tender boundaries, sale **50317** / txn `33326bbc…`, cash/payment/receipt links | **NOT RUN** locally |
| Woo vs POS cutoffs | Remain **independent** — no atomic distributed snapshot claimed |

## Supported operator action (no generic credential chase)

On an authorized dashboard/management path that can emit a dumpable artifact **or** a Connect Direct/session URI:

1. Produce one private restorable export **or** write the URI only to `%LOCALAPPDATA%\CETECH-POS-R10\private\staging-db.url`.
2. Do **not** reset the hosted DB password merely to export.
3. Do **not** paste credentials into chat, issues, or commits.
4. Notify WS3; restore continues into an isolated Supabase-compatible target only.

## Gate

**OPEN / BLOCKED** on missing restorable backup artifact (or private Direct URI). Does **not** stop Lanes 1/3/4. Production restore remains out of scope.

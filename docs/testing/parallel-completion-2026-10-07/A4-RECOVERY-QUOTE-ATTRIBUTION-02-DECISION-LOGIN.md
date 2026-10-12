# Decision request — temporary read-only CLI login (staging dump)

Task: `A4-RECOVERY-AND-QUOTE-ATTRIBUTION-02` · Lane 1 preparation  
Acting: `@wbdevworld` / WS3  
UTC: `2026-10-10T02:55Z`  
Project: `iegxncvpsyaitkpzywcr` (CETECH POS staging)  
Status: **NOT ISSUED** — awaiting explicit scoped GO  
Staff-documentation impact: **NONE**  
Production effects if later approved: **NONE** (read-only login + logical export + isolated local restore only)

## Why this decision is needed

Management API token is present and SELECT via `/database/query` works. Hosted `GET .../database/backups` returns `walg_enabled=true` but **`backups:[]`** with no download endpoint. No Direct URI / `DATABASE_URL` / private `staging-db.url` exists on this workstation.

Pooler config (sanitized):

| Field | Value |
| --- | --- |
| Host | `aws-1-eu-west-1.pooler.supabase.com` |
| Port | **6543** |
| User pattern | `postgres.iegxncvpsyaitkpzywcr` |
| Database | `postgres` |
| Pool mode | **transaction** |
| Password | not supplied by API (`[YOUR-PASSWORD]` placeholder only) |

Transaction-mode pooler is **not** a dump session. Default CLI dump is not a full recovery artifact. Issuing `POST /v1/projects/.../cli/login-role` with `{"read_only":true}` **creates/refreshes a managed hosted login** (Beta; requires database write permission to provision). It is **not** a read-only GET. No existing `cli_login_postgres*` roles were reported at the reviewer checkpoint.

Pinned local tooling inspected:

| Tool | Result |
| --- | --- |
| `npx supabase` **2.120.0** | `db dump` available; dry-run without link fails `DbConfigIpv6Error` (needs IPv4/`supabase link` or `--db-url`) |
| Host `pg_dump`/`psql` | **MISSING** on PATH |
| Container `cetech-pos-r10-pg-20261009` | Postgres **17.11** with `pg_dump`/`psql` on `127.0.0.1:55432` (empty disposable target) |
| Developer `supabase_*` stack | present — **must not** overwrite |

## Exact decision to authorize (one GO)

Authorize **all** of the following as a single bounded packet, or defer:

1. **One** temporary CLI login on project `iegxncvpsyaitkpzywcr` via  
   `POST /v1/projects/iegxncvpsyaitkpzywcr/cli/login-role`  
   Body: `{"read_only": true}` only (never write-capable login).
2. Lifetime: whatever `ttl_seconds` the API returns (record it; do not extend).
3. **One** bounded logical export with compatible PostgreSQL 17 tooling over a **session/direct** connection using that login (TLS verify on), credentials only in protected local memory or `%LOCALAPPDATA%\CETECH-POS-R10\private\` (never chat/Git).
4. Restore **only** into disposable local Supabase-compatible target (not plain empty PG as sole proof; not shared staging/training; not developer `supabase_*` wipe).
5. Cleanup: drop/expire the temporary role per Supabase managed CLI-login lifecycle after export; no password reset, network unban, paid project, or hosted restore.

## Out of scope unless separately authorized

- Shared/paid/remote restore (RD-03)
- Permanent roles, broad grants, DB upgrade
- Production project access
- Inferring approval from historical cash/export caps

## Prep already complete (no GO required)

- Pooler discovery recorded
- Empty restore listener `cetech-pos-r10-pg-20261009:55432` confirmed up
- Evidence publication SHA on PR #144 (see results handoff)
- Commercial and quote-attribution lanes continue without this login

## Operator stop conditions after GO

- Any non-`read_only` role returned → abort
- TLS verify failure → abort (no disable)
- Dump completeness gaps (Auth/Storage/vault) → report denied object; do not widen grants

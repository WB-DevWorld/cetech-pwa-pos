# Lane 1 — backup/restore preparation (effects parked)

Task: `A4-RECOVERY-CASH-AND-PROFILING-03`  
Status: **PREP COMPLETE · EFFECTS NOT STARTED**  
Owner authorization used: **NONE** (awaiting explicit GO for login+export+restore)  
Staff-documentation impact: **NONE**

## Connection metadata (sanitized)

| Source | Value |
| --- | --- |
| Project | `iegxncvpsyaitkpzywcr` · ACTIVE_HEALTHY · eu-west-1 |
| Direct DB host (project.database.host) | `db.iegxncvpsyaitkpzywcr.supabase.co` |
| Direct port (platform default) | **5432** (session/direct class — for dump after GO) |
| Pooler | `aws-1-eu-west-1.pooler.supabase.com:6543` · **transaction** · user `postgres.iegxncvpsyaitkpzywcr` |
| Dump session | **Must not** use transaction pooler :6543 |

## Named isolated restore target (prepared, not started)

| Item | Value |
| --- | --- |
| Identity | `cetech-pos-a4-restore-20261010` |
| Workdir | `%LOCALAPPDATA%\CETECH-POS-R10\cetech-pos-a4-restore-20261010\` |
| `supabase init` | completed (CLI 2.120.0) |
| Port plan (avoid developer 5432x) | API **55321** · DB **55322** · Studio **55323** · Inbucket **55324** · Analytics **55327** |
| Plain PG `55432` | remains empty listener only — **not** recovery proof alone |
| Developer `supabase_*` | **must not** overwrite |

## Export plan (after GO only)

1. One `POST .../cli/login-role` `{"read_only":true}` — record role+TTL; never log password; never write-capable.
2. Verify role membership / read-only / required SELECTs; no `SET ROLE postgres`.
3. `pg_dump` from Postgres 17 tooling to private artifact (TLS verify); coherent snapshot.
4. Restore into named target; compare migrations/RLS/grants/tender/receipt identities.
5. Expire login; do not collective DELETE other operators' CLI roles.

Decision sheet still: `A4-RECOVERY-QUOTE-ATTRIBUTION-02-DECISION-LOGIN.md`.

## Gate

**OPEN / BLOCKED** on owner GO. No login issued this task.

# Lane 1 — backup/restore preparation + post-GO outcome

Task: `A4-RECOVERY-CASH-AND-PROFILING-03`  
Status: **PREP RETAINED · DUMP BLOCKED · RESTORE NOT RUN**  
Owner authorization used: explicit **GO** `2026-10-10` (read_only login + export + isolated restore)  
Staff-documentation impact: **NONE**

## Connection metadata (sanitized)

| Source | Value |
| --- | --- |
| Project | `iegxncvpsyaitkpzywcr` · ACTIVE_HEALTHY · eu-west-1 |
| Direct DB host | `db.iegxncvpsyaitkpzywcr.supabase.co` |
| Direct DNS | **AAAA-only** (no usable A from this executor); host IPv6 TCP false from Windows |
| Pooler transaction | `aws-1-eu-west-1.pooler.supabase.com:6543` · **do not use for dump** |
| Pooler session (used) | same host **:5432** · IPv4 · user `cli_login_supabase_read_only_user.<project_ref>` · TLS `require` |

## Named isolated restore target (prepared, unused)

| Item | Value |
| --- | --- |
| Identity | `cetech-pos-a4-restore-20261010` |
| Workdir | `%LOCALAPPDATA%\CETECH-POS-R10\cetech-pos-a4-restore-20261010\` |
| `supabase init` | completed (CLI 2.120.0) |
| Port plan | API **55321** · DB **55322** · Studio **55323** · Inbucket **55324** · Analytics **55327** |
| Restore | **NOT STARTED** (no coherent dump artifact) |

## Post-GO execution

1. One `POST .../cli/login-role` `{"read_only":true}` — role `cli_login_supabase_read_only_user` · **ttl_seconds=300**.
2. No `SET ROLE postgres`. No write-capable login.
3. Session pooler connect **OK**.
4. Full `pg_dump` **FAIL**:
   - `permission denied for schema auth` (LOCK TABLE auth.*)
   - `permission denied for schema supabase_migrations` (SELECT)
5. Login allowed to expire; no collective DELETE of other CLI roles.
6. Credentials never committed; sticky private cred file cleaned after attempts.

Private denial note: `%LOCALAPPDATA%\CETECH-POS-R10\private\iegxn-a4-dump-DENIED.json`

## Gate

**BLOCKED** on exact denied schemas **`auth`** and **`supabase_migrations`** under default dump coverage. Public-only dump is **not** claimed as recovery PASS.

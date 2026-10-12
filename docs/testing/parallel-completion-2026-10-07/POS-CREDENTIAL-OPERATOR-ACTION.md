# Operator action — POS staging database credentials (local only)

Status: **BLOCKER for POS dump** · one concrete local action  
Staff-documentation impact: **NONE** · do **not** paste passwords into chat/Git/PR

## Why

Named target `cetech-pos-r10-pg-20261009` (`127.0.0.1:55432`, Postgres 17) is empty and ready. Staging project `iegxncvpsyaitkpzywcr` cannot be dumped with an API/service-role key, Vercel OIDC token, or CLI access token alone. A real **database login** (direct or session pooler) is required.

## Exact local steps (owner/operator workstation)

1. Open Supabase Dashboard → project `iegxncvpsyaitkpzywcr` → **Connect**.
2. Copy the **URI** for Direct connection **or** Session pooler (prefer pooler if IPv4-only).
3. Store it only in a private local file outside the repo, e.g.  
   `%LOCALAPPDATA%\CETECH-POS-R10\private\staging-db.url`  
   (already gitignored patterns cover `.env*`; still keep this path outside the worktree).
4. Do **not** reset the hosted database password merely to export.
5. Do **not** paste the URI into Cursor chat, issues, or commits.
6. Tell the WS3 operator that the private file is ready (path only), then continue dump with pinned Supabase CLI / `pg_dump` into the disposable target per:
   - https://supabase.com/docs/guides/self-hosting/restore-from-platform  
   - https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

## After credentials exist

Capture roles, schema, data, RLS/grants, POS-relevant Auth, and `supabase_migrations` history (`20261006025100` ↔ hosted `20261008151307`). Restore only into an isolated Supabase-compatible stack — do not overwrite developer `supabase_*` containers or blindly load into plain Postgres without roles/extensions/Auth.

Verify txn `33326bbc…` / sale-50317 / receipt `rcpt-33326bbc` against restored Woo order 50317. Cutoffs remain independent (not atomic).

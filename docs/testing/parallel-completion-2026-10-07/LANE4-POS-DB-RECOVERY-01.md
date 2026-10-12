# Lane 4 — POS staging DB access discovery / recovery

Status: **BLOCKED — no usable database login or platform backup export on this workstation**  
Acting: `@wbdevworld` / WS3 · cutoff ~2026-10-09T08:20Z  
Staff-documentation impact: **NONE** · secrets not printed · no hosted password reset attempted  
Does **not** block Preview software testing handoff for `452c446`

## Target

| Item | Value |
| --- | --- |
| Hosted project | `iegxncvpsyaitkpzywcr` |
| Disposable local PG | `cetech-pos-r10-pg-20261009` · `127.0.0.1:55432` · Postgres 17 · **empty** · not auto Supabase-compatible |
| Required verify | txn `33326bbc-1dd7-4582-8409-ea434942d8db` / `sale-50317` / cash·payment·receipt·journal / migrations `20261006025100` ↔ hosted `20261008151307` |

## Discovery (presence only)

| Source | Result |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` / `DATABASE_URL` / `DIRECT_URL` / `POSTGRES_URL` / `SUPABASE_DB_URL` env | **absent** |
| `supabase` CLI on PATH | **absent** |
| `~/.supabase` | telemetry/traces only — **no** access token / project link credential |
| `%LOCALAPPDATA%\CETECH-POS-R10\private\staging-db.url` | **absent** |
| Vercel Preview secrets (names) | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, anon/public URL keys present — **API/service-role keys, not DB passwords** |
| `DATABASE_URL` / pooler URI in Vercel env names | **not listed** |
| Training WP config as Supabase login source | previously none — not re-probed as credential source |
| Platform backup/export via available CLI/API on this machine | **unavailable** without management API login that yields dumpable DB contents |

## What is missing (exact)

1. A **direct or session-pooler Postgres URI** (user+password+host+db) for project `iegxncvpsyaitkpzywcr`, stored only in a private local file outside Git; **or**
2. An authorized **platform backup/export** artifact whose coverage includes roles, schema, data, ACL/RLS, POS-relevant Auth, and `supabase_migrations` history.

## Supported operator/admin action (not a generic owner chase)

On a machine already authorized for the Supabase project dashboard (or management API with dump capability):

1. Supabase → project `iegxncvpsyaitkpzywcr` → **Connect** → copy Direct **or** Session pooler URI.  
2. Write only to `%LOCALAPPDATA%\CETECH-POS-R10\private\staging-db.url` (create `private\` if needed).  
3. Do **not** reset the hosted DB password merely to export.  
4. Do **not** paste the URI into chat, issues, or commits.  
5. Notify WS3 that the path exists; dump/restore continues with pinned tooling into an isolated Supabase-compatible target (not a blind load into plain PG17).

## Restore / verification

| Step | Result |
| --- | --- |
| Dump | **NOT RUN** — no login |
| Restore into isolated target | **NOT RUN** |
| Verify txn / sale-50317 / receipt / migrations | **NOT RUN** locally |
| Hosted RD-01 receipt | still accepted separately (`20261008151307`) — not a local restore proof |

## Cutoffs

Woo SQL cutoff `20261009T062133Z` and POS hosted migration `20261008151307` remain **independent** — not an atomic distributed snapshot.

## Lane4 probe reconfirm (same workstation)

Re-inspected after coordinator write: **no additional access found**. Same blockers stand. Extra presence-only notes that do not change the verdict: `apps/pos-web/.env.local` holds only `VERCEL_OIDC_TOKEN`; `npx supabase` 2.120.0 exists but returns `AccessTokenRequiredError`; pgAdmin has only `localhost:5432`; agent stores have no staging-db URI pointer; empty target on `55432` reconfirmed; developer `supabase_*` containers untouched. No credentials invented; no owner ask.

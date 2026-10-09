# DB-SEC-02 / DB-SEC-03 — disposable probe status

Status: **PROBES READY · UNEXECUTED** (no disposable migrated Supabase stack on this workstation for DML)  
Staff-documentation impact: **NONE** · **never** run on hosted staging/production

## Sources

Copied from review evidence ZIP (private extract under `%LOCALAPPDATA%\CETECH-POS-R10\review-evidence-2026-10-09\`):

- `repro-direct-cash-correction.sql` — DB-SEC-02  
- `repro-disabled-staff.sql` — DB-SEC-03  

## Why not executed here

- Empty plain PG17 `cetech-pos-r10-pg-20261009:55432` is not a migrated Supabase role/RLS stack.  
- No `supabase` CLI login / `staging-db.url` for a disposable clone.  
- Packet forbids hosted DML.

## Next authorized step

1. Stand up disposable loopback Supabase/Postgres with exact migrations through `452c446` (+ proposed TF-01 migration if testing claims).  
2. Seed synthetic org/location/register/shift/assignment rows.  
3. Run both SQL files (they `ROLLBACK`).  
4. If DB-SEC-02 reproduces: additive migration closing direct authenticated `correction` INSERT while preserving service-only audited RPC.  
5. If DB-SEC-03 reproduces: decide supported direct-client boundary, then enforce active access in RLS or remove unused direct writes.

## AUTH-02

Still a **policy decision** (customer search with zero assignments). Not invented as manager-only in this batch.

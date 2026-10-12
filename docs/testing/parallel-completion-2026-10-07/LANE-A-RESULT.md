# Lane A result — PARALLEL-LANE-A-DB-SEC-01

UTC: `2026-10-07T19:45:00Z` (local proof window)
Task: `PARALLEL-LANE-A-DB-SEC-01`
Workstream / owner: WS3 Lane A
Branch: `ws3/db-sec-01`
Base application candidate: `0e383d84f11573ca89d6533c8cb7c35d79d7b261` (ancestor)
Tested SHA: `c512b106bce1a0efcfd9c2caeddd54ad9e43dccd` (PR #143 head)
Staff documentation impact: NONE
Production / remote DDL effects: NONE (not authorized; not performed)

## Shipping migration static check

File: `supabase/migrations/20261006025100_db_sec_01_revoke_authenticated_truncate.sql`

| Check | Result |
| --- | --- |
| No executable `GRANT TRUNCATE` (comments stripped) | PASS |
| Helper `public.db_sec_01_revoke_authenticated_truncate()` defined | PASS |
| Final invocation `SELECT public.db_sec_01_revoke_authenticated_truncate();` present | PASS |
| Body revokes `TRUNCATE` only (not UPDATE) | PASS (also asserted in pgTAP) |

## Commands and results

Runtime: Docker Desktop healthy; pinned CLI binary `supabase.exe` **2.117.0** from npx cache (not PATH). `npx supabase@2.117.0 db reset` remains BLOCKED on this Windows host by Node/cmd.exe special-character quoting; native `supabase.exe` was used instead.

| Command | Result |
| --- | --- |
| `supabase.exe db reset --yes --local` (2.117.0) | PASS — applied through `20261006025100_db_sec_01_revoke_authenticated_truncate.sql` + seed |
| `supabase.exe test db` (2.117.0) | PASS — **Files=20, Tests=419** (includes `db_sec_01_truncate.sql`) |
| Disposable seed → full shipping migration → privilege assert (transaction `ROLLBACK`) | PASS — after seed `truncate_true_count=11`; after full migration `truncate_true_count=0` |
| Negative control: seed → migration copy **omitting only** final `SELECT` → assert (transaction `ROLLBACK`) | PASS — `truncate_true_count=11` (invocation required) |
| Post-rollback baseline | PASS — `authenticated` TRUNCATE false on `pos_organizations`; SELECT remains true |
| Staging `has_table_privilege` re-read | **UNVERIFIED** — no authorized staging DB URL / access token in this worktree session (`SUPABASE_DB_URL` / `SUPABASE_ACCESS_TOKEN` unset; no linked project) |

pgTAP file under test: `supabase/tests/db_sec_01_truncate.sql` (`plan(24)`). Suite total **419** tests across **20** files.

## Negative control

Omitting only the shipping migration’s final `SELECT public.db_sec_01_revoke_authenticated_truncate();` after seeding `GRANT TRUNCATE … TO authenticated` on all 11 tables leaves effective TRUNCATE true on all 11. The helper definition and `REVOKE ALL ON FUNCTION` alone do not repair privileges. Both disposable transactions rolled back; local catalog left at post-reset state.

## Compatibility / rollback

- App rollback must not re-grant `TRUNCATE` to `authenticated`.
- Forward repair path is the shipping migration / helper invocation.
- Local proof did not change row counts beyond disposable rolled-back transactions.
- Residual hosted `UPDATE`/`DELETE` and future-table default privileges remain intentionally out of scope (see `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/evidence/DB-SEC-01.md`).

## Approval state

| Gate | State |
| --- | --- |
| Local disposable proof | PASS |
| Full local pgTAP | PASS (20 / 419) |
| Staging grant verification | UNVERIFIED (no authorized access) |
| Remote / hosted DDL apply | **NOT AUTHORIZED** — not performed |
| Production | NOT AUTHORIZED |

## Remaining blocker

Hosted/staging apply completed under RD-01 (owner-connected; not this lane): hosted version `20261008151307`, source `20261006025100` / blob `6936b0e…`. Receipt: `RD-01-STAGING-EXECUTION-RECEIPT.md`. This lane itself did not apply hosted DDL. Do not re-apply.

## Next action

Integration/release owner: authorize staging apply only after review of PR #143 at `c512b106…`, then run the staging plan in `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/evidence/DB-SEC-01.md` (pre/post `has_table_privilege` + counts). Until then, keep remote DDL blocked.

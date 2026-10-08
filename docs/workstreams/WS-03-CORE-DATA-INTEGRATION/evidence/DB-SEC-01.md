# DB-SEC-01 evidence

Staff-documentation impact: **NONE**.  
Production effects: **NONE**.

## Staging status — APPLIED AND VERIFIED

Owner-authorized staging apply completed `2026-10-08` on project `iegxncvpsyaitkpzywcr` (`ACTIVE_HEALTHY`, PostgreSQL 17).  
Exact receipt: `docs/testing/parallel-completion-2026-10-07/RD-01-STAGING-EXECUTION-RECEIPT.md`.

| Field | Value |
| --- | --- |
| Source PR / commit | `#143` / `c512b106bce1a0efcfd9c2caeddd54ad9e43dccd` |
| Shipping file | `supabase/migrations/20261006025100_db_sec_01_revoke_authenticated_truncate.sql` |
| Approved blob | `6936b0e68a5bb3fbd4e08bd4b5f50b08d78bfef5` |
| Source version | `20261006025100` |
| Hosted version | `20261008151307` (`db_sec_01_revoke_authenticated_truncate`) |
| History rows | **25** (prior 24 unchanged) |
| Before snapshot | `2026-10-08T15:10:42.729037+00:00` |
| After snapshot | `2026-10-08T15:13:21.829384+00:00` |

Verified: authenticated/anon/PUBLIC TRUNCATE **false** on all 11 named tables; SELECT/INSERT and non-TRUNCATE ACLs/RLS/service_role/`pos_lock_shift_topology` preserved; row counts unchanged. Do **not** re-apply or bulk-push.

Production apply is **not** authorized by this staging receipt.

## Observed gap (pre-apply history)

At `2026-10-06T02:43:00Z` and `2026-10-06T02:44:21Z`, staging role `authenticated` had effective `TRUNCATE` on 11 public tables. `anon` had none. RLS was enabled on all 35 inspected `pos_*` tables. RLS does not apply to `TRUNCATE`.

No `TRUNCATE` was attempted during discovery. That was not evidence that the HTTP API exposes `TRUNCATE`, and it was not evidence of data loss.

Root preflight `2026-10-08T15:02Z` still showed Authenticated TRUNCATE **true** on all 11 and version `20261006025100` **ABSENT** (24 migrations). Owner apply closed that gap (see receipt).

## Intended grants (unchanged design)

`20260912170000_pos_operational_schema.sql` revokes those tables from `PUBLIC` and `anon` only. It then grants `authenticated`:

- `SELECT` on organizations, locations, devices, registers, both assignment tables, shifts, cash movements, and pending operations
- `INSERT` on shifts, cash movements, and pending operations

`service_role` receives the explicit `SELECT` / `INSERT` / `UPDATE` grants. `authenticated` receives no grant on `pos_outbox_events` or `pos_integration_watermarks`. No migration grants `TRUNCATE`.

The live pre-repair `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE` set matched a hosted default `ALL` that this revoke list never removed from `authenticated`.

## Shipping candidate

`supabase/migrations/20261006025100_db_sec_01_revoke_authenticated_truncate.sql`

The migration defines `db_sec_01_revoke_authenticated_truncate()` and runs it once. It does not grant `TRUNCATE`. The function revokes `TRUNCATE` from `PUBLIC`, `anon`, and `authenticated` on the 11 observed tables. Execute is revoked from `PUBLIC`, `anon`, and `authenticated`.

Preserved by design: row `SELECT`, `INSERT`, `UPDATE`, and `DELETE`; `service_role` grants; every RLS policy; `pos_lock_shift_topology(text, uuid)` execute for `authenticated`.

Residual, intentionally unchanged: hosted `UPDATE` and `DELETE` on these tables, hosted access to outbox and watermark tables, and default privileges that could grant `TRUNCATE` on a future table. Those need their own decision.

## Rollback

App rollback does not restore this grant. Re-granting `TRUNCATE` to `authenticated` would put the privilege gap back. A reviewed forward repair is the database path. Staging row counts were not changed by the applied SQL.

## Local tests (Lane A)

`supabase/tests/db_sec_01_truncate.sql` does not call the repair function and the shipping migration does not grant `TRUNCATE`. After `supabase db reset --local`, the suite asserts effective `TRUNCATE` is false on all 11 tables, plus the execute and legitimate-grant checks. Full local suite: 20 files, 419 tests, PASS (see `LANE-A-RESULT.md`).

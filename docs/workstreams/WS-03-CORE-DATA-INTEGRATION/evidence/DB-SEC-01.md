# DB-SEC-01 review candidate

Not applied to staging or production. Remote DDL remains unauthorized.

## Observed gap

At `2026-10-06T02:43:00Z` and `2026-10-06T02:44:21Z`, staging role `authenticated` had effective `TRUNCATE` on 11 public tables. `anon` had none. RLS was enabled on all 35 inspected `pos_*` tables. RLS does not apply to `TRUNCATE`.

No `TRUNCATE` was attempted. This is not evidence that the HTTP API exposes `TRUNCATE`, and it is not evidence of data loss.

## Intended grants

`20260912170000_pos_operational_schema.sql` revokes those tables from `PUBLIC` and `anon` only. It then grants `authenticated`:

- `SELECT` on organizations, locations, devices, registers, both assignment tables, shifts, cash movements, and pending operations
- `INSERT` on shifts, cash movements, and pending operations

`service_role` receives the explicit `SELECT` / `INSERT` / `UPDATE` grants. `authenticated` receives no grant on `pos_outbox_events` or `pos_integration_watermarks`. No migration grants `TRUNCATE`.

The live `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE` set matches a hosted default `ALL` that this revoke list never removed from `authenticated`. The catalog extract did not include `relacl` or `pg_default_acl`, so direct versus inherited versus default-privilege origin is not separately proven.

## Candidate

`supabase/migrations/20261006025100_db_sec_01_revoke_authenticated_truncate.sql`

The migration defines `db_sec_01_revoke_authenticated_truncate()` and, in the same transaction, grants `TRUNCATE` to `authenticated` and then runs the function once. The committed result is the revoke. Dropping only the final invocation leaves the reproduced privilege, which the test rejects. The function revokes `TRUNCATE` from `PUBLIC`, `anon`, and `authenticated` on the 11 observed tables. Execute is revoked from `PUBLIC`, `anon`, and `authenticated`. Version `20261006025100` sorts after both the source filename `20261003072537` and the live history version `20261003083357`. Existing migration filenames are not rewritten.

Preserved: row `SELECT`, `INSERT`, `UPDATE`, and `DELETE`; `service_role` grants; every RLS policy; `pos_lock_shift_topology(text, uuid)` execute for `authenticated`.

Residual, intentionally unchanged: hosted `UPDATE` and `DELETE` on these tables, hosted access to outbox and watermark tables, and default privileges that could grant `TRUNCATE` on a future table. Those need their own decision.

## Staging plan, not authorized

Read `has_table_privilege` for `authenticated` and `anon` `TRUNCATE` on all 11 tables, and the row counts, before applying this migration. Apply only this forward file. Read the same privileges and counts again. Acceptance is effective `TRUNCATE` false for both roles, explicit `SELECT` and `INSERT` still present, `service_role` and the shift-topology RPC unchanged, and counts unchanged. Rolling the application back must not grant `TRUNCATE` again.

## Rollback

App rollback does not restore this grant. Re-granting `TRUNCATE` to `authenticated` would put the privilege gap back. A reviewed forward repair is the database path. Row counts were not changed by this unapplied file.

## Tests

`supabase/tests/db_sec_01_truncate.sql` does not call the repair function. The migration file grants `TRUNCATE` to `authenticated` and its final statement removes that grant in the same transaction. After `supabase db reset --local` applies that file, the test asserts effective `TRUNCATE` is false on all 11 tables. Granting `TRUNCATE` again and leaving it, without calling the function, fails those 11 assertions. That omission check was run on the disposable local database and then the function was used only to restore that database. The passing rerun of this file is 24 tests. The full local suite after the same reset is 20 files and 419 tests, PASS.

The test also asserts `anon` and `authenticated` lack effective `EXECUTE`, and that `proacl` is not null and has no `PUBLIC` (`grantee` 0) `EXECUTE` grant. `SELECT` and `INSERT` grants, `service_role` `SELECT`, and `authenticated` execute on `pos_lock_shift_topology(text, uuid)` remain. The function body revokes `TRUNCATE` and does not revoke `UPDATE`. Local `authenticated` does not have the hosted `UPDATE` grant, so that residual is not asserted as a live privilege. Staff documentation impact: none.

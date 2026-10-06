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

The migration defines `db_sec_01_revoke_authenticated_truncate()` and runs it once. The function revokes `TRUNCATE` from `PUBLIC`, `anon`, and `authenticated` on the 11 observed tables. Execute is revoked from `PUBLIC`, `anon`, and `authenticated`. Version `20261006025100` sorts after both the source filename `20261003072537` and the live history version `20261003083357`. Existing migration filenames are not rewritten.

Preserved: row `SELECT`, `INSERT`, `UPDATE`, and `DELETE`; `service_role` grants; every RLS policy; `pos_lock_shift_topology(text, uuid)` execute for `authenticated`.

Residual, intentionally unchanged: hosted `UPDATE` and `DELETE` on these tables, hosted access to outbox and watermark tables, and default privileges that could grant `TRUNCATE` on a future table. Those need their own decision.

## Staging plan, not authorized

Read `has_table_privilege` for `authenticated` and `anon` `TRUNCATE` on all 11 tables, and the row counts, before applying this migration. Apply only this forward file. Read the same privileges and counts again. Acceptance is effective `TRUNCATE` false for both roles, explicit `SELECT` and `INSERT` still present, `service_role` and the shift-topology RPC unchanged, and counts unchanged. Rolling the application back must not grant `TRUNCATE` again.

## Rollback

App rollback does not restore this grant. Re-granting `TRUNCATE` to `authenticated` would put the privilege gap back. A reviewed forward repair is the database path. Row counts were not changed by this unapplied file.

## Tests

`supabase/tests/db_sec_01_truncate.sql` grants `ALL` to `authenticated` first, proves effective `TRUNCATE` is true, then calls only `db_sec_01_revoke_authenticated_truncate()`. A migration that does not install that function, or a function that does not remove the effective privilege, fails. Staff documentation impact: none.

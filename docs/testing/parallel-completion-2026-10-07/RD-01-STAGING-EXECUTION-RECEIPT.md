# RD-01 — staging #143 execution receipt

Status: **APPLIED AND VERIFIED** on staging only.  
Staff-documentation impact: **NONE**.  
Production effects: **NONE**.  
Do **not** re-apply `#143` or run a bulk `db push` against mismatched historic timestamps.

## Authority

| Field | Value |
| --- | --- |
| Decision | `RD-01-STAGING-TRUNCATE-REVOKE` |
| Owner approval | Conversation `2026-10-08T15:07:56Z` — exact staging `#143` application request approved |
| Target | CETECH POS staging — `iegxncvpsyaitkpzywcr` — `ACTIVE_HEALTHY` — PostgreSQL 17 |
| Source PR / commit | `#143` / `c512b106bce1a0efcfd9c2caeddd54ad9e43dccd` |
| Shipping file | `supabase/migrations/20261006025100_db_sec_01_revoke_authenticated_truncate.sql` |
| Approved blob | `6936b0e68a5bb3fbd4e08bd4b5f50b08d78bfef5` |
| Implementation editor | Owner-connected staging migration action (not WS3 Cursor apply) |

## Source → hosted migration mapping

| Kind | Value |
| --- | --- |
| Repository source version | `20261006025100` |
| Approved blob | `6936b0e68a5bb3fbd4e08bd4b5f50b08d78bfef5` |
| Hosted `apply_migration` version | `20261008151307` |
| Hosted name | `db_sec_01_revoke_authenticated_truncate` |
| History rows after apply | **25** (original 24 name/version pairs unchanged) |

`apply_migration` accepts name/query and generates the hosted timestamp. Do not rewrite existing history rows or claim the source filename timestamp exists as a remote version.

## Snapshots

| Phase | UTC |
| --- | --- |
| Before | `2026-10-08T15:10:42.729037+00:00` |
| After | `2026-10-08T15:13:21.829384+00:00` |

One `apply_migration` invocation returned success. No retry was sent.

## Before → after (eleven tables)

| Table | Authenticated TRUNCATE before | After | Rows before | After |
| --- | --- | --- | ---: | ---: |
| pos_cash_movements | true | false | 40 | 40 |
| pos_devices | true | false | 5 | 5 |
| pos_integration_watermarks | true | false | 0 | 0 |
| pos_locations | true | false | 6 | 6 |
| pos_organizations | true | false | 2 | 2 |
| pos_outbox_events | true | false | 3 | 3 |
| pos_pending_operations | true | false | 119 | 119 |
| pos_registers | true | false | 8 | 8 |
| pos_shifts | true | false | 10 | 10 |
| pos_staff_location_assignments | true | false | 40 | 40 |
| pos_staff_register_assignments | true | false | 42 | 42 |

## Independent readback (all eleven)

- Authenticated, anon, and PUBLIC TRUNCATE are **false**.
- Non-TRUNCATE ACL fingerprints, table owners/OIDs, RLS flags, and policy fingerprints unchanged.
- Authenticated SELECT/INSERT/UPDATE/DELETE and service_role TRUNCATE remain at prior values.
- All eleven row counts identical across observed snapshots.
- `pos_lock_shift_topology` signature, owner, ACL, and effective execute permissions unchanged.
- Repair helper is SECURITY INVOKER; authenticated and anon cannot execute it; ACL has no PUBLIC EXECUTE. Provider `service_role` default grant remains present.

No table-data mutation was submitted. No hosted TRUNCATE test was attempted. No application source, tester alias, training bridge, payment, order, stock, or receipt was changed by this execution.

## Forbidden follow-ups

- Re-apply `#143` / this shipping SQL on staging
- Bulk pending migration apply / CLI push of historic mismatched timestamps
- Re-GRANT TRUNCATE to authenticated / anon / PUBLIC as “rollback”
- Treat this receipt as production apply or production readiness

## Related

- `QUALIFICATION-RD-DECISIONS.md` (RD-01 closed)
- `RUNTIME-DECISIONS-MANIFEST.md` §0 + Section 1
- `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/evidence/DB-SEC-01.md`
- Owner receipt source: `CETECH-POS-DB-SEC-01-Staging-Execution-Receipt.md` (2026-10-08)

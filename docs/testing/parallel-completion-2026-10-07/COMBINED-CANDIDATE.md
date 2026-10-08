# Combined source candidate — 2026-10-08

**NOT INSTALLED. NOT DEPLOYED. NOT READY FOR PRODUCTION.** Tester alias unchanged.

| Field | Value |
|---|---|
| PR | [#144](https://github.com/WB-DevWorld/cetech-pwa-pos/pull/144) |
| Reviewed tip (REQUEST CHANGES) | `7d75c3944d41a5990aa64004c9e96954779c9730` |
| R144 repair batch | closes R144-1 / R144-2 / R144-3 atop that tip (see `R144-REPAIR-01.md`) |
| Race-fix **product** base | `daac7e035d992c2798a317a0cf371f2925a9fe35` |
| Application baseline #140 | `0e383d84f11573ca89d6533c8cb7c35d79d7b261` |
| Privilege repair #143 | `c512b106bce1a0efcfd9c2caeddd54ad9e43dccd` (blob `6936b0e…`; hosted DDL still unauthorized) |
| Branch | `ws3/combined-candidate-2026-10-08` |
| Excludes | #141 diagnostic |
| Rollback | `0e383d84` (app); DB TRUNCATE must not be re-granted on rollback |
| Open issues (unchanged) | #115, #132 |
| Profiler | PARKED (Lane E) |

## Schema / files

- Additive migration only: `supabase/migrations/20261006025100_db_sec_01_revoke_authenticated_truncate.sql` (from #143; hosted DDL still unauthorized).
- Bridge: owned-object recovery binder + request-local prepare/quote CRUD guards (`class-woo-runtime.php`).
- Evidence under `docs/testing/parallel-completion-2026-10-07/`.

## Local checks after R144 repair

- Bridge suite excl. pre-existing `test-ws3-generated-return-effects.php` environment fatal: **1942+ passed / 0 failed** (includes `test-woo-runtime-hooks.php`).
- Full `tests/bridge/run.php` remains the CI qualification command (do not exclude generated file for final CI).
- `python scripts/verify_control_plane.py`: run on published tip.

## Remaining live gates (separate authorizations)

See `RUNTIME-DECISIONS-MANIFEST.md`: staging #143 apply, live transaction qualification, device/print/backup. Training bridge install not authorized from this source task. Profiler parked. **NOT READY FOR PRODUCTION.**

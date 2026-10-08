# Combined source candidate — 2026-10-08

**NOT INSTALLED. NOT DEPLOYED. NOT READY FOR PRODUCTION.** Tester alias unchanged.

| Field | Value |
|---|---|
| Combined SHA | `daac7e035d992c2798a317a0cf371f2925a9fe35` |
| Application baseline #140 | `0e383d84f11573ca89d6533c8cb7c35d79d7b261` |
| Privilege repair #143 | `c512b106bce1a0efcfd9c2caeddd54ad9e43dccd` |
| Race fix (cherry-pick) | `7242d428984d9b4068803a1ffe63d83720e47e5e` → `daac7e0` |
| Branch | `ws3/combined-candidate-2026-10-08` |
| Excludes | #141 diagnostic |
| Rollback | `0e383d84` (app); DB TRUNCATE must not be re-granted on rollback |

## Schema / files

- Additive migration only: `supabase/migrations/20261006025100_db_sec_01_revoke_authenticated_truncate.sql` (from #143; hosted DDL still unauthorized).
- Bridge: `class-woo-runtime.php`, `fake-woo-runtime.php`, prepare tests, order-count fixture.
- Evidence under `docs/testing/parallel-completion-2026-10-07/`.

## Local checks on combined HEAD

- Bridge suite excl. pre-existing `test-ws3-generated-return-effects.php` fatal: **1909 passed / 0 failed**
- `python scripts/verify_control_plane.py`: PASS

## Remaining live gates (separate authorizations)

See `RUNTIME-DECISIONS-MANIFEST.md`: staging #143 apply, live transaction qualification, device/print/backup. Profiler parked.

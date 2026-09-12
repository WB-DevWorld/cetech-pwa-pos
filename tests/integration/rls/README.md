# RLS isolation tests (CORE-01)

Canonical pgTAP suite for POS operational RLS and invariants.

Run via local Supabase (Docker required):

```text
npx supabase@2.117.0 db reset --local
npx supabase@2.117.0 test db
```

`supabase/tests/rls_isolation.sql` must stay identical to `test_rls_isolation.sql`. Fixtures are synthetic (`org_a`, `loc_a1`, `cashier_a`, …).

Negative cases that must remain red:

| Case | Expected |
| --- | --- |
| anonymous | denied (`42501`) |
| cross-organization | zero rows / insert `42501` |
| cross-location | zero rows / insert denied |
| forged actor | zero rows (no assignment) |
| client-supplied actor_id | overwritten from JWT |
| unauthorized cash movement | denied (`P0002` when the shift is hidden by RLS) |
| append-only movement | update/delete `55000` |
| duplicate idempotency key | unique violation `23505` |
| closed shift mutation | `55000` |
| second open shift | unique violation `23505` |
| authenticated outbox insert | denied (`42501`) |
| outbox cross-org location | FK `23503` |
| correction missing approval / reference | `23514` |
| correction wrong amount / currency / scope | `23514` |
| expected cash below zero | `23514` |
| pending cross-register / cross-shift / cross-org | FK `23503` |
| production `pos_close_shift` | absent |

`service_role` bypasses RLS. That result documents a platform fact, not an authorization grant. CORE-02+ server paths must authorize without treating service-role possession as a cashier/manager identity. CORE-07 owns authoritative operational close / immutable Z orchestration.

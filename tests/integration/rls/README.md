# RLS isolation tests (CORE-01)

Canonical pgTAP suite for POS operational RLS and invariants.

Run via local Supabase (Docker required):

```text
npx supabase@2.117.0 db reset --local
npx supabase@2.117.0 test db
```

`supabase/tests/*.sql` includes these files. Fixtures are synthetic (`org_a`, `loc_a1`, `cashier_a`, …).

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

`service_role` bypasses RLS. That result documents a platform fact, not an authorization grant. CORE-02+ server paths must authorize without treating service-role possession as a cashier/manager identity.

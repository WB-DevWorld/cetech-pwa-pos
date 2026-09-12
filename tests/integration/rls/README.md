# RLS isolation tests (CORE-01)

Canonical pgTAP suite for POS operational RLS and invariants.

Run via local Supabase (Docker required):

```text
npx supabase@2.117.0 db reset --local
npx supabase@2.117.0 test db
```

`supabase/tests/rls_isolation.sql` must stay identical to `test_rls_isolation.sql` aside from the file header. `tests/tooling/test_rls_suite_mirror.py` enforces that. Fixtures are synthetic (`org_a`, `loc_a1`, `cashier_a`, `reg_a`, `reg_a2`, …).

Same-shift cash writers serialize on the atomic expected-cash `UPDATE`. This harness cannot safely orchestrate true parallel sessions; do not treat sequential SQL as a concurrency PASS. CORE-05/QA-01 owns a two-session concurrency/failure-injection test. A single-statement multi-row INSERT proves both deltas apply without a GUC handoff.

Negative cases that must remain red:

| Case | Expected |
| --- | --- |
| anonymous | denied (`42501`) |
| cross-organization | zero rows / insert `42501` |
| cross-location | zero rows / insert denied |
| forged actor | zero rows (no assignment) |
| client-supplied actor_id | overwritten from JWT |
| unauthorized cash movement | denied (`P0002` when the shift is hidden by RLS) |
| authenticated internal cash kinds | `42501` |
| cash currency mismatch | `23514` |
| missing cash reason (authenticated) | `23514` |
| append-only movement | update/delete `55000` |
| duplicate correction | unique violation `23505` |
| correction-of-correction | `23514` |
| same org + same operation + same key | unique violation `23505` |
| closed shift mutation / delete | `55000` |
| service_role shift DELETE | `42501` |
| second open shift | unique violation `23505` |
| authenticated outbox insert/select | denied (`42501`) |
| authenticated watermark select | denied (`42501`) |
| outbox cross-org location | FK `23503` |
| correction missing approval / reference | `23514` |
| correction wrong amount / currency / scope | `23514` |
| expected cash below zero | `23514` |
| pending cross-register / cross-shift / cross-org | FK `23503` |
| pending same-location unassigned register/shift | `42501` |
| production `pos_close_shift` | absent |

`service_role` bypasses RLS. That result documents a platform fact, not an authorization grant. CORE-02+ server paths must authorize without treating service-role possession as a cashier/manager identity. CORE-07 owns authoritative operational close / immutable Z orchestration. Register/shift/cash SELECT remains location-scoped; finer register operational-read distinction is deferred to CORE-02.

# Local POS database (CORE-01)

Pinned CLI: **Supabase CLI 2.117.0** (`npx supabase@2.117.0`). Do not add it to the application lockfile for this task; invoke the pinned npx package.

This project is local-first. It does not require a Supabase cloud project, Woo production, or the training hostname in schema rules.

```text
npx supabase@2.117.0 db reset --local
npx supabase@2.117.0 test db
```

JWT claims consumed by RLS (issued later by CORE-02; tests set them directly):

```json
{
  "role": "authenticated",
  "app_metadata": {
    "organization_id": "org_a",
    "location_ids": ["loc_a1"],
    "actor_id": "cashier_a",
    "register_id": "reg_a"
  }
}
```

Client-supplied `actor_id` / organization / location columns are not authority. Triggers stamp server-derived values from JWT + register/shift rows.

**Service role warning:** PostgreSQL role `service_role` bypasses RLS. Possession of that key is not cashier/manager authorization. CORE-02+ trusted server paths must authorize explicitly.

The transactional outbox and integration watermarks are trusted-server surfaces. Authenticated clients cannot select or insert them. `service_role` may write, but that is not business authorization.

**Shift close:** CORE-07 owns authoritative operational close / immutable Z orchestration. CORE-01 provides schema and immutability invariants only; it does not expose `pos_close_shift`. Persisted shifts are not deletable in ordinary operation.

**Cash concurrency:** same-shift cash writers take `SELECT ... FOR UPDATE` on the shift before validation. pgTAP cannot safely orchestrate true parallel sessions; CORE-05/QA-01 owns a two-session concurrency/failure-injection harness. Sequential invariants prove `expected_cash == opening float + SUM(committed non-opening deltas)`.

**Cash command idempotency:** claimed on `pos_pending_operations` unique `(organization_id, operation, idempotency_key)`. Do not treat `pos_cash_movements.idempotency_key` as a second competing command-key system.

Linux CI `control-plane` runs pinned `npx supabase@2.117.0 start`, `db reset --local`, and `test db` against this config. No remote/linked project.

Synthetic seed IDs only (`org_a`, `loc_a1`, …). No training-site customers or orders.

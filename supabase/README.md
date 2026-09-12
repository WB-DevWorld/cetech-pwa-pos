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

Synthetic seed IDs only (`org_a`, `loc_a1`, …). No training-site customers or orders.

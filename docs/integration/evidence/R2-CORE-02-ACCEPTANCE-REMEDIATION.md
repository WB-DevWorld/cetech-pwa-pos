# R2 CORE-02 acceptance-remediation checkpoint

UTC: 2026-09-12 (local validation before commit)

Continuation START_FRESHNESS_SNAPSHOT: `2026-09-12T22:22:20Z` (`docs/integration/evidence/R2-START-FRESHNESS-CONTINUATION.md`).

## What this checkpoint proves

- Trusted `pos_staff_location_assignments.role` (`cashier` / `manager`) is the permission authority.
- Client/JWT capabilities and client role values cannot elevate.
- `authorizeStaffMutation` requires CSRF/origin; omitting protection is denied at runtime.
- Transitional Supabase Auth adapter uses `/auth/v1/user` + publishable key (native fetch). No `@supabase/supabase-js`. Service-role credentials refused.
- Ephemeral in-memory session store is named and refused for `APP_ENV=production|staging`. Durable provider-backed storage remains a runtime gate, not claimed here.

## Not claimed

- Production session durability
- Live Supabase Auth users
- Combined BR-01 / live bridge health
- Pricing parity

Contracts v1.0.0 unchanged. Lockfile unchanged.

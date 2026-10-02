# First Owner bootstrap — CETECH POS staging

This runbook is the next controlled runtime action. It was not executed in the source-remediation task.
Do not run it against production. Do not add a public or unauthenticated first-admin route.

## Why this exists

Staging organization `org_a` has operational staff (`cashier_a`, `manager_a`) and no row in `pos_organization_memberships`.
Organization Owner, Admin, and Support are a separate axis from cashier/manager location roles.
After one active Owner exists, later staff, roles, locations, registers, and devices are administered in the product.

## Preconditions

- Exact source candidate has fresh independent review.
- Trusted Exact SHA Preview is a later phase, not this step.
- Operator uses the staging Supabase SQL editor as `service_role` / database owner.
- The person already has an active Auth user.
- That user's `app_metadata` contains `actor_id` and `organization_id` for the staging organization.
- `user_metadata` is never used as authority.
- No password, service-role key, or JWT is copied into tickets, logs, or this file.

## One-time membership

Replace the placeholders with the real staging actor id. Keep the organization id that the Auth user already belongs to.

```sql
SELECT pos_admin_set_control_membership(
  'org_a',
  '<existing-actor-id>',
  'owner',
  'active',
  '<existing-actor-id>',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
);
```

If POS access must be explicit rather than the missing-row default:

```sql
SELECT pos_admin_set_staff_access_status(
  'org_a',
  '<existing-actor-id>',
  'active',
  'first owner bootstrap',
  '<existing-actor-id>',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
);
```

Where full operational acceptance is required, the same person also needs an operational `manager` assignment and register assignments at the locations they will exercise. Use the existing assignment tables or, after this Owner can sign in, the Staff & access screen. Do not put `admin` into the cashier/manager role check.

## Verification

```sql
SELECT organization_id, actor_id, control_role, status
FROM pos_organization_memberships
WHERE organization_id = 'org_a';

SELECT actor_id, organization_id, location_id, role
FROM pos_staff_location_assignments
WHERE organization_id = 'org_a'
  AND actor_id = '<existing-actor-id>';
```

Expected: one active `owner` row. A later attempt to disable or demote that only Owner must fail with the last-owner protection already in `pos_admin_set_control_membership`.

## Forward migration still required before topology mutations

`20260923140000_pos_admin_topology.sql` adds location status and the location, register, and device save functions.
Apply it to staging only as its own reviewed operation. Do not rewrite `20260922123000_pos_admin_control_plane.sql`.
Until that migration is applied, location administration in the new build cannot persist.

## After bootstrap

Owner signs in and uses Add staff. Direct-created accounts receive a temporary password and must change it before the POS workspace opens. Invitation remains available and keeps POS access disabled until setup is complete. No further routine Supabase dashboard edits should be required for staff, roles, locations, registers, or devices.

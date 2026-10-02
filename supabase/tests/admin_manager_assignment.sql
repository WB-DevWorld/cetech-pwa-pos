-- ADMIN-105 manager register assignment cannot create a location role or change it.
BEGIN;

SELECT plan(4);

SET ROLE service_role;

SELECT throws_ok(
  $$ SELECT pos_admin_set_staff_assignment(
       'org_a', 'cashier_a', 'loc_a1', 'manager', ARRAY['reg_a'], 'manager_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true
     ) $$,
  '23514',
  NULL,
  'registers-only assignment cannot change operational role'
);

SELECT lives_ok(
  $$ SELECT pos_admin_set_staff_assignment(
       'org_a', 'cashier_a', 'loc_a1', 'cashier', ARRAY['reg_a2'], 'manager_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true
     ) $$,
  'registers-only assignment can change registers for an existing cashier'
);

SELECT is(
  (SELECT role FROM pos_staff_location_assignments
    WHERE actor_id = 'cashier_a' AND location_id = 'loc_a1'),
  'cashier',
  'existing operational role is unchanged'
);

SELECT throws_ok(
  $$ SELECT pos_admin_set_staff_assignment(
       'org_a', 'missing_cashier', 'loc_a1', 'cashier', ARRAY['reg_a'], 'manager_a',
       'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true
     ) $$,
  '23503',
  NULL,
  'registers-only assignment cannot create a new location assignment'
);

SELECT * FROM finish();
ROLLBACK;

BEGIN;

SELECT plan(8);

SET ROLE anon;
SELECT throws_ok(
  $$ SELECT pos_admin_save_location(
       'org_a', NULL, 'New store', 'active', 'owner_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     ) $$,
  '42501',
  NULL,
  'anonymous cannot save a location'
);
RESET ROLE;

SET ROLE authenticated;
SELECT throws_ok(
  $$ SELECT pos_admin_save_register(
       'org_a', 'reg_a', 'loc_a1', 'Register A', 'GHS', 'active', 'owner_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     ) $$,
  '42501',
  NULL,
  'authenticated cannot save a register'
);
RESET ROLE;

SET ROLE service_role;
SELECT lives_ok(
  $$ SELECT pos_admin_save_location(
       'org_a', NULL, 'Accra Annex', 'active', 'owner_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab'
     ) $$,
  'service_role can create a location'
);
SELECT is(
  (SELECT status FROM pos_locations WHERE name = 'Accra Annex' AND organization_id = 'org_a'),
  'active',
  'new location starts active'
);
SELECT throws_ok(
  $$ SELECT pos_admin_save_location(
       'org_b', 'loc_a1', 'Stolen name', 'inactive', 'owner_b',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac'
     ) $$,
  '23503',
  NULL,
  'a location cannot be changed from another organization'
);
SELECT throws_ok(
  $$ SELECT pos_admin_save_register(
       'org_a', 'reg_a', 'loc_a1', 'Register A', 'USD', 'active', 'owner_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad'
     ) $$,
  '23514',
  NULL,
  'register currency cannot change after creation'
);
SELECT lives_ok(
  $$ SELECT pos_admin_save_device(
       'org_a', NULL, 'loc_a1', 'Front counter', 'active', 'owner_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaae'
     ) $$,
  'service_role can create a location-scoped device'
);
SELECT is(
  (SELECT count(*)::int FROM pos_admin_audit_events
    WHERE action IN ('location.save', 'device.save')
      AND organization_id = 'org_a'),
  2,
  'location and device saves are audited'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;

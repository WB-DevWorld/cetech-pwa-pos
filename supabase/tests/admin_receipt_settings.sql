BEGIN;

SELECT plan(26);

SET ROLE anon;
SELECT throws_ok(
  $$ SELECT pos_admin_set_receipt_settings(
       'org_a', 'loc_a1', 'owner_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       true, 18, true
     ) $$,
  '42501',
  NULL,
  'anonymous cannot change receipt settings'
);
RESET ROLE;

SET ROLE authenticated;
SELECT throws_ok(
  $$ SELECT pos_admin_set_receipt_settings(
       'org_a', 'loc_a1', 'owner_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       true, 18, true
     ) $$,
  '42501',
  NULL,
  'authenticated cannot change receipt settings'
);
RESET ROLE;

SET ROLE service_role;
SELECT lives_ok(
  $$ SELECT pos_admin_set_receipt_settings(
       'org_a', 'loc_a1', 'owner_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       true, 18, true
     ) $$,
  'service_role can save receipt settings'
);
SELECT is(
  (SELECT shorten_product_names FROM pos_receipt_settings
    WHERE organization_id = 'org_a' AND location_id = 'loc_a1'),
  true,
  'shorten product names persists'
);
SELECT is(
  (SELECT product_name_max_characters FROM pos_receipt_settings
    WHERE organization_id = 'org_a' AND location_id = 'loc_a1'),
  18,
  'max characters persist'
);
SELECT is(
  (SELECT show_sku FROM pos_receipt_settings
    WHERE organization_id = 'org_a' AND location_id = 'loc_a1'),
  true,
  'show SKU persists'
);
SELECT is(
  (SELECT count(*)::int FROM pos_admin_audit_events
    WHERE action = 'receipt_settings.set' AND location_id = 'loc_a1'),
  1,
  'one audit event is written for the save'
);
SELECT is(
  (SELECT target_type FROM pos_admin_audit_events
    WHERE action = 'receipt_settings.set' AND location_id = 'loc_a1'),
  'receipt_settings',
  'audit target type is receipt settings'
);
SELECT is(
  (SELECT target_id FROM pos_admin_audit_events
    WHERE action = 'receipt_settings.set' AND location_id = 'loc_a1'),
  'loc_a1',
  'audit target id is the location'
);
SELECT is(
  (SELECT actor_id FROM pos_admin_audit_events
    WHERE action = 'receipt_settings.set' AND location_id = 'loc_a1'),
  'owner_a',
  'audit records the acting staff member'
);
SELECT ok(
  (SELECT before_state IS NULL FROM pos_admin_audit_events
    WHERE action = 'receipt_settings.set' AND location_id = 'loc_a1'),
  'the first save records that no settings row existed'
);
SELECT is(
  (SELECT after_state->>'product_name_max_characters' FROM pos_admin_audit_events
    WHERE action = 'receipt_settings.set' AND location_id = 'loc_a1'),
  '18',
  'audit after state stores the saved max characters'
);

SELECT lives_ok(
  $$ SELECT pos_admin_set_receipt_settings(
       'org_a', 'loc_a1', 'admin_a',
       'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
       false, 24, false
     ) $$,
  'a later save updates the same location'
);
SELECT is(
  (SELECT count(*)::int FROM pos_admin_audit_events
   WHERE action = 'receipt_settings.set'
     AND location_id = 'loc_a1'
     AND before_state->>'product_name_max_characters' = '18'
     AND after_state->>'product_name_max_characters' = '24'),
  1,
  'the later audit records the previous max characters and the saved value'
);
SELECT is(
  (SELECT product_name_max_characters FROM pos_receipt_settings
    WHERE organization_id = 'org_a' AND location_id = 'loc_a1'),
  24,
  'the later max characters replace the previous value'
);
SELECT is(
  (SELECT count(*)::int FROM pos_admin_audit_events
    WHERE action = 'receipt_settings.set' AND location_id = 'loc_a1'),
  2,
  'each save appends its own audit event'
);

SELECT throws_ok(
  $$ SELECT pos_admin_set_receipt_settings(
       'org_a', 'loc_b1', 'owner_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       true, 12, true
     ) $$,
  '23503',
  NULL,
  'a location from another organization is rejected'
);
SELECT is(
  (SELECT count(*)::int FROM pos_receipt_settings
    WHERE organization_id = 'org_a' AND location_id = 'loc_b1'),
  0,
  'rejected cross-organization save does not create a settings row'
);
SELECT is(
  (SELECT count(*)::int FROM pos_admin_audit_events
    WHERE action = 'receipt_settings.set' AND location_id = 'loc_b1'),
  0,
  'rejected cross-organization save does not write an audit event'
);

SELECT throws_ok(
  $$ SELECT pos_admin_set_receipt_settings(
       'org_a', 'loc_a1', 'owner_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       true, 0, true
     ) $$,
  '23514',
  NULL,
  'max characters below 1 is rejected'
);
SELECT throws_ok(
  $$ SELECT pos_admin_set_receipt_settings(
       'org_a', 'loc_a1', 'owner_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       true, 257, true
     ) $$,
  '23514',
  NULL,
  'max characters above 256 is rejected'
);
SELECT is(
  (SELECT product_name_max_characters FROM pos_receipt_settings
    WHERE organization_id = 'org_a' AND location_id = 'loc_a1'),
  24,
  'invalid max characters leave the stored value unchanged'
);
SELECT throws_ok(
  $$ DELETE FROM pos_receipt_settings
     WHERE organization_id = 'org_a' AND location_id = 'loc_a1' $$,
  '42501',
  NULL,
  'service_role still cannot delete receipt settings'
);
RESET ROLE;

CREATE FUNCTION public.pos_test_fail_receipt_settings_audit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.action = 'receipt_settings.set' AND NEW.location_id = 'loc_a2' THEN
    RAISE EXCEPTION 'audit persistence failed' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pos_test_fail_receipt_settings_audit
  BEFORE INSERT ON pos_admin_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.pos_test_fail_receipt_settings_audit();

SET ROLE service_role;
SELECT throws_ok(
  $$ SELECT pos_admin_set_receipt_settings(
       'org_a', 'loc_a2', 'owner_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       true, 12, true
     ) $$,
  'P0001',
  NULL,
  'audit failure aborts the settings change'
);
SELECT is(
  (SELECT count(*)::int FROM pos_receipt_settings
    WHERE organization_id = 'org_a' AND location_id = 'loc_a2'),
  0,
  'settings are unchanged when the audit event cannot be stored'
);
SELECT is(
  (SELECT count(*)::int FROM pos_admin_audit_events
    WHERE action = 'receipt_settings.set' AND location_id = 'loc_a2'),
  0,
  'no audit event remains when audit persistence fails'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;

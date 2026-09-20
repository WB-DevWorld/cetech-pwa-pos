BEGIN;

SELECT plan(9);

SET ROLE anon;
SELECT throws_ok(
  $$ SELECT count(*) FROM pos_receipt_settings $$,
  '42501',
  NULL,
  'anonymous cannot read receipt settings'
);
RESET ROLE;

SET ROLE authenticated;
SELECT throws_ok(
  $$ SELECT count(*) FROM pos_receipt_settings $$,
  '42501',
  NULL,
  'authenticated cannot read receipt settings'
);
SELECT throws_ok(
  $$ INSERT INTO pos_receipt_settings (
       organization_id, location_id, shorten_product_names, product_name_max_characters, show_sku
     ) VALUES (
       'org_a', 'loc_a1', true, 12, true
     ) $$,
  '42501',
  NULL,
  'authenticated cannot insert receipt settings'
);
RESET ROLE;

SET ROLE service_role;
SELECT lives_ok(
  $$ INSERT INTO pos_receipt_settings (
       organization_id, location_id, shorten_product_names, product_name_max_characters, show_sku
     ) VALUES (
       'org_a', 'loc_a1', false, 40, false
     ) $$,
  'service_role can insert receipt settings'
);
SELECT lives_ok(
  $$ UPDATE pos_receipt_settings
     SET shorten_product_names = true,
         product_name_max_characters = 18,
         show_sku = true
     WHERE organization_id = 'org_a' AND location_id = 'loc_a1' $$,
  'service_role can update receipt settings'
);
SELECT is(
  (SELECT product_name_max_characters FROM pos_receipt_settings
    WHERE organization_id = 'org_a' AND location_id = 'loc_a1'),
  18,
  'updated max characters persist'
);
SELECT throws_ok(
  $$ INSERT INTO pos_receipt_settings (
       organization_id, location_id, product_name_max_characters
     ) VALUES (
       'org_a', 'loc_a2', 0
     ) $$,
  '23514',
  NULL,
  'max characters below 1 is rejected'
);
SELECT throws_ok(
  $$ UPDATE pos_receipt_settings
     SET product_name_max_characters = 257
     WHERE organization_id = 'org_a' AND location_id = 'loc_a1' $$,
  '23514',
  NULL,
  'max characters above 256 is rejected'
);
SELECT throws_ok(
  $$ DELETE FROM pos_receipt_settings
     WHERE organization_id = 'org_a' AND location_id = 'loc_a1' $$,
  '42501',
  NULL,
  'service_role cannot delete receipt settings'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;

-- R6-REM-01 durable checkout snapshots, assignment scope, and trusted-server writes.
-- Not the mirrored RLS suite. Do not copy this file into tests/integration/rls/.

BEGIN;

SELECT plan(17);

SET ROLE anon;
SELECT throws_ok(
  $$ SELECT count(*) FROM pos_quote_snapshots $$,
  '42501',
  NULL,
  'anonymous cannot read quote snapshots'
);
RESET ROLE;

SET ROLE authenticated;
SELECT throws_ok(
  $$ SELECT count(*) FROM pos_quote_snapshots $$,
  '42501',
  NULL,
  'authenticated cannot read quote snapshots'
);
SELECT throws_ok(
  $$ INSERT INTO pos_checkout_sales (
       transaction_id, organization_id, location_id, register_id, shift_id, sale_id, status, record
     ) VALUES (
       '11111111-1111-4111-8111-111111111101',
       'org_a', 'loc_a1', 'reg_a',
       '11111111-1111-4111-8111-111111111199',
       'woo-denied', 'prepared', '{}'::jsonb
     ) $$,
  '42501',
  NULL,
  'authenticated cannot insert POS checkout sales'
);
RESET ROLE;

SET ROLE service_role;
SELECT lives_ok(
  $$ INSERT INTO pos_shifts (
       register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
     ) VALUES (
       'reg_a', '00000000-0000-4000-8000-0000000000a1', 5000, 'GHS', 'cashier_a'
     ) $$,
  'service_role can open a shift with an explicit cashier_id'
);
SELECT set_config(
  'pos_test.durable_shift',
  (SELECT id::text FROM pos_shifts WHERE register_id = 'reg_a' AND status = 'open' LIMIT 1),
  true
);

SELECT lives_ok(
  $$ INSERT INTO pos_quote_snapshots (id, organization_id, location_id, snapshot)
     VALUES ('quote_r6_1', 'org_a', 'loc_a1', '{"id":"quote_r6_1"}'::jsonb) $$,
  'service_role can persist an authoritative quote snapshot'
);
SELECT throws_ok(
  $$ INSERT INTO pos_quote_snapshots (id, organization_id, location_id, snapshot)
     VALUES ('quote_r6_cross', 'org_a', 'loc_b1', '{"id":"quote_r6_cross"}'::jsonb) $$,
  '23503',
  NULL,
  'cross-organization quote location references are denied'
);

SELECT lives_ok(
  $$ INSERT INTO pos_checkout_sales (
       transaction_id, organization_id, location_id, register_id, shift_id, sale_id, status, record
     ) VALUES (
       '11111111-1111-4111-8111-111111111101',
       'org_a', 'loc_a1', 'reg_a',
       current_setting('pos_test.durable_shift')::uuid,
       'woo-49111', 'prepared',
       jsonb_build_object('prepared', jsonb_build_object('transactionId', '11111111-1111-4111-8111-111111111101'))
     ) $$,
  'service_role can persist prepared POS sale state'
);

SELECT lives_ok(
  $$ INSERT INTO pos_checkout_payments (
       payment_id, organization_id, location_id, transaction_id, sale_id, evidence_id,
       tender, status, amount_minor, amount_currency, cash_received_minor, cash_received_currency,
       verified_at, verification_source, actor_id
     ) VALUES (
       '22222222-2222-4222-8222-222222222201',
       'org_a', 'loc_a1',
       '11111111-1111-4111-8111-111111111101',
       'woo-49111',
       '33333333-3333-4333-8333-333333333301',
       'cash', 'verified', 2900, 'GHS', 3000, 'GHS',
       now(), 'cash_ledger', 'cashier_a'
     ) $$,
  'service_role can persist verified cash tender evidence'
);
SELECT throws_ok(
  $$ INSERT INTO pos_checkout_payments (
       payment_id, organization_id, location_id, transaction_id, sale_id, evidence_id,
       tender, status, amount_minor, amount_currency, cash_received_minor, cash_received_currency,
       verified_at, verification_source, actor_id
     ) VALUES (
       '22222222-2222-4222-8222-222222222202',
       'org_a', 'loc_a1',
       '11111111-1111-4111-8111-111111111101',
       'woo-49111',
       '33333333-3333-4333-8333-333333333302',
       'cash', 'verified', 2900, 'GHS', 3000, 'GHS',
       now(), 'cash_ledger', 'cashier_a'
     ) $$,
  '23505',
  NULL,
  'one verified cash payment per POS transaction'
);

SELECT lives_ok(
  $$ INSERT INTO pos_checkout_receipts (
       id, organization_id, location_id, transaction_id, snapshot
     ) VALUES (
       'receipt_r6_1', 'org_a', 'loc_a1',
       '11111111-1111-4111-8111-111111111101',
       '{"id":"receipt_r6_1"}'::jsonb
     ) $$,
  'service_role can persist a POS receipt snapshot'
);
SELECT throws_ok(
  $$ INSERT INTO pos_checkout_receipts (
       id, organization_id, location_id, transaction_id, snapshot
     ) VALUES (
       'receipt_r6_2', 'org_a', 'loc_a1',
       '11111111-1111-4111-8111-111111111101',
       '{"id":"receipt_r6_2"}'::jsonb
     ) $$,
  '23505',
  NULL,
  'one receipt per POS transaction'
);

SELECT lives_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, operation, idempotency_key, request_hash, status, outcome
     ) VALUES (
       'org_a', 'loc_a1', 'sale.prepare',
       '44444444-4444-4444-8444-444444444401',
       repeat('ab', 32), 'acknowledged',
       '{"transactionId":"11111111-1111-4111-8111-111111111101"}'::jsonb
     ) $$,
  'pending operation outcome survives as durable acknowledged state'
);
SELECT throws_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, operation, idempotency_key, request_hash, status
     ) VALUES (
       'org_a', 'loc_a1', 'sale.prepare',
       '44444444-4444-4444-8444-444444444401',
       repeat('cd', 32), 'pending'
     ) $$,
  '23505',
  NULL,
  'organization + operation + idempotency key remains unique'
);

SELECT is(
  (SELECT count(*)::int FROM pos_staff_location_assignments
    WHERE actor_id = 'cashier_a' AND organization_id = 'org_a' AND location_id = 'loc_a1'),
  1,
  'cashier_a has a current location assignment in org_a'
);
SELECT is(
  (SELECT count(*)::int FROM pos_staff_location_assignments
    WHERE actor_id = 'cashier_a' AND organization_id = 'org_b'),
  0,
  'cashier_a has no location assignments in the wrong organization'
);
SELECT is(
  (SELECT count(*)::int FROM pos_staff_register_assignments
    WHERE actor_id = 'cashier_a' AND organization_id = 'org_a' AND register_id = 'reg_a'),
  1,
  'cashier_a has a current register assignment'
);
SELECT is(
  (SELECT count(*)::int FROM pos_checkout_sales
    WHERE transaction_id = '11111111-1111-4111-8111-111111111101' AND status = 'prepared'),
  1,
  'prepared POS transaction is recoverable from durable state'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;

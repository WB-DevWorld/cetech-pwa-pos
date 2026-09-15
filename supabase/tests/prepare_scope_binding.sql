-- R6-REM-02: prepare transaction-scope binding.
-- Not the mirrored RLS suite. Do not copy this file into tests/integration/rls/.

BEGIN;

SELECT plan(8);

SELECT lives_ok(
  $$ INSERT INTO pos_shifts (
       register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
     ) VALUES (
       'reg_a', '00000000-0000-4000-8000-0000000000a1', 1000, 'GHS', 'cashier_a'
     ) $$,
  'trusted-server can open a shift for prepare-scope setup'
);

SELECT set_config(
  'pos_test.scope_shift',
  (SELECT id::text FROM pos_shifts WHERE register_id = 'reg_a' AND status = 'open' LIMIT 1),
  true
);

SELECT lives_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, register_id, shift_id, transaction_id,
       operation, idempotency_key, request_hash, status
     ) VALUES (
       'org_a', 'loc_a1', 'reg_a',
       current_setting('pos_test.scope_shift')::uuid,
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
       'sale.prepare',
       'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
       repeat('aa', 32),
       'pending'
     ) $$,
  'prepare command can bind organization, location, register, shift, and transaction'
);

SELECT throws_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, register_id, shift_id, transaction_id,
       operation, idempotency_key, request_hash, status
     ) VALUES (
       'org_b', 'loc_b1', NULL, NULL,
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
       'sale.prepare',
       'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
       repeat('bb', 32),
       'pending'
     ) $$,
  '23505',
  NULL,
  'the same prepare transaction_id cannot silently cross tenant boundaries'
);

SELECT throws_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, register_id, operation, idempotency_key, request_hash, status
     ) VALUES (
       'org_a', 'loc_b1', 'reg_a', 'sale.prepare',
       'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
       repeat('cc', 32), 'pending'
     ) $$,
  '23503',
  NULL,
  'prepare location must belong to the organization'
);

SELECT throws_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, register_id, operation, idempotency_key, request_hash, status
     ) VALUES (
       'org_a', 'loc_a1', 'reg_b', 'sale.prepare',
       'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4',
       repeat('dd', 32), 'pending'
     ) $$,
  '23503',
  NULL,
  'prepare register must belong to the location and organization'
);

SELECT lives_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, operation, idempotency_key, request_hash, status, outcome
     ) VALUES (
       'org_a', 'loc_a1', 'payment.cash',
       'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
       repeat('ee', 32), 'acknowledged',
       '{"status":"verified"}'::jsonb
     ) $$,
  'idempotency uniqueness remains organization + operation + key'
);

SELECT is(
  (SELECT outcome->>'status' FROM pos_pending_operations
    WHERE organization_id = 'org_a' AND operation = 'payment.cash'
      AND idempotency_key = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),
  'verified',
  'acknowledged outcome survives for process-loss replay'
);

SELECT throws_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, register_id, shift_id, transaction_id,
       operation, idempotency_key, request_hash, status
     ) VALUES (
       'org_a', 'loc_a2', 'reg_b',
       current_setting('pos_test.scope_shift')::uuid,
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
       'sale.prepare',
       'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5',
       repeat('ff', 32), 'pending'
     ) $$,
  '23503',
  NULL,
  'prepare shift must belong to the register, location, and organization'
);

SELECT * FROM finish();
ROLLBACK;

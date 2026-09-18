-- Additive prepare-intent capture. Not an acknowledged outcome and not a fabricated sale.
-- sale.prepare stores sale-time presentation here BEFORE SalesPort.prepare.
-- Not the mirrored RLS suite. Do not copy this file into tests/integration/rls/.

BEGIN;

SELECT plan(6);

SET ROLE anon;
SELECT throws_ok(
  $$ SELECT intent_snapshot FROM pos_pending_operations $$,
  '42501',
  NULL,
  'anonymous cannot read prepare intent snapshots'
);
RESET ROLE;

SET ROLE authenticated;
SELECT throws_ok(
  $$ UPDATE pos_pending_operations SET intent_snapshot = '{}'::jsonb $$,
  '42501',
  NULL,
  'authenticated cannot update prepare intent snapshots'
);
RESET ROLE;

SET ROLE service_role;
SELECT lives_ok(
  $$ INSERT INTO pos_shifts (
       register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
     ) VALUES (
       'reg_a', '00000000-0000-4000-8000-0000000000a1', 1000, 'GHS', 'cashier_a'
     ) $$,
  'trusted-server can open a shift for prepare-intent setup'
);

SELECT set_config(
  'pos_test.intent_shift',
  (SELECT id::text FROM pos_shifts WHERE register_id = 'reg_a' AND status = 'open' LIMIT 1),
  true
);

SELECT lives_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, register_id, shift_id, transaction_id,
       operation, idempotency_key, request_hash, status, intent_snapshot
     ) VALUES (
       'org_a', 'loc_a1', 'reg_a',
       current_setting('pos_test.intent_shift')::uuid,
       '11111111-1111-4111-8111-111111111801',
       'sale.prepare',
       '22222222-2222-4222-8222-222222222801',
       repeat('aa', 32),
       'pending',
       jsonb_build_object(
         'kind', 'sale.prepare.presentation',
         'quoteId', 'quote-1',
         'quoteFingerprint', 'fp',
         'transactionId', '11111111-1111-4111-8111-111111111801',
         'lineIds', jsonb_build_array('line-1'),
         'lines', '[]'::jsonb
       )
     ) $$,
  'service_role can persist a prepare intent snapshot'
);
SELECT is(
  (SELECT intent_snapshot->>'kind' FROM pos_pending_operations
    WHERE idempotency_key = '22222222-2222-4222-8222-222222222801'),
  'sale.prepare.presentation',
  'prepare intent snapshot kind persists independently of outcome'
);
SELECT is(
  (SELECT outcome FROM pos_pending_operations
    WHERE idempotency_key = '22222222-2222-4222-8222-222222222801'),
  NULL,
  'intent_snapshot does not populate outcome'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;

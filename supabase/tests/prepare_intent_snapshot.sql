-- Additive prepare-intent capture and first-write-wins immutability.
-- Not the mirrored RLS suite. Do not copy this file into tests/integration/rls/.

BEGIN;

SELECT plan(15);

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
       operation, idempotency_key, request_hash, status
     ) VALUES (
       'org_a', 'loc_a1', 'reg_a',
       current_setting('pos_test.intent_shift')::uuid,
       '11111111-1111-4111-8111-111111111801',
       'sale.prepare',
       '22222222-2222-4222-8222-222222222801',
       repeat('aa', 32),
       'pending'
     ) $$,
  'service_role can insert a pending prepare row with null intent'
);

SELECT is(
  (SELECT intent_snapshot FROM pos_pending_operations
    WHERE idempotency_key = '22222222-2222-4222-8222-222222222801'),
  NULL,
  'new prepare journal row starts with null intent_snapshot'
);

SELECT lives_ok(
  $$ UPDATE pos_pending_operations
     SET intent_snapshot = jsonb_build_object(
       'kind', 'sale.prepare.presentation',
       'quoteId', 'quote-1',
       'name', 'A'
     )
     WHERE idempotency_key = '22222222-2222-4222-8222-222222222801'
       AND intent_snapshot IS NULL $$,
  'NULL to snapshot A is allowed'
);

SELECT is(
  (SELECT intent_snapshot->>'name' FROM pos_pending_operations
    WHERE idempotency_key = '22222222-2222-4222-8222-222222222801'),
  'A',
  'first durable snapshot A is stored'
);

SELECT is(
  (SELECT count(*)::int FROM pos_pending_operations
    WHERE idempotency_key = '22222222-2222-4222-8222-222222222801'
      AND intent_snapshot IS NULL),
  0,
  'compare-and-set for a second writer matches zero rows'
);

SELECT lives_ok(
  $$ UPDATE pos_pending_operations
     SET intent_snapshot = jsonb_build_object(
       'kind', 'sale.prepare.presentation',
       'quoteId', 'quote-1',
       'name', 'B'
     )
     WHERE idempotency_key = '22222222-2222-4222-8222-222222222801'
       AND intent_snapshot IS NULL $$,
  'losing compare-and-set updates zero rows and does not throw'
);

SELECT is(
  (SELECT intent_snapshot->>'name' FROM pos_pending_operations
    WHERE idempotency_key = '22222222-2222-4222-8222-222222222801'),
  'A',
  'losing compare-and-set leaves snapshot A in place'
);

SELECT lives_ok(
  $$ UPDATE pos_pending_operations
     SET intent_snapshot = intent_snapshot
     WHERE idempotency_key = '22222222-2222-4222-8222-222222222801' $$,
  'same-value intent update is allowed'
);

SELECT throws_ok(
  $$ UPDATE pos_pending_operations
     SET intent_snapshot = jsonb_build_object(
       'kind', 'sale.prepare.presentation',
       'quoteId', 'quote-1',
       'name', 'B'
     )
     WHERE idempotency_key = '22222222-2222-4222-8222-222222222801' $$,
  '55000',
  NULL,
  'replacing snapshot A with B is rejected'
);

SELECT throws_ok(
  $$ UPDATE pos_pending_operations
     SET intent_snapshot = NULL
     WHERE idempotency_key = '22222222-2222-4222-8222-222222222801' $$,
  '55000',
  NULL,
  'clearing a bound intent_snapshot is rejected'
);

SELECT is(
  (SELECT intent_snapshot->>'name' FROM pos_pending_operations
    WHERE idempotency_key = '22222222-2222-4222-8222-222222222801'),
  'A',
  'rejected replace and clear leave snapshot A authoritative'
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

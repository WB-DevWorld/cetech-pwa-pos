-- Mirror of tests/integration/rls/test_rls_isolation.sql for supabase test db.
-- Canonical suite: tests/integration/rls/. Keep these files identical aside from this header.
-- Synthetic actors only. No training-site customers or orders.

BEGIN;

CREATE OR REPLACE FUNCTION pos_test_set_claims(
  p_org text,
  p_locs text[],
  p_actor text,
  p_register text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'role', 'authenticated',
      'sub', '00000000-0000-4000-8000-000000000001',
      'app_metadata', json_build_object(
        'organization_id', p_org,
        'location_ids', to_jsonb(p_locs),
        'actor_id', p_actor,
        'register_id', p_register
      )
    )::text,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION pos_test_clear_claims() RETURNS void
LANGUAGE sql
AS $$
  SELECT set_config('request.jwt.claims', '{}', true);
$$;

-- Test-only close. Not a production RPC. CORE-07 owns authoritative close / Z.
CREATE OR REPLACE FUNCTION pos_test_force_close(p_shift uuid, p_counted bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE pos_shifts
  SET status = 'closed',
      counted_cash_minor = p_counted
  WHERE id = p_shift;
END;
$$;

SELECT plan(44);

SELECT pos_test_clear_claims();

SET ROLE anon;
SELECT throws_ok(
  $$ SELECT count(*) FROM pos_registers $$,
  '42501',
  NULL,
  'anonymous cannot read registers'
);
RESET ROLE;

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'cashier_a', 'reg_a');
SET ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM pos_registers WHERE id = 'reg_a'),
  1,
  'cashier can read authorized register'
);
SELECT is(
  (SELECT count(*)::int FROM pos_organizations WHERE id = 'org_b'),
  0,
  'cashier cannot read other organization'
);
SELECT is(
  (SELECT count(*)::int FROM pos_registers WHERE id = 'reg_b'),
  0,
  'cashier cannot read other location register'
);
RESET ROLE;

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'forged_actor', 'reg_a');
SET ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM pos_registers),
  0,
  'forged actor without assignment cannot read registers'
);
RESET ROLE;

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'cashier_a', 'reg_a');
SET ROLE authenticated;
SELECT throws_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, operation, idempotency_key, request_hash, status
     ) VALUES (
       'org_b', 'loc_b1', 'shift.open',
       '10000000-0000-4000-8000-000000000001',
       repeat('ab', 32), 'pending'
     ) $$,
  '42501',
  NULL,
  'cannot insert pending operation for another organization'
);
RESET ROLE;

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'cashier_a', 'reg_a');
SET ROLE authenticated;
SELECT lives_ok(
  $$ INSERT INTO pos_shifts (
       register_id, device_id, opening_float_minor, opening_float_currency
     ) VALUES (
       'reg_a', '00000000-0000-4000-8000-0000000000a1', 10000, 'GHS'
     ) $$,
  'cashier can open assigned register shift'
);
RESET ROLE;

SELECT set_config(
  'pos_test.open_shift',
  (SELECT id::text FROM pos_shifts WHERE register_id = 'reg_a' AND status = 'open' LIMIT 1),
  true
);

SELECT is(
  (SELECT expected_cash_minor::bigint FROM pos_shifts WHERE id = current_setting('pos_test.open_shift')::uuid),
  10000::bigint,
  'expected cash starts at opening float'
);

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'cashier_a', 'reg_a');
SET ROLE authenticated;
SELECT throws_ok(
  $$ INSERT INTO pos_shifts (
       register_id, device_id, opening_float_minor, opening_float_currency
     ) VALUES (
       'reg_b', '00000000-0000-4000-8000-0000000000a1', 10000, 'GHS'
     ) $$,
  NULL,
  NULL,
  'cashier cannot open shift on other location register'
);
RESET ROLE;

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'cashier_a', 'reg_a');
SET ROLE authenticated;
INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason)
SELECT id, 'pay_in', 500, 'GHS', 'manager_a', 'float top-up'
FROM pos_shifts WHERE register_id = 'reg_a' AND status = 'open'
LIMIT 1;
SELECT is(
  (SELECT actor_id FROM pos_cash_movements WHERE kind = 'pay_in' ORDER BY created_at DESC LIMIT 1),
  'cashier_a',
  'client-supplied actor_id does not grant identity'
);
RESET ROLE;

SELECT set_config(
  'pos_test.pay_in',
  (SELECT id::text FROM pos_cash_movements WHERE kind = 'pay_in' ORDER BY created_at DESC LIMIT 1),
  true
);

SELECT is(
  (SELECT expected_cash_minor::bigint FROM pos_shifts WHERE id = current_setting('pos_test.open_shift')::uuid),
  10500::bigint,
  'positive movement increases expected cash'
);

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'cashier_a', 'reg_a');
SET ROLE authenticated;
INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason)
VALUES (current_setting('pos_test.open_shift')::uuid, 'pay_out', -300, 'GHS', 'cashier_a', 'change');
RESET ROLE;

SELECT is(
  (SELECT expected_cash_minor::bigint FROM pos_shifts WHERE id = current_setting('pos_test.open_shift')::uuid),
  10200::bigint,
  'allowed negative movement decreases expected cash'
);

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'cashier_a', 'reg_a');
SET ROLE authenticated;
SELECT throws_ok(
  'INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason) VALUES ('
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''pay_out'', -20000, ''GHS'', ''cashier_a'', ''too much'')',
  '23514',
  NULL,
  'movement that would make expected cash negative is rejected'
);
RESET ROLE;

SELECT is(
  (SELECT expected_cash_minor::bigint FROM pos_shifts WHERE id = current_setting('pos_test.open_shift')::uuid),
  10200::bigint,
  'expected cash unchanged after rejected negative operation'
);

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'forged_actor', 'reg_a');
SET ROLE authenticated;
SELECT throws_ok(
  'INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason) VALUES ('
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''pay_in'', 100, ''GHS'', ''forged_actor'', ''unauth'')',
  'P0002',
  NULL,
  'unauthorized cash movement is rejected'
);
RESET ROLE;

SELECT pos_test_set_claims('org_a', ARRAY['loc_a2'], 'cashier_a', 'reg_b');
SET ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM pos_cash_movements),
  0,
  'cashier without loc_a2 assignment cannot read loc_a2 movements'
);
RESET ROLE;

-- Correction negative cases against the pay_in row.
SELECT throws_ok(
  'INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason, corrects_movement_id) VALUES ('
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''correction'', -500, ''GHS'', ''cashier_a'', ''no approval'', '
  || quote_literal(current_setting('pos_test.pay_in'))
  || ')',
  '23514',
  NULL,
  'correction without approval is rejected'
);

SELECT throws_ok(
  'INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason, approval_id) VALUES ('
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''correction'', -500, ''GHS'', ''cashier_a'', ''no original'', '
  || quote_literal('30000000-0000-4000-8000-000000000003')
  || ')',
  '23514',
  NULL,
  'correction without original movement is rejected'
);

SELECT throws_ok(
  'INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason, corrects_movement_id, approval_id) VALUES ('
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''correction'', -100, ''GHS'', ''cashier_a'', ''wrong amount'', '
  || quote_literal(current_setting('pos_test.pay_in'))
  || ', '
  || quote_literal('30000000-0000-4000-8000-000000000004')
  || ')',
  '23514',
  NULL,
  'correction with wrong reversal amount is rejected'
);

SELECT throws_ok(
  'INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason, corrects_movement_id, approval_id) VALUES ('
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''correction'', -500, ''USD'', ''cashier_a'', ''wrong currency'', '
  || quote_literal(current_setting('pos_test.pay_in'))
  || ', '
  || quote_literal('30000000-0000-4000-8000-000000000005')
  || ')',
  '23514',
  NULL,
  'correction with wrong currency is rejected'
);

INSERT INTO pos_devices (id, organization_id, location_id, label, status) VALUES
  ('00000000-0000-4000-8000-0000000000a2', 'org_a', 'loc_a2', 'Device A2', 'active'),
  ('00000000-0000-4000-8000-0000000000b1', 'org_b', 'loc_b1', 'Device B', 'active');
INSERT INTO pos_registers (id, organization_id, location_id, name, currency, status) VALUES
  ('reg_xb', 'org_b', 'loc_b1', 'Register XB', 'GHS', 'active');
INSERT INTO pos_shifts (
  register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
) VALUES (
  'reg_b', '00000000-0000-4000-8000-0000000000a2', 2000, 'GHS', 'manager_a'
);
INSERT INTO pos_shifts (
  register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
) VALUES (
  'reg_xb', '00000000-0000-4000-8000-0000000000b1', 4000, 'GHS', 'actor_b'
);

SELECT set_config(
  'pos_test.shift_b',
  (SELECT id::text FROM pos_shifts WHERE register_id = 'reg_b' AND status = 'open' LIMIT 1),
  true
);
SELECT set_config(
  'pos_test.shift_xb',
  (SELECT id::text FROM pos_shifts WHERE register_id = 'reg_xb' AND status = 'open' LIMIT 1),
  true
);
SELECT set_config(
  'pos_test.float_b',
  (SELECT id::text FROM pos_cash_movements WHERE shift_id = current_setting('pos_test.shift_b')::uuid AND kind = 'opening_float' LIMIT 1),
  true
);
SELECT set_config(
  'pos_test.float_xb',
  (SELECT id::text FROM pos_cash_movements WHERE shift_id = current_setting('pos_test.shift_xb')::uuid AND kind = 'opening_float' LIMIT 1),
  true
);

SELECT throws_ok(
  'INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason, corrects_movement_id, approval_id) VALUES ('
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''correction'', -2000, ''GHS'', ''cashier_a'', ''cross shift'', '
  || quote_literal(current_setting('pos_test.float_b'))
  || ', '
  || quote_literal('30000000-0000-4000-8000-000000000006')
  || ')',
  '23514',
  NULL,
  'correction cannot reference another shift'
);

SELECT throws_ok(
  'INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason, corrects_movement_id, approval_id) VALUES ('
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''correction'', -2000, ''GHS'', ''cashier_a'', ''cross location'', '
  || quote_literal(current_setting('pos_test.float_b'))
  || ', '
  || quote_literal('30000000-0000-4000-8000-000000000007')
  || ')',
  '23514',
  NULL,
  'correction cannot reference another location'
);

SELECT throws_ok(
  'INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason, corrects_movement_id, approval_id) VALUES ('
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''correction'', -4000, ''GHS'', ''cashier_a'', ''cross org'', '
  || quote_literal(current_setting('pos_test.float_xb'))
  || ', '
  || quote_literal('30000000-0000-4000-8000-000000000008')
  || ')',
  '23514',
  NULL,
  'correction cannot reference another organization'
);

SELECT lives_ok(
  'INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason, corrects_movement_id, approval_id) VALUES ('
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''correction'', -500, ''GHS'', ''cashier_a'', ''exact reverse'', '
  || quote_literal(current_setting('pos_test.pay_in'))
  || ', '
  || quote_literal('30000000-0000-4000-8000-000000000009')
  || ')',
  'valid correction exactly reverses the original movement'
);

SELECT is(
  (SELECT signed_amount_minor::bigint FROM pos_cash_movements WHERE id = current_setting('pos_test.pay_in')::uuid),
  500::bigint,
  'original movement is unchanged after correction'
);

-- Pending-operation scope.
SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'cashier_a', 'reg_a');
SET ROLE authenticated;
SELECT throws_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, register_id, operation, idempotency_key, request_hash, status
     ) VALUES (
       'org_a', 'loc_a1', 'reg_b', 'cash.movement',
       '21000000-0000-4000-8000-000000000010',
       repeat('11', 32), 'pending'
     ) $$,
  '23503',
  NULL,
  'pending operation cannot use another location register'
);
RESET ROLE;

SELECT throws_ok(
  'INSERT INTO pos_pending_operations (
     organization_id, location_id, shift_id, operation, idempotency_key, request_hash, status
   ) VALUES (
     ''org_a'', ''loc_a1'', '
  || quote_literal(current_setting('pos_test.shift_b'))
  || ', ''cash.movement'', ''21000000-0000-4000-8000-000000000011'', '
  || quote_literal(repeat('12', 32))
  || ', ''pending'')',
  '23503',
  NULL,
  'pending operation cannot use another location shift'
);

SELECT throws_ok(
  'INSERT INTO pos_pending_operations (
     organization_id, location_id, shift_id, operation, idempotency_key, request_hash, status
   ) VALUES (
     ''org_a'', ''loc_a1'', '
  || quote_literal(current_setting('pos_test.shift_xb'))
  || ', ''cash.movement'', ''21000000-0000-4000-8000-000000000012'', '
  || quote_literal(repeat('13', 32))
  || ', ''pending'')',
  '23503',
  NULL,
  'pending operation cannot use a cross-organization shift'
);

SELECT throws_ok(
  'INSERT INTO pos_pending_operations (
     organization_id, location_id, register_id, shift_id, operation, idempotency_key, request_hash, status
   ) VALUES (
     ''org_a'', ''loc_a1'', ''reg_a'', '
  || quote_literal(current_setting('pos_test.shift_b'))
  || ', ''cash.movement'', ''21000000-0000-4000-8000-000000000013'', '
  || quote_literal(repeat('14', 32))
  || ', ''pending'')',
  '23503',
  NULL,
  'pending operation rejects shift and register mismatch'
);

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'cashier_a', 'reg_a');
SET ROLE authenticated;
SELECT lives_ok(
  'INSERT INTO pos_pending_operations (
     organization_id, location_id, register_id, shift_id, operation, idempotency_key, request_hash, status
   ) VALUES (
     ''org_a'', ''loc_a1'', ''reg_a'', '
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''cash.movement'', ''20000000-0000-4000-8000-000000000002'', '
  || quote_literal(repeat('cd', 32))
  || ', ''pending'')',
  'valid pending operation accepts matching org/location/register/shift'
);
SELECT throws_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, operation, idempotency_key, request_hash, status
     ) VALUES (
       'org_a', 'loc_a1', 'cash.movement',
       '20000000-0000-4000-8000-000000000002',
       repeat('ef', 32), 'pending'
     ) $$,
  '23505',
  NULL,
  'duplicate idempotency key is rejected'
);
RESET ROLE;

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'cashier_a', 'reg_a');
SET ROLE authenticated;
SELECT throws_ok(
  $$ UPDATE pos_cash_movements SET reason = 'tamper' WHERE kind = 'opening_float' $$,
  '42501',
  NULL,
  'authenticated cannot update cash movements'
);
SELECT throws_ok(
  $$ INSERT INTO pos_outbox_events (
       organization_id, location_id, aggregate_type, aggregate_id, event_type
     ) VALUES (
       'org_a', 'loc_a1', 'shift', 'shift-1', 'shift.opened'
     ) $$,
  '42501',
  NULL,
  'authenticated cannot insert outbox events'
);
RESET ROLE;

SELECT throws_ok(
  $$ UPDATE pos_cash_movements SET reason = 'tamper' WHERE kind = 'opening_float' $$,
  '55000',
  NULL,
  'cash movement update is rejected at the database'
);
SELECT throws_ok(
  $$ DELETE FROM pos_cash_movements WHERE kind = 'opening_float' $$,
  '55000',
  NULL,
  'cash movement delete is rejected at the database'
);

SELECT is(
  (SELECT count(*)::int FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'pos_close_shift'),
  0,
  'no production authenticated close RPC'
);

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'cashier_a', 'reg_a');
SET ROLE authenticated;
SELECT throws_ok(
  'UPDATE pos_shifts SET status = ''closed'', counted_cash_minor = 10200 WHERE id = '
  || quote_literal(current_setting('pos_test.open_shift'))::text,
  '42501',
  NULL,
  'authenticated cannot close a shift through table update'
);
RESET ROLE;

SELECT pos_test_force_close(current_setting('pos_test.open_shift')::uuid, 10200);

SELECT throws_ok(
  'INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason) VALUES ('
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''pay_in'', 100, ''GHS'', ''cashier_a'', ''after close'')',
  '55000',
  NULL,
  'closed shift cannot accept cash movements'
);

SELECT throws_ok(
  'UPDATE pos_shifts SET counted_cash_minor = 1 WHERE id = '
  || quote_literal(current_setting('pos_test.open_shift')),
  '55000',
  NULL,
  'closed shift remains immutable'
);

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'cashier_a', 'reg_a');
SET ROLE authenticated;
SELECT lives_ok(
  $$ INSERT INTO pos_shifts (
       register_id, device_id, opening_float_minor, opening_float_currency
     ) VALUES (
       'reg_a', '00000000-0000-4000-8000-0000000000a1', 2000, 'GHS'
     ) $$,
  'new shift can open after previous close'
);
SELECT throws_ok(
  $$ INSERT INTO pos_shifts (
       register_id, device_id, opening_float_minor, opening_float_currency
     ) VALUES (
       'reg_a', '00000000-0000-4000-8000-0000000000a1', 3000, 'GHS'
     ) $$,
  '23505',
  NULL,
  'one active shift per register'
);
RESET ROLE;

SELECT pos_test_clear_claims();
SET ROLE service_role;
SELECT ok(
  (SELECT count(*)::int FROM pos_organizations WHERE id = 'org_b') = 1,
  'service_role bypasses RLS and must never be treated as cashier authorization'
);
SELECT throws_ok(
  $$ INSERT INTO pos_outbox_events (
       organization_id, location_id, aggregate_type, aggregate_id, event_type
     ) VALUES (
       'org_a', 'loc_b1', 'shift', 'shift-x', 'shift.opened'
     ) $$,
  '23503',
  NULL,
  'trusted outbox insert cannot reference another organization location'
);
SELECT lives_ok(
  $$ INSERT INTO pos_outbox_events (
       organization_id, location_id, aggregate_type, aggregate_id, event_type
     ) VALUES (
       'org_a', 'loc_a1', 'shift', 'shift-1', 'shift.opened'
     ) $$,
  'trusted outbox insert accepts same-organization location'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;

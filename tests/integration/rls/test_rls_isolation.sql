-- Canonical RLS/invariant tests. Invoked by supabase/tests wrappers.
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

SELECT plan(19);

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

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'cashier_a', 'reg_a');
SET ROLE authenticated;
INSERT INTO pos_pending_operations (
  organization_id, location_id, operation, idempotency_key, request_hash, status
) VALUES (
  'org_a', 'loc_a1', 'cash.movement',
  '20000000-0000-4000-8000-000000000002',
  repeat('cd', 32), 'pending'
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

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'cashier_a', 'reg_a');
SET ROLE authenticated;
SELECT pos_close_shift(
  current_setting('pos_test.open_shift')::uuid,
  10500
);
SELECT throws_ok(
  'INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason) VALUES ('
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''pay_in'', 100, ''GHS'', ''cashier_a'', ''after close'')',
  '55000',
  NULL,
  'closed shift cannot accept cash movements'
);
RESET ROLE;

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
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;

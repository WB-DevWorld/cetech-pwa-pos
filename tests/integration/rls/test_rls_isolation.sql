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

SELECT plan(81);

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

SELECT is(
  (SELECT count(*)::int FROM pos_cash_movements
    WHERE shift_id = current_setting('pos_test.open_shift')::uuid
      AND kind = 'opening_float'),
  1,
  'opening float ledger row exists exactly once'
);

SELECT is(
  (SELECT expected_cash_minor::bigint FROM pos_shifts WHERE id = current_setting('pos_test.open_shift')::uuid),
  (SELECT opening_float_minor::bigint FROM pos_shifts WHERE id = current_setting('pos_test.open_shift')::uuid),
  'expected cash equals opening float exactly once after shift open'
);

SELECT is(
  (SELECT count(*)::int
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'pos_lock_shift_for_cash'),
  0,
  'no public callable cash-lock helper'
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

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'cashier_a', 'reg_a');
SET ROLE authenticated;
SELECT throws_ok(
  'INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason) VALUES ('
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''pay_in'', 100, ''USD'', ''cashier_a'', ''wrong currency'')',
  '23514',
  NULL,
  'non-correction cash movement with mismatched currency is rejected'
);
SELECT throws_ok(
  'INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason) VALUES ('
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''opening_float'', 100, ''GHS'', ''cashier_a'', ''forged float'')',
  '42501',
  NULL,
  'authenticated cannot forge opening_float'
);
SELECT throws_ok(
  'INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason) VALUES ('
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''cash_sale'', 100, ''GHS'', ''cashier_a'', ''forged sale'')',
  '42501',
  NULL,
  'authenticated cannot forge cash_sale'
);
SELECT throws_ok(
  'INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason) VALUES ('
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''cash_refund'', -100, ''GHS'', ''cashier_a'', ''forged refund'')',
  '42501',
  NULL,
  'authenticated cannot forge cash_refund'
);
SELECT throws_ok(
  'INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id) VALUES ('
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''pay_in'', 100, ''GHS'', ''cashier_a'')',
  '23514',
  NULL,
  'authenticated cash command requires a reason'
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

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'manager_a', 'reg_a');
SET ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM pos_staff_register_assignments WHERE location_id = 'loc_a2'),
  0,
  'session scoped to loc_a1 cannot read register assignments from loc_a2'
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
INSERT INTO pos_shifts (
  register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
) VALUES (
  'reg_a2', '00000000-0000-4000-8000-0000000000a1', 1500, 'GHS', 'manager_a'
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
  'pos_test.shift_a2',
  (SELECT id::text FROM pos_shifts WHERE register_id = 'reg_a2' AND status = 'open' LIMIT 1),
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

SELECT set_config(
  'pos_test.correction',
  (SELECT id::text FROM pos_cash_movements WHERE kind = 'correction' ORDER BY created_at DESC LIMIT 1),
  true
);

SELECT is(
  (SELECT signed_amount_minor::bigint FROM pos_cash_movements WHERE id = current_setting('pos_test.pay_in')::uuid),
  500::bigint,
  'original movement is unchanged after correction'
);

SELECT throws_ok(
  'INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason, corrects_movement_id, approval_id) VALUES ('
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''correction'', -500, ''GHS'', ''cashier_a'', ''second correction'', '
  || quote_literal(current_setting('pos_test.pay_in'))
  || ', '
  || quote_literal('30000000-0000-4000-8000-00000000000a')
  || ')',
  '23505',
  NULL,
  'duplicate correction of the same original is rejected'
);

SELECT throws_ok(
  'INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason, corrects_movement_id, approval_id) VALUES ('
  || quote_literal(current_setting('pos_test.open_shift'))
  || ', ''correction'', 500, ''GHS'', ''cashier_a'', ''correct the correction'', '
  || quote_literal(current_setting('pos_test.correction'))
  || ', '
  || quote_literal('30000000-0000-4000-8000-00000000000b')
  || ')',
  '23514',
  NULL,
  'correction of a correction is rejected'
);

SELECT is(
  (SELECT expected_cash_minor::bigint FROM pos_shifts WHERE id = current_setting('pos_test.open_shift')::uuid),
  (
    SELECT (s.opening_float_minor + COALESCE(SUM(m.signed_amount_minor) FILTER (WHERE m.kind <> 'opening_float'), 0))::bigint
    FROM pos_shifts s
    LEFT JOIN pos_cash_movements m ON m.shift_id = s.id
    WHERE s.id = current_setting('pos_test.open_shift')::uuid
    GROUP BY s.opening_float_minor
  ),
  'expected cash equals opening float plus committed non-opening deltas'
);

SELECT set_config(
  'pos_test.expected_before_multi',
  (SELECT expected_cash_minor::text FROM pos_shifts WHERE id = current_setting('pos_test.open_shift')::uuid),
  true
);

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'cashier_a', 'reg_a');
SET ROLE authenticated;
INSERT INTO pos_cash_movements (shift_id, kind, signed_amount_minor, currency, actor_id, reason)
VALUES
  (current_setting('pos_test.open_shift')::uuid, 'pay_in', 100, 'GHS', 'cashier_a', 'multi-row A'),
  (current_setting('pos_test.open_shift')::uuid, 'pay_out', -30, 'GHS', 'cashier_a', 'multi-row B');
RESET ROLE;

SELECT is(
  (SELECT expected_cash_minor::bigint FROM pos_shifts WHERE id = current_setting('pos_test.open_shift')::uuid),
  (current_setting('pos_test.expected_before_multi')::bigint + 70),
  'single-statement multi-row cash insert applies both expected-cash deltas'
);
SELECT is(
  (SELECT count(*)::int FROM pos_cash_movements
    WHERE shift_id = current_setting('pos_test.open_shift')::uuid
      AND reason IN ('multi-row A', 'multi-row B')),
  2,
  'single-statement multi-row cash insert persists both ledger rows'
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
SELECT throws_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, register_id, operation, idempotency_key, request_hash, status
     ) VALUES (
       'org_a', 'loc_a1', 'reg_a2', 'cash.movement',
       '21000000-0000-4000-8000-000000000014',
       repeat('15', 32), 'pending'
     ) $$,
  '42501',
  NULL,
  'pending operation cannot use an unassigned same-location register'
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
SELECT throws_ok(
  'INSERT INTO pos_pending_operations (
     organization_id, location_id, shift_id, operation, idempotency_key, request_hash, status
   ) VALUES (
     ''org_a'', ''loc_a1'', '
  || quote_literal(current_setting('pos_test.shift_a2'))
  || ', ''cash.movement'', ''21000000-0000-4000-8000-000000000015'', '
  || quote_literal(repeat('16', 32))
  || ', ''pending'')',
  '42501',
  NULL,
  'pending operation cannot use an unassigned same-location shift'
);
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
  'same organization + same operation + same key is rejected'
);
SELECT lives_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, register_id, operation, idempotency_key, request_hash, status
     ) VALUES (
       'org_a', 'loc_a1', 'reg_a', 'shift.open',
       '20000000-0000-4000-8000-000000000002',
       repeat('aa', 32), 'pending'
     ) $$,
  'same organization + different operation + same key is allowed'
);
RESET ROLE;

SELECT pos_test_clear_claims();
SET ROLE service_role;
SELECT lives_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, operation, idempotency_key, request_hash, status
     ) VALUES (
       'org_b', 'loc_b1', 'cash.movement',
       '20000000-0000-4000-8000-000000000002',
       repeat('bb', 32), 'pending'
     ) $$,
  'different organization + same operation + same key is allowed'
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
SELECT throws_ok(
  $$ SELECT count(*) FROM pos_outbox_events $$,
  '42501',
  NULL,
  'authenticated cannot select raw outbox rows'
);
SELECT throws_ok(
  $$ SELECT count(*) FROM pos_integration_watermarks $$,
  '42501',
  NULL,
  'authenticated cannot select raw integration watermarks'
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
  'UPDATE pos_shifts SET status = ''closed'', counted_cash_minor = 9770 WHERE id = '
  || quote_literal(current_setting('pos_test.open_shift'))::text,
  '42501',
  NULL,
  'authenticated cannot close a shift through table update'
);
RESET ROLE;

SELECT pos_test_force_close(current_setting('pos_test.open_shift')::uuid, 9770);

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

SELECT throws_ok(
  'DELETE FROM pos_shifts WHERE id = '
  || quote_literal(current_setting('pos_test.open_shift')),
  '55000',
  NULL,
  'closed shift cannot be deleted'
);

SET ROLE service_role;
SELECT throws_ok(
  'DELETE FROM pos_shifts WHERE id = '
  || quote_literal(current_setting('pos_test.open_shift')),
  '42501',
  NULL,
  'service_role has no DELETE grant on shifts'
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

SELECT pos_test_clear_claims();
SET ROLE anon;
SELECT throws_ok(
  $$ SELECT count(*) FROM pos_staff_sessions $$,
  '42501',
  NULL,
  'anonymous cannot read staff sessions'
);
RESET ROLE;

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'cashier_a', 'reg_a');
SET ROLE authenticated;
SELECT throws_ok(
  $$ SELECT count(*) FROM pos_staff_sessions $$,
  '42501',
  NULL,
  'authenticated cannot read staff sessions'
);
SELECT throws_ok(
  $$ INSERT INTO pos_staff_sessions (
       organization_id, actor_id, csrf_token, session_payload, expires_at
     ) VALUES (
       'org_a',
       'cashier_a',
       'csrf-token',
       jsonb_build_object(
         'actorId', 'cashier_a',
         'displayName', 'Cashier A',
         'organizationId', 'org_a',
         'locationIds', jsonb_build_array('loc_a1'),
         'capabilities', jsonb_build_array(),
         'expiresAt', '2099-01-01T00:00:00.000Z'
       ),
       now() + interval '1 hour'
     ) $$,
  '42501',
  NULL,
  'authenticated cannot insert staff sessions'
);
SELECT throws_ok(
  $$ UPDATE pos_staff_sessions SET revoked_at = now() $$,
  '42501',
  NULL,
  'authenticated cannot update staff sessions'
);
RESET ROLE;

SELECT pos_test_clear_claims();
SET ROLE service_role;
SELECT lives_ok(
  $$ INSERT INTO pos_staff_sessions (
       id, organization_id, actor_id, csrf_token, session_payload, expires_at
     ) VALUES (
       'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
       'org_synthetic_session',
       'actor_synthetic_session',
       'csrf-token',
       jsonb_build_object(
         'actorId', 'actor_synthetic_session',
         'displayName', 'Synthetic',
         'organizationId', 'org_synthetic_session',
         'locationIds', jsonb_build_array('loc_x'),
         'capabilities', jsonb_build_array(),
         'expiresAt', '2099-01-01T00:00:00.000Z'
       ),
       now() + interval '1 hour'
     ) $$,
  'service_role can insert staff sessions as infrastructure access, not business authorization'
);
SELECT is(
  (SELECT count(*)::int FROM pos_staff_sessions WHERE id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'),
  1,
  'service_role can select inserted staff sessions'
);
SELECT lives_ok(
  $$ UPDATE pos_staff_sessions
     SET revoked_at = now()
     WHERE id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' $$,
  'service_role revokes staff sessions by update'
);
SELECT throws_ok(
  $$ DELETE FROM pos_staff_sessions WHERE id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' $$,
  '42501',
  NULL,
  'service_role cannot delete staff sessions'
);
RESET ROLE;

SELECT pos_test_clear_claims();
SET ROLE anon;
SELECT throws_ok(
  $$ SELECT count(*) FROM pos_catalog_items $$,
  '42501',
  NULL,
  'anonymous cannot read catalog projection'
);
RESET ROLE;

SELECT pos_test_set_claims('org_a', ARRAY['loc_a1'], 'cashier_a', 'reg_a');
SET ROLE authenticated;
SELECT throws_ok(
  $$ SELECT count(*) FROM pos_catalog_items $$,
  '42501',
  NULL,
  'authenticated cannot select catalog projection'
);
SELECT throws_ok(
  $$ INSERT INTO pos_catalog_items (
       organization_id, item_id, source_system, source_item_id, source_version,
       projection_version, kind, name, barcodes, stock_status
     ) VALUES (
       'org_a', 'item-forge', 'transitional-commerce', 'src-forge', '1',
       1, 'simple', 'Forged', ARRAY['999'], 'unknown'
     ) $$,
  '42501',
  NULL,
  'authenticated cannot insert catalog projection'
);
RESET ROLE;

SELECT pos_test_clear_claims();
SET ROLE service_role;
SELECT lives_ok(
  $$ INSERT INTO pos_catalog_items (
       organization_id, item_id, source_system, source_item_id, source_version,
       projection_version, kind, name, sku, barcodes, stock_status
     ) VALUES
     (
       'org_a', 'item-0000001', 'transitional-commerce', 'src-1', '1',
       1, 'simple', 'Synthetic one', '0001234567890', ARRAY['0001234567890'], 'unknown'
     ),
     (
       'org_a', 'item-0000002', 'transitional-commerce', 'src-2', '1',
       1, 'simple', 'Synthetic two', 'SKU-DUP-A', ARRAY['DUP000000001'], 'unknown'
     ),
     (
       'org_a', 'item-0000003', 'transitional-commerce', 'src-3', '1',
       1, 'simple', 'Synthetic three', 'SKU-DUP-B', ARRAY['DUP000000001'], 'unknown'
     ) $$,
  'service_role can insert catalog projection including duplicate barcodes and leading-zero sku'
);
SELECT is(
  (SELECT sku FROM pos_catalog_items WHERE item_id = 'item-0000001'),
  '0001234567890',
  'catalog sku/barcode strings preserve leading zeroes'
);
SELECT lives_ok(
  $$ UPDATE pos_catalog_items
     SET tombstoned_at = now(), barcodes = ARRAY[]::text[]
     WHERE item_id = 'item-0000003' $$,
  'service_role can tombstone a catalog projection row'
);
SELECT throws_ok(
  $$ DELETE FROM pos_catalog_items WHERE item_id = 'item-0000001' $$,
  '42501',
  NULL,
  'service_role cannot delete catalog projection rows'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;

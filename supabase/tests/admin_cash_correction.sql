-- ADMIN-105 exact cash-movement reversal. Replay must not duplicate the ledger or the audit.
BEGIN;

SELECT plan(9);

SET ROLE authenticated;
SELECT throws_ok(
  $$ SELECT pos_admin_reverse_cash_movement(
       'org_a',
       '88888888-8888-4888-8888-888888888881',
       'drawer was short',
       'manager_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       '99999999-9999-4999-8999-999999999881'
     ) $$,
  '42501',
  NULL,
  'authenticated cannot invoke cash correction'
);
RESET ROLE;

SET ROLE service_role;
SELECT lives_ok(
  $$ INSERT INTO pos_shifts (
       register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
     ) VALUES (
       'reg_a', '00000000-0000-4000-8000-0000000000a1', 5000, 'GHS', 'cashier_a'
     ) $$,
  'service role can open a correction test shift'
);
SELECT set_config(
  'pos_test.admin_correction_shift',
  (SELECT id::text FROM pos_shifts WHERE register_id = 'reg_a' AND status = 'open' LIMIT 1),
  true
);

SELECT lives_ok(
  $$ INSERT INTO pos_cash_movements (
       id, shift_id, kind, signed_amount_minor, currency, actor_id, reason
     ) VALUES (
       '88888888-8888-4888-8888-888888888881',
       current_setting('pos_test.admin_correction_shift')::uuid,
       'pay_in', 2500, 'GHS', 'cashier_a', 'extra float'
     ) $$,
  'service role can record the original pay-in'
);

SELECT lives_ok(
  $$ SELECT pos_admin_reverse_cash_movement(
       'org_a',
       '88888888-8888-4888-8888-888888888881',
       'drawer was short',
       'manager_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       '99999999-9999-4999-8999-999999999881'
     ) $$,
  'manager correction reverses the original movement'
);

SELECT is(
  (SELECT signed_amount_minor::bigint FROM pos_cash_movements WHERE corrects_movement_id = '88888888-8888-4888-8888-888888888881'),
  -2500::bigint,
  'correction amount is the exact reverse'
);

SELECT is(
  (SELECT count(*)::integer FROM pos_admin_audit_events WHERE action = 'cash.correction.reversed'),
  1,
  'correction appends one admin audit event'
);

SELECT lives_ok(
  $$ SELECT pos_admin_reverse_cash_movement(
       'org_a',
       '88888888-8888-4888-8888-888888888881',
       'drawer was short',
       'manager_a',
       'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
       '99999999-9999-4999-8999-999999999882'
     ) $$,
  'repeat correction is accepted as a replay'
);

SELECT is(
  (SELECT count(*)::integer FROM pos_cash_movements WHERE corrects_movement_id = '88888888-8888-4888-8888-888888888881'),
  1,
  'replay does not insert a second correction'
);

SELECT is(
  (SELECT count(*)::integer FROM pos_admin_audit_events WHERE action = 'cash.correction.reversed'),
  1,
  'replay does not append a second audit event'
);

SELECT * FROM finish();
ROLLBACK;

-- CORE-05: one cash_sale per (organization_id, transaction_id).
-- Not the mirrored RLS suite. Do not copy this file into tests/integration/rls/.
-- Trusted-server (postgres) writes only; authenticated clients still cannot insert cash_sale.

BEGIN;

SELECT plan(7);

SELECT lives_ok(
  $$ INSERT INTO pos_shifts (
       register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
     ) VALUES (
       'reg_a', '00000000-0000-4000-8000-0000000000a1', 10000, 'GHS', 'cashier_a'
     ) $$,
  'trusted-server can open a shift for cash_sale uniqueness setup'
);

SELECT set_config(
  'pos_test.cash_shift',
  (SELECT id::text FROM pos_shifts WHERE register_id = 'reg_a' AND status = 'open' LIMIT 1),
  true
);

SELECT lives_ok(
  $$ INSERT INTO pos_cash_movements (
       shift_id, kind, signed_amount_minor, currency, actor_id, reason, transaction_id
     ) VALUES (
       current_setting('pos_test.cash_shift')::uuid,
       'cash_sale',
       1500,
       'GHS',
       'cashier_a',
       'cash sale',
       '11111111-1111-4111-8111-111111111111'
     ) $$,
  'trusted-server can insert the first cash_sale for a transaction'
);

SELECT throws_ok(
  $$ INSERT INTO pos_cash_movements (
       shift_id, kind, signed_amount_minor, currency, actor_id, reason, transaction_id
     ) VALUES (
       current_setting('pos_test.cash_shift')::uuid,
       'cash_sale',
       1500,
       'GHS',
       'cashier_a',
       'duplicate cash sale',
       '11111111-1111-4111-8111-111111111111'
     ) $$,
  '23505',
  NULL,
  'duplicate cash_sale for the same organization and transaction is rejected'
);

SELECT lives_ok(
  $$ INSERT INTO pos_cash_movements (
       shift_id, kind, signed_amount_minor, currency, actor_id, reason, transaction_id
     ) VALUES (
       current_setting('pos_test.cash_shift')::uuid,
       'cash_sale',
       900,
       'GHS',
       'cashier_a',
       'other sale',
       '11111111-1111-4111-8111-111111111112'
     ) $$,
  'cash_sale for a different transaction_id is allowed'
);

SELECT lives_ok(
  $$ INSERT INTO pos_cash_movements (
       shift_id, kind, signed_amount_minor, currency, actor_id, reason
     ) VALUES (
       current_setting('pos_test.cash_shift')::uuid,
       'pay_in',
       500,
       'GHS',
       'cashier_a',
       'float top-up'
     ) $$,
  'non-sale pay_in remains allowed beside cash_sale rows'
);

SELECT is(
  (SELECT count(*)::int FROM pos_cash_movements WHERE kind = 'cash_sale'),
  2,
  'exactly two cash_sale rows exist after the duplicate is rejected'
);

SELECT is(
  (SELECT count(*)::int FROM pos_cash_movements WHERE kind = 'pay_in'),
  1,
  'pay_in is unaffected by the cash_sale uniqueness invariant'
);

SELECT finish();
ROLLBACK;

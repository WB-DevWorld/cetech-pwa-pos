-- Durable monotonic payment/sale floors for concurrent verification.
-- Synthetic fixtures only.

BEGIN;

SELECT plan(6);

SET ROLE service_role;
SELECT lives_ok(
  $$ INSERT INTO pos_shifts (
       register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
     ) VALUES (
       'reg_a', '00000000-0000-4000-8000-0000000000a1', 5000, 'GHS', 'cashier_a'
     ) $$,
  'service_role can open a shift for monotonic fixtures'
);
SELECT set_config(
  'pos_test.mono_shift',
  (SELECT id::text FROM pos_shifts WHERE register_id = 'reg_a' AND status = 'open' LIMIT 1),
  true
);

SELECT lives_ok(
  $$ INSERT INTO pos_checkout_sales (
       transaction_id, organization_id, location_id, register_id, shift_id, sale_id, status, record
     ) VALUES (
       '11111111-1111-4111-8111-111111111501',
       'org_a', 'loc_a1', 'reg_a',
       current_setting('pos_test.mono_shift')::uuid,
       'woo-pay01-mono', 'finalizing',
       jsonb_build_object(
         'status', 'finalizing',
         'prepared', jsonb_build_object('transactionId', '11111111-1111-4111-8111-111111111501')
       )
     ) $$,
  'finalizing sale exists for monotonic tests'
);

SELECT lives_ok(
  $$ INSERT INTO pos_checkout_payments (
       payment_id, organization_id, location_id, transaction_id, sale_id, evidence_id,
       tender, status, amount_minor, amount_currency, actor_id,
       provider, provider_reference, verified_at, verification_source
     ) VALUES (
       '22222222-2222-4222-8222-222222222501',
       'org_a', 'loc_a1',
       '11111111-1111-4111-8111-111111111501',
       'woo-pay01-mono',
       '33333333-3333-4333-8333-333333333501',
       'card', 'verified', 2900, 'GHS', 'cashier_a',
       'paystack', 'pos_pay01monoref', now(), 'provider_server_verification'
     ) $$,
  'verified electronic payment exists'
);

UPDATE pos_checkout_payments
   SET status = 'pending', attention_reason = 'stale pending'
 WHERE payment_id = '22222222-2222-4222-8222-222222222501';

SELECT is(
  (SELECT status FROM pos_checkout_payments WHERE payment_id = '22222222-2222-4222-8222-222222222501'),
  'verified',
  'verified payment cannot be downgraded to pending'
);

UPDATE pos_checkout_sales
   SET status = 'payment_pending',
       record = jsonb_build_object('status', 'payment_pending')
 WHERE transaction_id = '11111111-1111-4111-8111-111111111501';

SELECT is(
  (SELECT status FROM pos_checkout_sales WHERE transaction_id = '11111111-1111-4111-8111-111111111501'),
  'finalizing',
  'finalizing sale cannot regress to payment_pending'
);

SELECT is(
  (
    SELECT record ->> 'status'
      FROM pos_checkout_sales
     WHERE transaction_id = '11111111-1111-4111-8111-111111111501'
  ),
  'finalizing',
  'sale record JSON status stays finalizing after a stale overwrite'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;

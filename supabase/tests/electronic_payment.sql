-- PAY-01 / R7 electronic payment intent, provider reference uniqueness,
-- event dedupe, tenant scope, and cash-row compatibility after schema widening.
-- Not the mirrored RLS suite.

BEGIN;

SELECT plan(16);

SET ROLE anon;
SELECT throws_ok(
  $$ SELECT count(*) FROM pos_provider_payment_events $$,
  '42501',
  NULL,
  'anonymous cannot read provider payment events'
);
RESET ROLE;

SET ROLE authenticated;
SELECT throws_ok(
  $$ SELECT count(*) FROM pos_checkout_payments $$,
  '42501',
  NULL,
  'authenticated cannot read checkout payments'
);
SELECT throws_ok(
  $$ SELECT count(*) FROM pos_provider_payment_events $$,
  '42501',
  NULL,
  'authenticated cannot read provider payment events'
);
RESET ROLE;

SET ROLE service_role;
SELECT lives_ok(
  $$ INSERT INTO pos_shifts (
       register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
     ) VALUES (
       'reg_a', '00000000-0000-4000-8000-0000000000a1', 5000, 'GHS', 'cashier_a'
     ) $$,
  'service_role can open a shift for PAY-01 fixtures'
);
SELECT set_config(
  'pos_test.pay01_shift',
  (SELECT id::text FROM pos_shifts WHERE register_id = 'reg_a' AND status = 'open' LIMIT 1),
  true
);

SELECT lives_ok(
  $$ INSERT INTO pos_checkout_sales (
       transaction_id, organization_id, location_id, register_id, shift_id, sale_id, status, record
     ) VALUES (
       '11111111-1111-4111-8111-111111111201',
       'org_a', 'loc_a1', 'reg_a',
       current_setting('pos_test.pay01_shift')::uuid,
       'woo-pay01-cash', 'prepared',
       jsonb_build_object('prepared', jsonb_build_object('transactionId', '11111111-1111-4111-8111-111111111201'))
     ) $$,
  'service_role can persist a prepared sale for cash compatibility'
);

SELECT lives_ok(
  $$ INSERT INTO pos_checkout_payments (
       payment_id, organization_id, location_id, transaction_id, sale_id, evidence_id,
       tender, status, amount_minor, amount_currency, cash_received_minor, cash_received_currency,
       verified_at, verification_source, actor_id
     ) VALUES (
       '22222222-2222-4222-8222-222222222201',
       'org_a', 'loc_a1',
       '11111111-1111-4111-8111-111111111201',
       'woo-pay01-cash',
       '33333333-3333-4333-8333-333333333201',
       'cash', 'verified', 2900, 'GHS', 3000, 'GHS',
       now(), 'cash_ledger', 'cashier_a'
     ) $$,
  'cash rows remain valid after schema widening'
);

SELECT lives_ok(
  $$ INSERT INTO pos_checkout_sales (
       transaction_id, organization_id, location_id, register_id, shift_id, sale_id, status, record
     ) VALUES (
       '11111111-1111-4111-8111-111111111202',
       'org_a', 'loc_a1', 'reg_a',
       current_setting('pos_test.pay01_shift')::uuid,
       'woo-pay01-card', 'payment_pending',
       jsonb_build_object('prepared', jsonb_build_object('transactionId', '11111111-1111-4111-8111-111111111202'))
     ) $$,
  'service_role can persist a sale for an electronic intent'
);

SELECT lives_ok(
  $$ INSERT INTO pos_checkout_payments (
       payment_id, organization_id, location_id, transaction_id, sale_id,
       tender, status, amount_minor, amount_currency,
       actor_id, provider, provider_reference, initialize_status
     ) VALUES (
       '22222222-2222-4222-8222-222222222202',
       'org_a', 'loc_a1',
       '11111111-1111-4111-8111-111111111202',
       'woo-pay01-card',
       'card', 'awaiting_customer', 2900, 'GHS',
       'cashier_a', 'paystack', 'pos_pay01refaaaaaaaaaaaaaaaaaaaa', 'initialized'
     ) $$,
  'one electronic provider intent can be stored per transaction'
);

SELECT throws_ok(
  $$ INSERT INTO pos_checkout_payments (
       payment_id, organization_id, location_id, transaction_id, sale_id,
       tender, status, amount_minor, amount_currency,
       actor_id, provider, provider_reference, initialize_status
     ) VALUES (
       '22222222-2222-4222-8222-222222222203',
       'org_a', 'loc_a1',
       '11111111-1111-4111-8111-111111111202',
       'woo-pay01-card',
       'card', 'pending', 2900, 'GHS',
       'cashier_a', 'paystack', 'pos_pay01refbbbbbbbbbbbbbbbbbbbb', 'initialized'
     ) $$,
  '23505',
  NULL,
  'one provider intent per POS transaction'
);

SELECT lives_ok(
  $$ INSERT INTO pos_checkout_sales (
       transaction_id, organization_id, location_id, register_id, shift_id, sale_id, status, record
     ) VALUES (
       '11111111-1111-4111-8111-111111111203',
       'org_a', 'loc_a1', 'reg_a',
       current_setting('pos_test.pay01_shift')::uuid,
       'woo-pay01-card-2', 'prepared',
       jsonb_build_object('prepared', jsonb_build_object('transactionId', '11111111-1111-4111-8111-111111111203'))
     ) $$,
  'second sale exists for provider-reference uniqueness'
);

SELECT throws_ok(
  $$ INSERT INTO pos_checkout_payments (
       payment_id, organization_id, location_id, transaction_id, sale_id,
       tender, status, amount_minor, amount_currency,
       actor_id, provider, provider_reference, initialize_status
     ) VALUES (
       '22222222-2222-4222-8222-222222222204',
       'org_a', 'loc_a1',
       '11111111-1111-4111-8111-111111111203',
       'woo-pay01-card-2',
       'card', 'pending', 2900, 'GHS',
       'cashier_a', 'paystack', 'pos_pay01refaaaaaaaaaaaaaaaaaaaa', 'initialized'
     ) $$,
  '23505',
  NULL,
  'provider references are unique'
);

SELECT throws_ok(
  $$ INSERT INTO pos_checkout_payments (
       payment_id, organization_id, location_id, transaction_id, sale_id,
       tender, status, amount_minor, amount_currency, cash_received_minor, cash_received_currency,
       actor_id, provider, provider_reference
     ) VALUES (
       '22222222-2222-4222-8222-222222222205',
       'org_a', 'loc_a1',
       '11111111-1111-4111-8111-111111111203',
       'woo-pay01-card-2',
       'card', 'pending', 2900, 'GHS', 3000, 'GHS',
       'cashier_a', 'paystack', 'pos_pay01refcccccccccccccccccccc'
     ) $$,
  '23514',
  NULL,
  'electronic payments cannot store cash received'
);

SELECT lives_ok(
  $$ INSERT INTO pos_provider_payment_events (
       id, organization_id, location_id, provider, provider_reference, event_type,
       event_fingerprint, raw_body_hash, processing_status, payment_id, transaction_id
     ) VALUES (
       '44444444-4444-4444-8444-444444444201',
       'org_a', 'loc_a1', 'paystack', 'pos_pay01refaaaaaaaaaaaaaaaaaaaa', 'charge.success',
       'fp-pay01-1', 'ab', 'ingested',
       '22222222-2222-4222-8222-222222222202',
       '11111111-1111-4111-8111-111111111202'
     ) $$,
  'provider events correlate to a local payment'
);

SELECT throws_ok(
  $$ INSERT INTO pos_provider_payment_events (
       id, provider, event_type, event_fingerprint, raw_body_hash, processing_status
     ) VALUES (
       '44444444-4444-4444-8444-444444444202',
       'paystack', 'charge.success', 'fp-pay01-1', 'cd', 'ingested'
     ) $$,
  '23505',
  NULL,
  'duplicate provider events collapse on fingerprint'
);

SELECT lives_ok(
  $$ INSERT INTO pos_provider_payment_events (
       id, provider, provider_reference, event_type, event_fingerprint, raw_body_hash, processing_status
     ) VALUES (
       '44444444-4444-4444-8444-444444444203',
       'paystack', 'unknown-ref', 'charge.success', 'fp-pay01-unknown', 'ef', 'ignored'
     ) $$,
  'unknown provider references persist only as ignored diagnostic events'
);

SELECT throws_ok(
  $$ INSERT INTO pos_checkout_payments (
       payment_id, organization_id, location_id, transaction_id, sale_id, evidence_id,
       tender, status, amount_minor, amount_currency,
       actor_id, provider, provider_reference, verification_source, verified_at
     ) VALUES (
       '22222222-2222-4222-8222-222222222206',
       'org_a', 'loc_a1',
       '11111111-1111-4111-8111-111111111202',
       'woo-pay01-card',
       '33333333-3333-4333-8333-333333333206',
       'card', 'verified', 2900, 'GHS',
       'cashier_a', 'paystack', 'pos_pay01refdddddddddddddddddddd',
       'provider_server_verification', now()
     ) $$,
  '23505',
  NULL,
  'verified payment uniqueness remains one row per transaction'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;

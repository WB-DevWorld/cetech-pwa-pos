-- CORE-HARDEN-07 immutable checkout identity/evidence guards.
BEGIN;

SELECT plan(4);

SELECT pos_checkout_open_shift(
  '00000000-0000-4000-8000-000000000750'::uuid,
  'org_a', 'loc_a1', 'reg_a',
  '00000000-0000-4000-8000-0000000000a1'::uuid,
  'cashier_a', 10000, 'GHS', now()
);

INSERT INTO pos_checkout_sales (
  transaction_id, organization_id, location_id, register_id, shift_id, device_id,
  cashier_id, sale_id, order_reference, quote_fingerprint, total_minor, currency,
  status, commercial_confirmed, record
) VALUES (
  '00000000-0000-4000-8000-000000000751'::uuid,
  'org_a', 'loc_a1', 'reg_a',
  '00000000-0000-4000-8000-000000000750'::uuid,
  '00000000-0000-4000-8000-0000000000a1'::uuid,
  'cashier_a', 'sale-immutable', '751', 'fp-immutable',
  1500, 'GHS', 'prepared', false, '{"status":"prepared"}'::jsonb
);

SELECT lives_ok(
  $$ UPDATE pos_checkout_sales
     SET status = 'finalizing', record = '{"status":"finalizing"}'::jsonb
     WHERE transaction_id = '00000000-0000-4000-8000-000000000751'::uuid $$,
  'sale workflow status may advance without changing commercial identity'
);

SELECT throws_ok(
  $$ UPDATE pos_checkout_sales
     SET sale_id = 'different-sale'
     WHERE transaction_id = '00000000-0000-4000-8000-000000000751'::uuid $$,
  '55000',
  'checkout sale commercial identity is immutable',
  'saleId cannot be replaced by a racing retry'
);

INSERT INTO pos_checkout_payments (
  payment_id, transaction_id, organization_id, sale_id, evidence_id,
  amount_minor, currency, cash_received_minor, cash_received_currency,
  verified_at, actor_id, record
) VALUES (
  '00000000-0000-4000-8000-000000000752'::uuid,
  '00000000-0000-4000-8000-000000000751'::uuid,
  'org_a', 'sale-immutable',
  '00000000-0000-4000-8000-000000000753'::uuid,
  1500, 'GHS', 2000, 'GHS', now(), 'cashier_a', '{"status":"verified"}'::jsonb
);

SELECT throws_ok(
  $$ UPDATE pos_checkout_payments
     SET cash_received_minor = 3000
     WHERE payment_id = '00000000-0000-4000-8000-000000000752'::uuid $$,
  '55000',
  'verified checkout payment evidence is immutable',
  'verified cash evidence cannot be replaced by a racing upsert'
);

INSERT INTO pos_checkout_receipts (
  transaction_id, organization_id, receipt_id, snapshot
) VALUES (
  '00000000-0000-4000-8000-000000000751'::uuid,
  'org_a', 'rcpt-immutable', '{"id":"rcpt-immutable"}'::jsonb
);

SELECT throws_ok(
  $$ UPDATE pos_checkout_receipts
     SET snapshot = '{"id":"changed"}'::jsonb
     WHERE transaction_id = '00000000-0000-4000-8000-000000000751'::uuid $$,
  '55000',
  'operational POS receipt snapshot is immutable',
  'receipt evidence cannot be mutated after first persistence'
);

SELECT finish();
ROLLBACK;

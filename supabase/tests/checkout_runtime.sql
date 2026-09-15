-- CORE-HARDEN-07 durable checkout workflow invariants.
BEGIN;

SELECT plan(15);

SELECT lives_ok(
  $$ SELECT pos_checkout_open_shift(
       '00000000-0000-4000-8000-000000000710'::uuid,
       'org_a', 'loc_a1', 'reg_a',
       '00000000-0000-4000-8000-0000000000a1'::uuid,
       'cashier_a', 10000, 'GHS', now()
     ) $$,
  'durable checkout RPC can open an assigned register shift'
);

SELECT is(
  pos_checkout_record_cash_sale(
    '00000000-0000-4000-8000-000000000711'::uuid,
    'org_a', 'loc_a1', 'reg_a',
    '00000000-0000-4000-8000-000000000710'::uuid,
    'cashier_a',
    '00000000-0000-4000-8000-000000000712'::uuid,
    1500, 'GHS', now()
  ),
  'ok',
  'first cash-sale RPC records one ledger effect'
);

SELECT is(
  pos_checkout_record_cash_sale(
    '00000000-0000-4000-8000-000000000713'::uuid,
    'org_a', 'loc_a1', 'reg_a',
    '00000000-0000-4000-8000-000000000710'::uuid,
    'cashier_a',
    '00000000-0000-4000-8000-000000000712'::uuid,
    1500, 'GHS', now()
  ),
  'duplicate_sale',
  'retry cannot create a second cash-sale ledger effect'
);

SELECT is(
  (SELECT count(*)::int FROM pos_cash_movements
   WHERE kind = 'cash_sale' AND transaction_id = '00000000-0000-4000-8000-000000000712'::uuid),
  1,
  'duplicate cash retry leaves exactly one ledger row'
);

SELECT is(
  (pos_checkout_claim_idempotency(
    'org_a', 'payment.cash',
    '00000000-0000-4000-8000-000000000714'::uuid,
    repeat('a', 64)
  )->>'kind'),
  'acquired',
  'first durable idempotency claim is acquired'
);

UPDATE pos_checkout_idempotency
SET status = 'acknowledged', outcome = '{"status":"verified"}'::jsonb
WHERE organization_id = 'org_a'
  AND operation = 'payment.cash'
  AND idempotency_key = '00000000-0000-4000-8000-000000000714'::uuid;

SELECT is(
  (pos_checkout_claim_idempotency(
    'org_a', 'payment.cash',
    '00000000-0000-4000-8000-000000000714'::uuid,
    repeat('a', 64)
  )->>'kind'),
  'replay',
  'acknowledged durable idempotency claim replays after restart'
);

SELECT is(
  (pos_checkout_claim_idempotency(
    'org_a', 'payment.cash',
    '00000000-0000-4000-8000-000000000714'::uuid,
    repeat('b', 64)
  )->>'kind'),
  'conflict',
  'same key with different request hash fails closed'
);

INSERT INTO pos_checkout_quotes (
  organization_id, quote_id, location_id, location_name, fingerprint, snapshot, expires_at
) VALUES (
  'org_a', 'quote-core-harden-07', 'loc_a1', 'Location A1', 'fp-core-harden-07',
  '{"id":"quote-core-harden-07"}'::jsonb, now() + interval '15 minutes'
);

SELECT is(
  (SELECT count(*)::int FROM pos_checkout_quotes WHERE organization_id = 'org_a' AND quote_id = 'quote-core-harden-07'),
  1,
  'accepted quote snapshot persists once'
);

INSERT INTO pos_checkout_prepare_intents (
  transaction_id, organization_id, location_id, register_id, shift_id, device_id,
  cashier_id, cashier_name, quote_id, quote_fingerprint, request,
  idempotency_key, correlation_id
) VALUES (
  '00000000-0000-4000-8000-000000000720'::uuid,
  'org_a', 'loc_a1', 'reg_a',
  '00000000-0000-4000-8000-000000000710'::uuid,
  '00000000-0000-4000-8000-0000000000a1'::uuid,
  'cashier_a', 'Cashier A', 'quote-core-harden-07', 'fp-core-harden-07',
  '{"transactionId":"00000000-0000-4000-8000-000000000720"}'::jsonb,
  '00000000-0000-4000-8000-000000000721'::uuid,
  '00000000-0000-4000-8000-000000000722'::uuid
);

SELECT is(
  (SELECT count(*)::int FROM pos_checkout_prepare_intents WHERE transaction_id = '00000000-0000-4000-8000-000000000720'::uuid),
  1,
  'prepare intent survives independently of the Woo request outcome'
);

INSERT INTO pos_checkout_sales (
  transaction_id, organization_id, location_id, register_id, shift_id, device_id,
  cashier_id, sale_id, order_reference, quote_fingerprint, total_minor, currency,
  status, commercial_confirmed, record
) VALUES (
  '00000000-0000-4000-8000-000000000720'::uuid,
  'org_a', 'loc_a1', 'reg_a',
  '00000000-0000-4000-8000-000000000710'::uuid,
  '00000000-0000-4000-8000-0000000000a1'::uuid,
  'cashier_a', 'sale-core-harden-07', '710', 'fp-core-harden-07',
  1500, 'GHS', 'prepared', false, '{"status":"prepared"}'::jsonb
);

SELECT is(
  (SELECT count(*)::int FROM pos_checkout_sales WHERE transaction_id = '00000000-0000-4000-8000-000000000720'::uuid),
  1,
  'prepared POS workflow snapshot persists'
);

INSERT INTO pos_checkout_payments (
  payment_id, transaction_id, organization_id, sale_id, evidence_id,
  amount_minor, currency, cash_received_minor, cash_received_currency,
  verified_at, actor_id, record
) VALUES (
  '00000000-0000-4000-8000-000000000730'::uuid,
  '00000000-0000-4000-8000-000000000720'::uuid,
  'org_a', 'sale-core-harden-07',
  '00000000-0000-4000-8000-000000000731'::uuid,
  1500, 'GHS', 2000, 'GHS', now(), 'cashier_a', '{"status":"verified"}'::jsonb
);

SELECT is(
  (SELECT count(*)::int FROM pos_checkout_payments WHERE transaction_id = '00000000-0000-4000-8000-000000000720'::uuid),
  1,
  'one verified payment is stored for the transaction'
);

SELECT throws_ok(
  $$ INSERT INTO pos_checkout_payments (
       payment_id, transaction_id, organization_id, sale_id, evidence_id,
       amount_minor, currency, cash_received_minor, cash_received_currency,
       verified_at, actor_id, record
     ) VALUES (
       '00000000-0000-4000-8000-000000000732'::uuid,
       '00000000-0000-4000-8000-000000000720'::uuid,
       'org_a', 'sale-core-harden-07',
       '00000000-0000-4000-8000-000000000733'::uuid,
       1500, 'GHS', 2000, 'GHS', now(), 'cashier_a', '{"status":"verified"}'::jsonb
     ) $$,
  '23505',
  NULL,
  'a second payment identity for the same transaction is rejected'
);

INSERT INTO pos_checkout_receipts (
  transaction_id, organization_id, receipt_id, snapshot
) VALUES (
  '00000000-0000-4000-8000-000000000720'::uuid,
  'org_a', 'rcpt-00000000', '{"id":"rcpt-00000000"}'::jsonb
);

SELECT is(
  (SELECT count(*)::int FROM pos_checkout_receipts WHERE transaction_id = '00000000-0000-4000-8000-000000000720'::uuid),
  1,
  'one durable receipt snapshot is stored per transaction'
);

SELECT throws_ok(
  $$ INSERT INTO pos_checkout_receipts (
       transaction_id, organization_id, receipt_id, snapshot
     ) VALUES (
       '00000000-0000-4000-8000-000000000720'::uuid,
       'org_a', 'rcpt-other', '{"id":"rcpt-other"}'::jsonb
     ) $$,
  '23505',
  NULL,
  'a second receipt for the same transaction is rejected'
);

SELECT throws_ok(
  $$ SELECT pos_checkout_record_cash_sale(
       '00000000-0000-4000-8000-000000000740'::uuid,
       'org_a', 'loc_a1', 'reg_a',
       '00000000-0000-4000-8000-000000000710'::uuid,
       'manager_a',
       '00000000-0000-4000-8000-000000000741'::uuid,
       100, 'USD', now()
     ) $$,
  '23514',
  NULL,
  'cash-sale RPC rejects currency drift from the shift'
);

SELECT finish();
ROLLBACK;

-- Tender write-boundary, migration-window evidence adoption, role denial.
BEGIN;
SELECT plan(10);

INSERT INTO pos_shifts (
  id, register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
) VALUES (
  'cc100000-0000-4000-8000-000000000001',
  'reg_a', '00000000-0000-4000-8000-0000000000a1', 1000, 'GHS', 'cashier_a'
);
INSERT INTO pos_checkout_sales (
  transaction_id, organization_id, location_id, register_id, shift_id, sale_id, status, record
) VALUES (
  'cccccccc-cccc-4ccc-8ccc-cccccccccc01', 'org_a', 'loc_a1', 'reg_a',
  'cc100000-0000-4000-8000-000000000001', 'tender-mw-1', 'prepared', '{"status":"prepared"}'::jsonb
);

-- Simulate pre-guard electronic intent: no claim row, payment present.
ALTER TABLE public.pos_checkout_payments DISABLE TRIGGER pos_checkout_payment_tender_family_guard;
SET ROLE service_role;
INSERT INTO pos_checkout_payments (
  payment_id, organization_id, location_id, transaction_id, sale_id, evidence_id,
  tender, status, amount_minor, amount_currency, actor_id,
  provider, provider_reference, initialize_status
) VALUES (
  'cccccccc-cccc-4ccc-8ccc-cccccccccc02', 'org_a', 'loc_a1',
  'cccccccc-cccc-4ccc-8ccc-cccccccccc01', 'tender-mw-1', NULL,
  'card', 'awaiting_customer', 1500, 'GHS', 'cashier_a',
  'fake', 'ref-mw-1', 'initialized'
);
RESET ROLE;
ALTER TABLE public.pos_checkout_payments ENABLE TRIGGER pos_checkout_payment_tender_family_guard;

SELECT is(
  (SELECT count(*)::integer FROM pos_sale_tender_claims
    WHERE transaction_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01'),
  0,
  'migration-window fixture has card intent and empty claims'
);

SELECT throws_ok(
  $$ INSERT INTO pos_cash_movements (
       shift_id, kind, signed_amount_minor, currency, actor_id, transaction_id, reason
     ) VALUES (
       'cc100000-0000-4000-8000-000000000001', 'cash_sale', 1500, 'GHS', 'cashier_a',
       'cccccccc-cccc-4ccc-8ccc-cccccccccc01', 'migration-window legacy cash'
     ) $$,
  '23514',
  NULL,
  'migration-window: cash_sale blocked by retained card intent evidence'
);

SELECT is(
  (SELECT count(*)::integer FROM pos_cash_movements
    WHERE transaction_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01' AND kind = 'cash_sale'),
  0,
  'migration-window leaves zero cash_sale rows'
);

SELECT is(
  (SELECT tender FROM pos_checkout_payments WHERE payment_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccc02'),
  'card',
  'migration-window retains card intent'
);

SELECT lives_ok(
  $$ SELECT pos_claim_or_require_tender_family(
       'cccccccc-cccc-4ccc-8ccc-cccccccccc01', 'org_a', 'loc_a1', 'electronic', 'cashier_a'
     ) $$,
  'same-family electronic claim after card evidence is allowed'
);

SELECT throws_ok(
  $$ SELECT pos_claim_or_require_tender_family(
       'cccccccc-cccc-4ccc-8ccc-cccccccccc01', 'org_a', 'loc_a1', 'cash', 'cashier_a'
     ) $$,
  '23514',
  NULL,
  'opposite cash claim denied after electronic evidence'
);

RESET ROLE;
SET ROLE anon;
SELECT throws_ok(
  $$ SELECT pos_claim_or_require_tender_family(
       'cccccccc-cccc-4ccc-8ccc-cccccccccc01', 'org_a', 'loc_a1', 'electronic', 'cashier_a'
     ) $$,
  '42501',
  NULL,
  'anon denied claim helper execute'
);
RESET ROLE;

SET ROLE authenticated;
SELECT throws_ok(
  $$ SELECT pos_claim_or_require_tender_family(
       'cccccccc-cccc-4ccc-8ccc-cccccccccc01', 'org_a', 'loc_a1', 'electronic', 'cashier_a'
     ) $$,
  '42501',
  NULL,
  'authenticated denied claim helper execute'
);
RESET ROLE;

SET ROLE service_role;
INSERT INTO pos_checkout_sales (
  transaction_id, organization_id, location_id, register_id, shift_id, sale_id, status, record
) VALUES (
  'cccccccc-cccc-4ccc-8ccc-cccccccccc11', 'org_a', 'loc_a1', 'reg_a',
  'cc100000-0000-4000-8000-000000000001', 'tender-mw-2', 'prepared', '{"status":"prepared"}'::jsonb
);
SELECT lives_ok(
  $$ SELECT pos_claim_or_require_tender_family(
       'cccccccc-cccc-4ccc-8ccc-cccccccccc11', 'org_a', 'loc_a1', 'cash', 'cashier_a'
     ) $$,
  'cash claim acquired on fresh sale'
);
SELECT throws_ok(
  $$ INSERT INTO pos_checkout_payments (
       payment_id, organization_id, location_id, transaction_id, sale_id, evidence_id,
       tender, status, amount_minor, amount_currency, actor_id,
       provider, provider_reference, initialize_status
     ) VALUES (
       'cccccccc-cccc-4ccc-8ccc-cccccccccc12', 'org_a', 'loc_a1',
       'cccccccc-cccc-4ccc-8ccc-cccccccccc11', 'tender-mw-2', NULL,
       'card', 'awaiting_customer', 1500, 'GHS', 'cashier_a',
       'fake', 'ref-mw-2', 'initialized'
     ) $$,
  '23514',
  NULL,
  'electronic payment insert denied after cash claim'
);

RESET ROLE;
SELECT finish();
ROLLBACK;
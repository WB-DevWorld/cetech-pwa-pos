-- RT-01 return/refund operational tables, constraints, RLS, and pending-operation values.
-- Not the mirrored CORE-01 RLS suite. Synthetic fixtures only.

BEGIN;

SELECT plan(43);

SET ROLE anon;
SELECT throws_ok(
  $$ SELECT count(*) FROM pos_returns $$,
  '42501',
  NULL,
  'anonymous cannot read returns'
);
SELECT throws_ok(
  $$ SELECT count(*) FROM pos_tender_refunds $$,
  '42501',
  NULL,
  'anonymous cannot read tender refunds'
);
RESET ROLE;

SET ROLE authenticated;
SELECT throws_ok(
  $$ SELECT count(*) FROM pos_returns $$,
  '42501',
  NULL,
  'authenticated cannot read returns'
);
SELECT throws_ok(
  $$ INSERT INTO pos_returns (
       return_id, organization_id, location_id, register_id, actor_id, transaction_id, sale_id,
       economics_version, fingerprint, preview_expires_at, refund_total_minor, refund_currency, status
     ) VALUES (
       '33333333-3333-4333-8333-333333333401',
       'org_a', 'loc_a1', 'reg_a', 'cashier_a',
       '11111111-1111-4111-8111-111111111401',
       'woo-rt01', 'hv1', '0123456789abcdef0123456789abcdef',
       now() + interval '30 minutes', 1500, 'GHS', 'previewed'
     ) $$,
  '42501',
  NULL,
  'authenticated cannot insert returns'
);
RESET ROLE;

SET ROLE service_role;
SELECT lives_ok(
  $$ INSERT INTO pos_shifts (
       register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
     ) VALUES (
       'reg_a', '00000000-0000-4000-8000-0000000000a1', 5000, 'GHS', 'cashier_a'
     ) $$,
  'service_role can open a shift for RT-01 fixtures'
);
SELECT set_config(
  'pos_test.rt01_shift',
  (SELECT id::text FROM pos_shifts WHERE register_id = 'reg_a' AND status = 'open' LIMIT 1),
  true
);

SELECT lives_ok(
  $$ INSERT INTO pos_checkout_sales (
       transaction_id, organization_id, location_id, register_id, shift_id, sale_id, status, record
     ) VALUES (
       '11111111-1111-4111-8111-111111111401',
       'org_a', 'loc_a1', 'reg_a',
       current_setting('pos_test.rt01_shift')::uuid,
       'woo-rt01', 'completed',
       jsonb_build_object('prepared', jsonb_build_object(
         'transactionId', '11111111-1111-4111-8111-111111111401',
         'saleId', 'woo-rt01'
       ))
     ) $$,
  'service_role can persist a completed sale for returns'
);

SELECT lives_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, operation, idempotency_key, request_hash, status
     ) VALUES (
       'org_a', 'loc_a1', 'return.execute',
       '99999999-9999-4999-8999-999999999401',
       'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
       'pending'
     ) $$,
  'return.execute is a valid pending operation'
);
SELECT lives_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, operation, idempotency_key, request_hash, status
     ) VALUES (
       'org_a', 'loc_a1', 'payment.refund',
       '99999999-9999-4999-8999-999999999402',
       'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
       'pending'
     ) $$,
  'payment.refund is a valid pending operation'
);
SELECT lives_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, operation, idempotency_key, request_hash, status
     ) VALUES (
       'org_a', 'loc_a1', 'bridge.commercial_refund',
       '99999999-9999-4999-8999-999999999403',
       'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
       'pending'
     ) $$,
  'bridge.commercial_refund is a valid pending operation'
);
SELECT lives_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, operation, idempotency_key, request_hash, status
     ) VALUES (
       'org_a', 'loc_a1', 'bridge.stock_disposition',
       '99999999-9999-4999-8999-999999999404',
       'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
       'pending'
     ) $$,
  'bridge.stock_disposition is a valid pending operation'
);
SELECT lives_ok(
  $$ INSERT INTO pos_pending_operations (
       organization_id, location_id, operation, idempotency_key, request_hash, status
     ) VALUES (
       'org_a', 'loc_a1', 'sale.prepare',
       '99999999-9999-4999-8999-999999999405',
       'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
       'pending'
     ) $$,
  'pre-RT-01 journal operations remain valid'
);

SELECT lives_ok(
  $$ INSERT INTO pos_returns (
       return_id, organization_id, location_id, register_id, actor_id, transaction_id, sale_id,
       economics_version, fingerprint, preview_expires_at, refund_total_minor, refund_currency, status
     ) VALUES (
       '33333333-3333-4333-8333-333333333401',
       'org_a', 'loc_a1', 'reg_a', 'cashier_a',
       '11111111-1111-4111-8111-111111111401',
       'woo-rt01', 'hv1-rt01', '0123456789abcdef0123456789abcdef',
       now() + interval '30 minutes', 1500, 'GHS', 'previewed'
     ) $$,
  'service_role can insert a return preview'
);

SELECT lives_ok(
  $$ INSERT INTO pos_return_historic_lines (
       return_id, order_line_id, original_sold_quantity, previously_returned_quantity,
       remaining_returnable_quantity, historical_subtotal_minor, historical_discount_minor,
       historical_tax_minor, historical_total_minor, currency
     ) VALUES (
       '33333333-3333-4333-8333-333333333401',
       'line-1', 2, 0, 2, 1500, 0, 0, 1500, 'GHS'
     ) $$,
  'historic line economics persist'
);

SELECT throws_ok(
  $$ UPDATE pos_return_historic_lines SET historical_total_minor = 1 $$,
  '42501',
  NULL,
  'historic line economics deny UPDATE (privilege plus immutable trigger)'
);

SELECT lives_ok(
  $$ INSERT INTO pos_tender_refunds (
       refund_id, return_id, organization_id, location_id, payment_id, transaction_id,
       channel, amount_minor, currency, status
     ) VALUES (
       '44444444-4444-4444-8444-444444444401',
       '33333333-3333-4333-8333-333333333401',
       'org_a', 'loc_a1',
       '22222222-2222-4222-8222-222222222401',
       '11111111-1111-4111-8111-111111111401',
       'cash_ledger', 1500, 'GHS', 'verified'
     ) $$,
  'tender refund identity persists'
);

SELECT throws_ok(
  $$ UPDATE pos_tender_refunds
        SET status = 'pending'
      WHERE refund_id = '44444444-4444-4444-8444-444444444401' $$,
  '55000',
  NULL,
  'verified tender refunds cannot be downgraded'
);

SELECT is(
  (SELECT public.pos_claim_sale_return_quantity('org_a', 'woo-rt01', 'line-1', 2, 1)),
  true,
  'first remaining unit can be claimed'
);
SELECT is(
  (SELECT public.pos_claim_sale_return_quantity('org_a', 'woo-rt01', 'line-1', 2, 1)),
  true,
  'second remaining unit can be claimed'
);
SELECT is(
  (SELECT public.pos_claim_sale_return_quantity('org_a', 'woo-rt01', 'line-1', 2, 1)),
  false,
  'quantity cap rejects a third unit'
);

SELECT is(
  (SELECT public.pos_claim_tender_refund(
     '22222222-2222-4222-8222-222222222401', 'org_a', 'woo-rt01', 1500, 500, 'GHS'
   )),
  true,
  'partial tender refund is accepted'
);
SELECT is(
  (SELECT public.pos_claim_tender_refund(
     '22222222-2222-4222-8222-222222222401', 'org_a', 'woo-rt01', 1500, 1000, 'GHS'
   )),
  true,
  'remaining tender refund is accepted'
);
SELECT is(
  (SELECT public.pos_claim_tender_refund(
     '22222222-2222-4222-8222-222222222401', 'org_a', 'woo-rt01', 1500, 1, 'GHS'
   )),
  false,
  'tender refund cap rejects over-refund'
);

SELECT lives_ok(
  $$ INSERT INTO pos_commercial_refunds (
       commercial_refund_id, return_id, organization_id, location_id, transaction_id, sale_id,
       amount_minor, currency, economics_version, fingerprint, status
     ) VALUES (
       '55555555-5555-4555-8555-555555555401',
       '33333333-3333-4333-8333-333333333401',
       'org_a', 'loc_a1',
       '11111111-1111-4111-8111-111111111401',
       'woo-rt01', 1500, 'GHS', 'hv1-rt01',
       '0123456789abcdef0123456789abcdef', 'completed'
     ) $$,
  'commercial refund belongs to exactly one return'
);

SELECT throws_ok(
  $$ INSERT INTO pos_commercial_refunds (
       commercial_refund_id, return_id, organization_id, location_id, transaction_id, sale_id,
       amount_minor, currency, economics_version, fingerprint, status
     ) VALUES (
       '55555555-5555-4555-8555-555555555402',
       '33333333-3333-4333-8333-333333333401',
       'org_a', 'loc_a1',
       '11111111-1111-4111-8111-111111111401',
       'woo-rt01', 1500, 'GHS', 'hv1-rt01',
       '0123456789abcdef0123456789abcdef', 'pending'
     ) $$,
  '23505',
  NULL,
  'a return cannot own two commercial refund identities'
);

SELECT lives_ok(
  $$ INSERT INTO pos_return_audit (
       return_id, organization_id, event_type, payload
     ) VALUES (
       '33333333-3333-4333-8333-333333333401',
       'org_a', 'return.previewed', '{}'::jsonb
     ) $$,
  'return audit accepts append-only history'
);
SELECT throws_ok(
  $$ UPDATE pos_return_audit SET event_type = 'tamper' $$,
  '42501',
  NULL,
  'return audit denies UPDATE (privilege plus append-only trigger)'
);

SELECT lives_ok(
  $$ INSERT INTO pos_cash_movements (
       shift_id, kind, signed_amount_minor, currency, actor_id, transaction_id, refund_id
     ) VALUES (
       current_setting('pos_test.rt01_shift')::uuid,
       'cash_refund', -1500, 'GHS', 'cashier_a',
       '11111111-1111-4111-8111-111111111401',
       '44444444-4444-4444-8444-444444444401'
     ) $$,
  'cash_refund ledger row binds refundId'
);
SELECT throws_ok(
  $$ INSERT INTO pos_cash_movements (
       shift_id, kind, signed_amount_minor, currency, actor_id, transaction_id, refund_id
     ) VALUES (
       current_setting('pos_test.rt01_shift')::uuid,
       'cash_refund', -1500, 'GHS', 'cashier_a',
       '11111111-1111-4111-8111-111111111401',
       '44444444-4444-4444-8444-444444444401'
     ) $$,
  '23505',
  NULL,
  'duplicate cash_refund for the same refundId is denied'
);

SELECT throws_ok(
  $$ INSERT INTO pos_return_requested_lines (
       return_id, order_line_id, quantity, reason, condition,
       intended_disposition, disposition_policy,
       remaining_returnable_quantity,
       allocated_historic_amount_minor, allocated_historic_currency
     ) VALUES (
       '33333333-3333-4333-8333-333333333401',
       'line-1', 1, 'damaged', 'damaged',
       'restock_sellable', 'automatic_sellable_restock',
       2, 0, 'GHS'
     ) $$,
  '23514',
  NULL,
  'damaged goods cannot request sellable restock'
);

SELECT lives_ok(
  $$ INSERT INTO pos_checkout_sales (
       transaction_id, organization_id, location_id, register_id, shift_id, sale_id, status, record
     ) VALUES (
       '11111111-1111-4111-8111-111111111402',
       'org_a', 'loc_a1', 'reg_a',
       current_setting('pos_test.rt01_shift')::uuid,
       'woo-rt01-b', 'completed',
       jsonb_build_object('prepared', jsonb_build_object(
         'transactionId', '11111111-1111-4111-8111-111111111402',
         'saleId', 'woo-rt01-b'
       ))
     ) $$,
  'second completed sale exists for execution-claim tests'
);

SELECT lives_ok(
  $$ INSERT INTO pos_returns (
       return_id, organization_id, location_id, register_id, actor_id, transaction_id, sale_id,
       economics_version, fingerprint, preview_expires_at, refund_total_minor, refund_currency, status
     ) VALUES (
       '33333333-3333-4333-8333-333333333402',
       'org_a', 'loc_a1', 'reg_a', 'cashier_a',
       '11111111-1111-4111-8111-111111111402',
       'woo-rt01-b', 'hv1-rt01-b', '0123456789abcdef0123456789abcdef',
       now() + interval '30 minutes', 1500, 'GHS', 'previewed'
     ) $$,
  'second return preview persists'
);
SELECT lives_ok(
  $$ INSERT INTO pos_return_historic_lines (
       return_id, order_line_id, original_sold_quantity, previously_returned_quantity,
       remaining_returnable_quantity, historical_subtotal_minor, historical_discount_minor,
       historical_tax_minor, historical_total_minor, currency
     ) VALUES (
       '33333333-3333-4333-8333-333333333402',
       'line-1', 1, 0, 1, 1500, 0, 0, 1500, 'GHS'
     ) $$,
  'second return historic line persists'
);
SELECT lives_ok(
  $$ INSERT INTO pos_return_historic_tenders (
       return_id, payment_id, tender, original_amount_minor, already_refunded_minor,
       remaining_refundable_minor, currency
     ) VALUES (
       '33333333-3333-4333-8333-333333333402',
       '22222222-2222-4222-8222-222222222402',
       'cash', 1500, 0, 1500, 'GHS'
     ) $$,
  'second return historic tender persists'
);
SELECT lives_ok(
  $$ INSERT INTO pos_return_requested_lines (
       return_id, order_line_id, quantity, reason, condition,
       intended_disposition, disposition_policy,
       remaining_returnable_quantity,
       allocated_historic_amount_minor, allocated_historic_currency
     ) VALUES (
       '33333333-3333-4333-8333-333333333402',
       'line-1', 1, 'customer changed mind', 'resellable',
       'restock_sellable', 'automatic_sellable_restock',
       1, 1500, 'GHS'
     ) $$,
  'resellable requested line persists the exact preview historic allocation'
);

SELECT is(
  (SELECT public.pos_claim_return_execution('33333333-3333-4333-8333-333333333402')),
  'claimed',
  'first last-unit execution claim is accepted'
);
SELECT is(
  (SELECT public.pos_claim_return_execution('33333333-3333-4333-8333-333333333402')),
  'already_claimed',
  'repeat execution claim replays without a second quantity effect'
);

SELECT lives_ok(
  $$ INSERT INTO pos_returns (
       return_id, organization_id, location_id, register_id, actor_id, transaction_id, sale_id,
       economics_version, fingerprint, preview_expires_at, refund_total_minor, refund_currency, status
     ) VALUES (
       '33333333-3333-4333-8333-333333333403',
       'org_a', 'loc_a1', 'reg_a', 'cashier_a',
       '11111111-1111-4111-8111-111111111402',
       'woo-rt01-b', 'hv1-rt01-c', '0123456789abcdef0123456789abcdef',
       now() + interval '30 minutes', 1500, 'GHS', 'previewed'
     ) $$,
  'concurrent last-unit preview can exist before execute'
);
SELECT lives_ok(
  $$ INSERT INTO pos_return_historic_lines (
       return_id, order_line_id, original_sold_quantity, previously_returned_quantity,
       remaining_returnable_quantity, historical_subtotal_minor, historical_discount_minor,
       historical_tax_minor, historical_total_minor, currency
     ) VALUES (
       '33333333-3333-4333-8333-333333333403',
       'line-1', 1, 0, 1, 1500, 0, 0, 1500, 'GHS'
     ) $$,
  'losing preview still has historic economics'
);
SELECT lives_ok(
  $$ INSERT INTO pos_return_historic_tenders (
       return_id, payment_id, tender, original_amount_minor, already_refunded_minor,
       remaining_refundable_minor, currency
     ) VALUES (
       '33333333-3333-4333-8333-333333333403',
       '22222222-2222-4222-8222-222222222402',
       'cash', 1500, 0, 1500, 'GHS'
     ) $$,
  'losing preview still has historic tender'
);
SELECT lives_ok(
  $$ INSERT INTO pos_return_requested_lines (
       return_id, order_line_id, quantity, reason, condition,
       intended_disposition, disposition_policy,
       remaining_returnable_quantity,
       allocated_historic_amount_minor, allocated_historic_currency
     ) VALUES (
       '33333333-3333-4333-8333-333333333403',
       'line-1', 1, 'customer changed mind', 'resellable',
       'restock_sellable', 'automatic_sellable_restock',
       1, 1500, 'GHS'
     ) $$,
  'losing preview requested line persists'
);
SELECT throws_ok(
  $$ SELECT public.pos_claim_return_execution('33333333-3333-4333-8333-333333333403') $$,
  'P0001',
  NULL,
  'last remaining unit cannot be claimed twice'
);

SELECT lives_ok(
  $$
  DO $zero$
  BEGIN
    INSERT INTO pos_checkout_sales (
      transaction_id, organization_id, location_id, register_id, shift_id, sale_id, status, record
    ) VALUES (
      '11111111-1111-4111-8111-111111111404',
      'org_a', 'loc_a1', 'reg_a',
      current_setting('pos_test.rt01_shift')::uuid,
      'woo-rt01-zero', 'completed',
      jsonb_build_object('prepared', jsonb_build_object(
        'transactionId', '11111111-1111-4111-8111-111111111404',
        'saleId', 'woo-rt01-zero'
      ))
    );
    INSERT INTO pos_returns (
      return_id, organization_id, location_id, register_id, actor_id, transaction_id, sale_id,
      economics_version, fingerprint, preview_expires_at, refund_total_minor, refund_currency, status
    ) VALUES (
      '33333333-3333-4333-8333-333333333404',
      'org_a', 'loc_a1', 'reg_a', 'cashier_a',
      '11111111-1111-4111-8111-111111111404',
      'woo-rt01-zero', 'hv1-rt01-zero', '0123456789abcdef0123456789abcdef',
      now() + interval '30 minutes', 0, 'GHS', 'previewed'
    );
    INSERT INTO pos_return_historic_lines (
      return_id, order_line_id, original_sold_quantity, previously_returned_quantity,
      remaining_returnable_quantity, historical_subtotal_minor, historical_discount_minor,
      historical_tax_minor, historical_total_minor, currency
    ) VALUES (
      '33333333-3333-4333-8333-333333333404',
      'line-1', 1, 0, 1, 0, 0, 0, 0, 'GHS'
    );
    INSERT INTO pos_return_requested_lines (
      return_id, order_line_id, quantity, reason, condition,
      intended_disposition, disposition_policy,
      remaining_returnable_quantity,
      allocated_historic_amount_minor, allocated_historic_currency
    ) VALUES (
      '33333333-3333-4333-8333-333333333404',
      'line-1', 1, 'free item return', 'resellable',
      'restock_sellable', 'automatic_sellable_restock',
      1, 0, 'GHS'
    );
  END
  $zero$;
  $$,
  'zero historic allocation is accepted on requested return lines'
);
SELECT throws_ok(
  $$ INSERT INTO pos_return_requested_lines (
       return_id, order_line_id, quantity, reason, condition,
       intended_disposition, disposition_policy,
       remaining_returnable_quantity,
       allocated_historic_amount_minor, allocated_historic_currency
     ) VALUES (
       '33333333-3333-4333-8333-333333333404',
       'line-neg', 1, 'negative allocation', 'resellable',
       'restock_sellable', 'automatic_sellable_restock',
       1, -1, 'GHS'
     ) $$,
  '23514',
  NULL,
  'negative historic allocation is rejected'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;

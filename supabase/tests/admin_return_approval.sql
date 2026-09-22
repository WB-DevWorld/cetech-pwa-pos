-- ADMIN-105 durable return approval binding, replay safety, scope validation, and audit.
BEGIN;

SELECT plan(14);

SET ROLE authenticated;
SELECT throws_ok(
  $$ SELECT pos_admin_bind_return_approval(
       'org_a',
       '33333333-3333-4333-8333-333333333951',
       '0123456789abcdef0123456789abcdef',
       'manager_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       '99999999-9999-4999-8999-999999999951',
       now() + interval '15 minutes'
     ) $$,
  '42501',
  NULL,
  'authenticated cannot invoke admin return approval'
);
RESET ROLE;

SET ROLE service_role;

SELECT lives_ok(
  $$ INSERT INTO pos_shifts (
       register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
     ) VALUES (
       'reg_a', '00000000-0000-4000-8000-0000000000a1', 5000, 'GHS', 'cashier_a'
     ) $$,
  'service role can create approval test shift'
);
SELECT set_config(
  'pos_test.admin_approval_shift',
  (SELECT id::text FROM pos_shifts WHERE register_id = 'reg_a' AND status = 'open' LIMIT 1),
  true
);

SELECT lives_ok(
  $$ INSERT INTO pos_checkout_sales (
       transaction_id, organization_id, location_id, register_id, shift_id, sale_id, status, record
     ) VALUES (
       '11111111-1111-4111-8111-111111111951',
       'org_a', 'loc_a1', 'reg_a',
       current_setting('pos_test.admin_approval_shift')::uuid,
       'woo-admin-approval-951', 'completed',
       jsonb_build_object('prepared', jsonb_build_object(
         'transactionId', '11111111-1111-4111-8111-111111111951',
         'saleId', 'woo-admin-approval-951'
       ))
     ) $$,
  'service role can create approval test sale'
);

SELECT lives_ok(
  $$ INSERT INTO pos_returns (
       return_id, organization_id, location_id, register_id, shift_id, actor_id,
       transaction_id, sale_id, economics_version, fingerprint, preview_expires_at,
       approval_required, refund_total_minor, refund_currency, status
     ) VALUES (
       '33333333-3333-4333-8333-333333333951',
       'org_a', 'loc_a1', 'reg_a',
       current_setting('pos_test.admin_approval_shift')::uuid,
       'cashier_a',
       '11111111-1111-4111-8111-111111111951',
       'woo-admin-approval-951', 'hv1',
       '0123456789abcdef0123456789abcdef',
       now() + interval '30 minutes',
       true, 1500, 'GHS', 'approval_required'
     ) $$,
  'service role can create approval-required return'
);

SELECT lives_ok(
  $$ SELECT pos_admin_bind_return_approval(
       'org_a',
       '33333333-3333-4333-8333-333333333951',
       '0123456789abcdef0123456789abcdef',
       'manager_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       '99999999-9999-4999-8999-999999999951',
       now() + interval '15 minutes'
     ) $$,
  'manager approval RPC binds existing return'
);

SELECT is(
  (SELECT count(*)::integer FROM pos_return_approvals
   WHERE return_id = '33333333-3333-4333-8333-333333333951'),
  1,
  'one durable approval binding exists'
);

SELECT is(
  (SELECT count(*)::integer FROM pos_admin_audit_events
   WHERE action = 'return.approval.bound'
     AND target_id = '33333333-3333-4333-8333-333333333951'),
  1,
  'approval mutation appends one admin audit event'
);

SELECT is(
  (pos_admin_bind_return_approval(
    'org_a',
    '33333333-3333-4333-8333-333333333951',
    '0123456789abcdef0123456789abcdef',
    'manager_a',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '99999999-9999-4999-8999-999999999952',
    now() + interval '10 minutes'
  )->>'approvalId'),
  '99999999-9999-4999-8999-999999999951',
  'repeat approval returns existing live binding'
);

SELECT is(
  (SELECT count(*)::integer FROM pos_return_approvals
   WHERE return_id = '33333333-3333-4333-8333-333333333951'),
  1,
  'repeat approval does not create a second binding'
);

SELECT is(
  (SELECT count(*)::integer FROM pos_admin_audit_events
   WHERE action = 'return.approval.bound'
     AND target_id = '33333333-3333-4333-8333-333333333951'),
  1,
  'repeat approval does not duplicate audit'
);

SELECT throws_ok(
  $$ SELECT pos_admin_bind_return_approval(
       'org_b',
       '33333333-3333-4333-8333-333333333951',
       '0123456789abcdef0123456789abcdef',
       'manager_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       '99999999-9999-4999-8999-999999999953',
       now() + interval '15 minutes'
     ) $$,
  '23503',
  NULL,
  'wrong organization fails closed'
);

SELECT throws_ok(
  $$ SELECT pos_admin_bind_return_approval(
       'org_a',
       '33333333-3333-4333-8333-333333333951',
       'ffffffffffffffffffffffffffffffff',
       'manager_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       '99999999-9999-4999-8999-999999999954',
       now() + interval '15 minutes'
     ) $$,
  '23514',
  NULL,
  'wrong return fingerprint fails closed'
);

SELECT lives_ok(
  $$ INSERT INTO pos_checkout_sales (
       transaction_id, organization_id, location_id, register_id, shift_id, sale_id, status, record
     ) VALUES (
       '11111111-1111-4111-8111-111111111952',
       'org_a', 'loc_a1', 'reg_a',
       current_setting('pos_test.admin_approval_shift')::uuid,
       'woo-admin-approval-952', 'completed',
       jsonb_build_object('prepared', jsonb_build_object(
         'transactionId', '11111111-1111-4111-8111-111111111952',
         'saleId', 'woo-admin-approval-952'
       ))
     ) $$,
  'service role can create expired-preview sale'
);

SELECT lives_ok(
  $$ INSERT INTO pos_returns (
       return_id, organization_id, location_id, register_id, shift_id, actor_id,
       transaction_id, sale_id, economics_version, fingerprint, preview_expires_at,
       approval_required, refund_total_minor, refund_currency, status
     ) VALUES (
       '33333333-3333-4333-8333-333333333952',
       'org_a', 'loc_a1', 'reg_a',
       current_setting('pos_test.admin_approval_shift')::uuid,
       'cashier_a',
       '11111111-1111-4111-8111-111111111952',
       'woo-admin-approval-952', 'hv1',
       'fedcba9876543210fedcba9876543210',
       now() - interval '1 minute',
       true, 500, 'GHS', 'approval_required'
     ) $$,
  'service role can create expired-preview return fixture'
);

SELECT throws_ok(
  $$ SELECT pos_admin_bind_return_approval(
       'org_a',
       '33333333-3333-4333-8333-333333333952',
       'fedcba9876543210fedcba9876543210',
       'manager_a',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       '99999999-9999-4999-8999-999999999955',
       now() + interval '15 minutes'
     ) $$,
  '23514',
  NULL,
  'expired preview cannot be approved'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;

-- CORE-07 atomic blind close, variance, idempotency and immutable Z report.

BEGIN;

SELECT plan(12);

SET ROLE anon;
SELECT throws_ok(
  $$ SELECT count(*) FROM pos_shift_reports $$,
  '42501',
  NULL,
  'anonymous cannot read shift reports'
);
RESET ROLE;

SET ROLE authenticated;
SELECT throws_ok(
  $$ SELECT count(*) FROM pos_shift_reports $$,
  '42501',
  NULL,
  'authenticated browser cannot read server-owned shift reports directly'
);
RESET ROLE;

SET ROLE service_role;
INSERT INTO pos_shifts (
  register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
) VALUES (
  'reg_a', '00000000-0000-4000-8000-0000000000a1', 5000, 'GHS', 'cashier_a'
);

SELECT set_config(
  'pos_test.close_shift',
  (SELECT id::text FROM pos_shifts WHERE register_id = 'reg_a' AND status = 'open' LIMIT 1),
  true
);

INSERT INTO pos_cash_movements (
  shift_id, kind, signed_amount_minor, currency, actor_id, reason
) VALUES (
  current_setting('pos_test.close_shift')::uuid,
  'pay_in', 2500, 'GHS', 'cashier_a', 'CORE-07 close test float top-up'
);

SELECT is(
  (SELECT expected_cash_minor FROM pos_shifts WHERE id = current_setting('pos_test.close_shift')::uuid),
  7500::bigint,
  'server-owned expected cash includes the cash movement before close'
);

SELECT lives_ok(
  $$ SELECT pos_close_shift_blind(
       'org_a',
       current_setting('pos_test.close_shift')::uuid,
       7300,
       'GHS',
       '77777777-7777-4777-8777-777777777701',
       repeat('a', 64)
     ) $$,
  'blind close succeeds without a client-supplied expected-cash value'
);

SELECT is(
  (SELECT status FROM pos_shifts WHERE id = current_setting('pos_test.close_shift')::uuid),
  'closed',
  'shift is closed atomically'
);

SELECT is(
  (SELECT counted_cash_minor FROM pos_shifts WHERE id = current_setting('pos_test.close_shift')::uuid),
  7300::bigint,
  'counted cash is retained'
);

SELECT is(
  (SELECT variance_minor FROM pos_shifts WHERE id = current_setting('pos_test.close_shift')::uuid),
  (-200)::bigint,
  'variance is derived from server-owned expected cash'
);

SELECT is(
  (SELECT count(*)::int FROM pos_shift_reports
    WHERE shift_id = current_setting('pos_test.close_shift')::uuid AND kind = 'Z'),
  1,
  'exactly one immutable Z report is created'
);

SELECT is(
  (SELECT expected_cash_minor FROM pos_shift_reports
    WHERE shift_id = current_setting('pos_test.close_shift')::uuid AND kind = 'Z'),
  7500::bigint,
  'Z report snapshots the authoritative expected cash'
);

SELECT lives_ok(
  $$ SELECT pos_close_shift_blind(
       'org_a',
       current_setting('pos_test.close_shift')::uuid,
       7300,
       'GHS',
       '77777777-7777-4777-8777-777777777701',
       repeat('a', 64)
     ) $$,
  'same-key same-body close replay returns the existing closed outcome'
);

SELECT is(
  (SELECT count(*)::int FROM pos_shift_reports
    WHERE shift_id = current_setting('pos_test.close_shift')::uuid AND kind = 'Z'),
  1,
  'close replay does not create a second Z report'
);

SELECT throws_ok(
  $$ SELECT pos_close_shift_blind(
       'org_a',
       current_setting('pos_test.close_shift')::uuid,
       7200,
       'GHS',
       '77777777-7777-4777-8777-777777777701',
       repeat('b', 64)
     ) $$,
  '23505',
  'idempotency conflict',
  'same close key with different economic input conflicts'
);

SELECT throws_ok(
  $$ UPDATE pos_shift_reports SET expected_cash_minor = 1
     WHERE shift_id = current_setting('pos_test.close_shift')::uuid AND kind = 'Z' $$,
  '55000',
  'shift reports are immutable',
  'Z report cannot be rewritten after close'
);

SELECT * FROM finish();
ROLLBACK;

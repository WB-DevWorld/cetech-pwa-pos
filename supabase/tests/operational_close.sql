-- CORE-07 atomic close with R8 fail-closed variance and immutable Z.

BEGIN;

SELECT plan(22);

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
  (SELECT expected_cash_minor::bigint FROM pos_shifts WHERE id = current_setting('pos_test.close_shift')::uuid),
  7500::bigint,
  'server-owned expected cash includes the cash movement before close'
);

SELECT lives_ok(
  $$ SELECT pos_close_shift_blind(
       'org_a',
       current_setting('pos_test.close_shift')::uuid,
       7500,
       'GHS',
       '77777777-7777-4777-8777-777777777701',
       '88888888-8888-4888-8888-888888888801',
       repeat('a', 64)
     ) $$,
  'zero-variance blind close succeeds without a client-supplied expected-cash value'
);

SELECT is(
  (SELECT status FROM pos_shifts WHERE id = current_setting('pos_test.close_shift')::uuid),
  'closed',
  'zero variance closes the shift atomically'
);

SELECT isnt(
  (SELECT closed_at FROM pos_shifts WHERE id = current_setting('pos_test.close_shift')::uuid),
  NULL,
  'zero-variance close sets closedAt'
);

SELECT is(
  (SELECT count(*)::int FROM pos_shift_reports
    WHERE shift_id = current_setting('pos_test.close_shift')::uuid AND kind = 'Z'),
  1,
  'exactly one immutable Z report is created'
);

SELECT is(
  (SELECT expected_cash_minor::bigint FROM pos_shift_reports
    WHERE shift_id = current_setting('pos_test.close_shift')::uuid AND kind = 'Z'),
  7500::bigint,
  'Z report snapshots the authoritative expected cash'
);

SELECT is(
  (SELECT correlation_id FROM pos_outbox_events
    WHERE aggregate_type = 'shift'
      AND aggregate_id = current_setting('pos_test.close_shift')
      AND event_type = 'shift.closed'
    LIMIT 1),
  '88888888-8888-4888-8888-888888888801'::uuid,
  'close outbox preserves the command correlation id'
);

SELECT lives_ok(
  $$ SELECT pos_close_shift_blind(
       'org_a',
       current_setting('pos_test.close_shift')::uuid,
       7500,
       'GHS',
       '77777777-7777-4777-8777-777777777701',
       '99999999-9999-4999-8999-999999999901',
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
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
       repeat('b', 64)
     ) $$,
  '23505',
  'idempotency conflict',
  'same close key with different economic input conflicts'
);

INSERT INTO pos_shifts (
  register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
) VALUES (
  'reg_a', '00000000-0000-4000-8000-0000000000a1', 10000, 'GHS', 'cashier_a'
);

SELECT set_config(
  'pos_test.attention_shift',
  (SELECT id::text FROM pos_shifts WHERE opening_float_minor = 10000 AND status = 'open' LIMIT 1),
  true
);

SELECT lives_ok(
  $$ SELECT pos_close_shift_blind(
       'org_a',
       current_setting('pos_test.attention_shift')::uuid,
       9900,
       'GHS',
       '77777777-7777-4777-8777-777777777702',
       '88888888-8888-4888-8888-888888888802',
       repeat('c', 64)
     ) $$,
  'non-zero variance records counted cash without closing'
);

SELECT is(
  (SELECT status FROM pos_shifts WHERE id = current_setting('pos_test.attention_shift')::uuid),
  'requires_attention',
  'non-zero variance stays requires_attention'
);

SELECT is(
  (SELECT closed_at FROM pos_shifts WHERE id = current_setting('pos_test.attention_shift')::uuid),
  NULL,
  'non-zero variance does not set closedAt'
);

SELECT is(
  (SELECT count(*)::int FROM pos_shift_reports
    WHERE shift_id = current_setting('pos_test.attention_shift')::uuid AND kind = 'Z'),
  0,
  'non-zero variance does not mint a Z report'
);

SELECT lives_ok(
  $$ SELECT pos_close_shift_blind(
       'org_a',
       current_setting('pos_test.attention_shift')::uuid,
       9900,
       'GHS',
       '77777777-7777-4777-8777-777777777702',
       '88888888-8888-4888-8888-888888888803',
       repeat('c', 64)
     ) $$,
  'replayed non-zero same key returns the durable attention outcome'
);

SELECT is(
  (SELECT count(*)::int FROM pos_shift_reports
    WHERE shift_id = current_setting('pos_test.attention_shift')::uuid AND kind = 'Z'),
  0,
  'attention replay still has no Z'
);

SELECT lives_ok(
  $$ SELECT pos_close_shift_blind(
       'org_a',
       current_setting('pos_test.attention_shift')::uuid,
       10000,
       'GHS',
       '77777777-7777-4777-8777-777777777703',
       '88888888-8888-4888-8888-888888888804',
       repeat('d', 64)
     ) $$,
  'a later corrected recount with a new idempotency key may close'
);

SELECT is(
  (SELECT status FROM pos_shifts WHERE id = current_setting('pos_test.attention_shift')::uuid),
  'closed',
  'corrected zero-variance recount closes the previously attentive shift'
);

SELECT is(
  (SELECT count(*)::int FROM pos_shift_reports
    WHERE shift_id = current_setting('pos_test.attention_shift')::uuid AND kind = 'Z'),
  1,
  'corrected recount mints exactly one Z'
);

RESET ROLE;
SELECT throws_ok(
  $$ UPDATE pos_shift_reports SET expected_cash_minor = 1
     WHERE shift_id = current_setting('pos_test.close_shift')::uuid AND kind = 'Z' $$,
  '55000',
  'shift reports are immutable',
  'owner-level write attempts still hit the immutability trigger'
);

SELECT * FROM finish();

ROLLBACK;

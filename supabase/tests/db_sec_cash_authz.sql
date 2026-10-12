-- DB-SEC-02/03 cash authorization assertions.
BEGIN;
SELECT plan(5);

SET ROLE service_role;
INSERT INTO pos_shifts (
  id, register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
) VALUES (
  'dd100000-0000-4000-8000-000000000001',
  'reg_a', '00000000-0000-4000-8000-0000000000a1', 5000, 'GHS', 'cashier_a'
);
INSERT INTO pos_cash_movements (
  id, shift_id, kind, signed_amount_minor, currency, actor_id, reason
) VALUES (
  'dd100000-0000-4000-8000-000000000002',
  'dd100000-0000-4000-8000-000000000001', 'pay_in', 2500, 'GHS', 'cashier_a', 'original'
);
INSERT INTO pos_staff_access_controls (organization_id, actor_id, status, reason, updated_by_actor_id)
VALUES ('org_a', 'cashier_a', 'active', 'pgTAP ensure active', 'manager_a')
ON CONFLICT (organization_id, actor_id) DO UPDATE
SET status = 'active', reason = EXCLUDED.reason, updated_by_actor_id = EXCLUDED.updated_by_actor_id, updated_at = now();
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'role', 'authenticated',
    'sub', '00000000-0000-4000-8000-000000000001',
    'app_metadata', jsonb_build_object(
      'organization_id', 'org_a',
      'actor_id', 'cashier_a',
      'location_ids', jsonb_build_array('loc_a1'),
      'register_id', 'reg_a'
    )
  )::text,
  true
);

SET ROLE authenticated;
SELECT throws_ok(
  $$ INSERT INTO pos_cash_movements (
       id, shift_id, kind, signed_amount_minor, currency, actor_id, reason,
       corrects_movement_id, approval_id
     ) VALUES (
       'dd100000-0000-4000-8000-000000000005',
       'dd100000-0000-4000-8000-000000000001', 'correction', -2500, 'GHS', 'cashier_a',
       'direct reversal',
       'dd100000-0000-4000-8000-000000000002', 'dd100000-0000-4000-8000-000000000004'
     ) $$,
  '42501',
  NULL,
  'DB-SEC-02: authenticated correction denied'
);
RESET ROLE;

SET ROLE service_role;
INSERT INTO pos_staff_access_controls (organization_id, actor_id, status, reason, updated_by_actor_id)
VALUES ('org_a', 'cashier_a', 'disabled', 'db-sec-03', 'manager_a')
ON CONFLICT (organization_id, actor_id) DO UPDATE SET status = 'disabled';
RESET ROLE;

SET ROLE authenticated;
SELECT throws_ok(
  $$ INSERT INTO pos_cash_movements (
       id, shift_id, kind, signed_amount_minor, currency, actor_id, reason
     ) VALUES (
       'dd100000-0000-4000-8000-000000000006',
       'dd100000-0000-4000-8000-000000000001', 'pay_in', 100, 'GHS', 'cashier_a', 'post-disable'
     ) $$,
  '42501',
  'actor is disabled',
  'DB-SEC-03: disabled pay_in denied'
);
RESET ROLE;

SET ROLE service_role;
SELECT lives_ok(
  $$ SELECT pos_admin_reverse_cash_movement(
       'org_a',
       'dd100000-0000-4000-8000-000000000002',
       'authorized admin reverse',
       'manager_a',
       'dd100000-0000-4000-8000-000000000007',
       'dd100000-0000-4000-8000-000000000008'
     ) $$,
  'service admin reverse still works'
);
UPDATE pos_staff_access_controls SET status = 'active', reason = 'reactivate', updated_by_actor_id = 'manager_a', updated_at = now()
WHERE organization_id = 'org_a' AND actor_id = 'cashier_a';
RESET ROLE;

SET ROLE authenticated;
SELECT lives_ok(
  $$ INSERT INTO pos_cash_movements (
       id, shift_id, kind, signed_amount_minor, currency, actor_id, reason
     ) VALUES (
       'dd100000-0000-4000-8000-000000000009',
       'dd100000-0000-4000-8000-000000000001', 'pay_in', 100, 'GHS', 'cashier_a', 'active control'
     ) $$,
  'active pay_in still allowed'
);
RESET ROLE;

SELECT is(
  (SELECT count(*)::integer FROM pos_cash_movements WHERE id = 'dd100000-0000-4000-8000-000000000009'),
  1,
  'active pay_in row retained'
);

SELECT finish();
ROLLBACK;
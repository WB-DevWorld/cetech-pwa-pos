-- Paired active/disabled shift-open assertions (same assigned reg_a).
BEGIN;
SELECT plan(7);

-- Ensure cashier_a starts active for this fixture.
SET ROLE service_role;
INSERT INTO pos_staff_access_controls (organization_id, actor_id, status, reason, updated_by_actor_id)
VALUES ('org_a', 'cashier_a', 'active', 'pgTAP ensure active', 'manager_a')
ON CONFLICT (organization_id, actor_id) DO UPDATE
SET status = 'active', reason = EXCLUDED.reason, updated_by_actor_id = EXCLUDED.updated_by_actor_id, updated_at = now();

-- Close any open shifts on reg_a so insert can succeed.
UPDATE pos_shifts SET status = 'closed', closed_at = now(), counted_cash_minor = expected_cash_minor, counted_cash_currency = expected_cash_currency, variance_minor = 0, variance_currency = expected_cash_currency
WHERE register_id = 'reg_a' AND status IN ('open', 'closing');
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
SELECT lives_ok(
  $$ INSERT INTO pos_shifts (
       id, register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
     ) VALUES (
       'bb100000-0000-4000-8000-000000000001',
       'reg_a', '00000000-0000-4000-8000-0000000000a1', 5000, 'GHS', 'cashier_a'
     ) $$,
  'active assigned cashier can open reg_a'
);
RESET ROLE;

SELECT is(
  (SELECT count(*)::integer FROM pos_cash_movements
    WHERE shift_id = 'bb100000-0000-4000-8000-000000000001' AND kind = 'opening_float'),
  1,
  'active open creates one opening-float movement'
);

-- Close the active fixture shift before disabled case (same register).
SET ROLE service_role;
UPDATE pos_shifts SET status = 'closed', closed_at = now(), counted_cash_minor = expected_cash_minor, counted_cash_currency = expected_cash_currency, variance_minor = 0, variance_currency = expected_cash_currency
WHERE id = 'bb100000-0000-4000-8000-000000000001';
INSERT INTO pos_staff_access_controls (organization_id, actor_id, status, reason, updated_by_actor_id)
VALUES ('org_a', 'cashier_a', 'disabled', 'pgTAP disable', 'manager_a')
ON CONFLICT (organization_id, actor_id) DO UPDATE
SET status = 'disabled', reason = EXCLUDED.reason, updated_by_actor_id = EXCLUDED.updated_by_actor_id, updated_at = now();
RESET ROLE;

SET ROLE authenticated;
SELECT throws_ok(
  $$ INSERT INTO pos_shifts (
       id, register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
     ) VALUES (
       'bb100000-0000-4000-8000-000000000002',
       'reg_a', '00000000-0000-4000-8000-0000000000a1', 5000, 'GHS', 'cashier_a'
     ) $$,
  '42501',
  'actor is disabled',
  'disabled assigned cashier cannot open the same reg_a'
);
RESET ROLE;

SELECT is(
  (SELECT count(*)::integer FROM pos_shifts WHERE id = 'bb100000-0000-4000-8000-000000000002'),
  0,
  'disabled open inserts no shift row'
);
SELECT is(
  (SELECT count(*)::integer FROM pos_cash_movements WHERE shift_id = 'bb100000-0000-4000-8000-000000000002'),
  0,
  'disabled open inserts no opening-float'
);

-- Wrong-register denial remains separate (cashier_a not assigned to reg_a2).
SET ROLE service_role;
UPDATE pos_staff_access_controls
SET status = 'active', reason = 'reactivate for wrong-register control', updated_by_actor_id = 'manager_a', updated_at = now()
WHERE organization_id = 'org_a' AND actor_id = 'cashier_a';
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
      'register_id', 'reg_a2'
    )
  )::text,
  true
);
SET ROLE authenticated;
SELECT throws_ok(
  $$ INSERT INTO pos_shifts (
       register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
     ) VALUES (
       'reg_a2', '00000000-0000-4000-8000-0000000000a1', 1000, 'GHS', 'cashier_a'
     ) $$,
  '42501',
  NULL,
  'active cashier still denied on unassigned reg_a2'
);
RESET ROLE;

-- Negative control: without the disabled predicate, disabled open would succeed.
-- Function replacement must run as table/function owner (postgres), not service_role.
CREATE OR REPLACE FUNCTION public.pos_shift_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  reg pos_registers%ROWTYPE;
  dev pos_devices%ROWTYPE;
  trusted_infrastructure boolean;
BEGIN
  PERFORM public.pos_lock_shift_topology(NEW.register_id, NEW.device_id);
  SELECT * INTO STRICT reg FROM pos_registers WHERE id = NEW.register_id;
  IF reg.status <> 'active' THEN
    RAISE EXCEPTION 'register is not active' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO STRICT dev FROM pos_devices WHERE id = NEW.device_id;
  IF dev.status <> 'active'
     OR dev.organization_id <> reg.organization_id
     OR dev.location_id <> reg.location_id THEN
    RAISE EXCEPTION 'device is not at the register location' USING ERRCODE = '23514';
  END IF;
  NEW.organization_id := reg.organization_id;
  NEW.location_id := reg.location_id;
  trusted_infrastructure := current_user IN ('postgres', 'supabase_admin', 'service_role');
  IF pos_current_actor_id() IS NOT NULL THEN
    NEW.cashier_id := pos_current_actor_id();
  ELSIF NOT trusted_infrastructure OR NEW.cashier_id IS NULL THEN
    RAISE EXCEPTION 'actor is not authorized' USING ERRCODE = '42501';
  END IF;
  IF current_user = 'authenticated' THEN
    IF pos_current_organization_id() IS DISTINCT FROM NEW.organization_id
       OR NOT (NEW.location_id = ANY (pos_current_location_ids()))
       OR NOT pos_has_location_assignment(NEW.organization_id, NEW.location_id, NEW.cashier_id)
       OR NOT pos_has_register_assignment(NEW.register_id, NEW.cashier_id)
       OR (
         pos_current_register_id() IS NOT NULL
         AND pos_current_register_id() IS DISTINCT FROM NEW.register_id
       ) THEN
      RAISE EXCEPTION 'actor is not authorized' USING ERRCODE = '42501';
    END IF;
    -- intentionally omit pos_actor_access_is_active for negative control
  END IF;
  IF NEW.opening_float_currency IS NULL THEN
    NEW.opening_float_currency := reg.currency;
  END IF;
  IF NEW.opening_float_currency <> reg.currency THEN
    RAISE EXCEPTION 'opening float currency must match register' USING ERRCODE = '23514';
  END IF;
  NEW.expected_cash_minor := NEW.opening_float_minor;
  NEW.expected_cash_currency := NEW.opening_float_currency;
  NEW.status := COALESCE(NEW.status, 'open');
  IF NEW.status <> 'open' THEN
    RAISE EXCEPTION 'new shifts must open as open' USING ERRCODE = '23514';
  END IF;
  NEW.opened_at := now();
  NEW.closed_at := NULL;
  NEW.counted_cash_minor := NULL;
  NEW.counted_cash_currency := NULL;
  NEW.variance_minor := NULL;
  NEW.variance_currency := NULL;
  RETURN NEW;
END;
$$;

SET ROLE service_role;
UPDATE pos_staff_access_controls
SET status = 'disabled', reason = 'negative control', updated_by_actor_id = 'manager_a', updated_at = now()
WHERE organization_id = 'org_a' AND actor_id = 'cashier_a';
UPDATE pos_shifts SET status = 'closed', closed_at = now(), counted_cash_minor = expected_cash_minor, counted_cash_currency = expected_cash_currency, variance_minor = 0, variance_currency = expected_cash_currency
WHERE register_id = 'reg_a' AND status IN ('open', 'closing');
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
SELECT lives_ok(
  $$ INSERT INTO pos_shifts (
       id, register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
     ) VALUES (
       'bb100000-0000-4000-8000-000000000099',
       'reg_a', '00000000-0000-4000-8000-0000000000a1', 5000, 'GHS', 'cashier_a'
     ) $$,
  'negative control: without disabled predicate, disabled actor can open reg_a'
);
RESET ROLE;

SELECT finish();
ROLLBACK;
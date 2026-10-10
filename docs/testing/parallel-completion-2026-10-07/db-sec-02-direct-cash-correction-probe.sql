-- DB-SEC-02 asserting probe. Disposable local only. Never hosted.
-- Exit non-zero if direct authenticated correction is still allowed.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF inet_server_addr() IS NOT NULL AND inet_server_addr()::text NOT IN ('127.0.0.1','::1') THEN
    RAISE EXCEPTION 'isolated loopback database required';
  END IF;
END $$;
SELECT set_config('request.jwt.claims','{}',true);
SET LOCAL ROLE service_role;
INSERT INTO public.pos_shifts (
  id, register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
) VALUES (
  '99000000-0000-4000-8000-000000000001',
  'reg_a','00000000-0000-4000-8000-0000000000a1',5000,'GHS','cashier_a'
);
INSERT INTO public.pos_cash_movements (
  id, shift_id, kind, signed_amount_minor, currency, actor_id, reason
) VALUES (
  '99000000-0000-4000-8000-000000000002',
  '99000000-0000-4000-8000-000000000001','pay_in',2500,'GHS','cashier_a','synthetic original'
);
RESET ROLE;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'role','authenticated','sub','00000000-0000-4000-8000-000000000001',
  'app_metadata', jsonb_build_object(
    'organization_id','org_a','actor_id','cashier_a',
    'location_ids', jsonb_build_array('loc_a1'),'register_id','reg_a'
  )
)::text, true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.pos_cash_movements (
      id, shift_id, kind, signed_amount_minor, currency, actor_id, reason,
      corrects_movement_id, approval_id
    ) VALUES (
      '99000000-0000-4000-8000-000000000005',
      '99000000-0000-4000-8000-000000000001','correction',-2500,'GHS','cashier_a',
      'synthetic direct reversal',
      '99000000-0000-4000-8000-000000000002','99000000-0000-4000-8000-000000000004'
    );
    RAISE EXCEPTION 'DB-SEC-02 OPEN: direct correction still allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'DB-SEC-02 CLOSED';
  WHEN OTHERS THEN
    IF SQLERRM = 'DB-SEC-02 OPEN: direct correction still allowed' THEN RAISE; END IF;
    IF SQLSTATE = '42501' THEN
      RAISE NOTICE 'DB-SEC-02 CLOSED (% )', SQLERRM;
    ELSE RAISE; END IF;
  END;
END $$;
RESET ROLE;
ROLLBACK;
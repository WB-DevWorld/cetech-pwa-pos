-- DB-SEC-03: disposable local only. Schema-adapted from review evidence. Never hosted.
-- Before repair: disabled actor Auth JWT can INSERT pay_in via RLS.
-- After 20261009140000: denied 42501; active actor pay_in still works.
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
  '99100000-0000-4000-8000-000000000001',
  'reg_a','00000000-0000-4000-8000-0000000000a1',5000,'GHS','cashier_a'
);
INSERT INTO public.pos_staff_access_controls (
  organization_id, actor_id, status, reason, updated_by_actor_id
) VALUES (
  'org_a','cashier_a','disabled','synthetic disable','manager_a'
)
ON CONFLICT (organization_id, actor_id) DO UPDATE
SET status='disabled', reason=EXCLUDED.reason, updated_by_actor_id=EXCLUDED.updated_by_actor_id, updated_at=now();
RESET ROLE;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'role','authenticated','sub','00000000-0000-4000-8000-000000000001',
  'app_metadata', jsonb_build_object(
    'organization_id','org_a','actor_id','cashier_a',
    'location_ids', jsonb_build_array('loc_a1'),'register_id','reg_a'
  )
)::text, true);
SET LOCAL ROLE authenticated;
SELECT 'DISABLED_REGISTER_READ' AS probe, count(*) FROM public.pos_registers WHERE id='reg_a';
DO $$ BEGIN
  BEGIN
    INSERT INTO public.pos_cash_movements (
      id, shift_id, kind, signed_amount_minor, currency, actor_id, reason
    ) VALUES (
      '99100000-0000-4000-8000-000000000002',
      '99100000-0000-4000-8000-000000000001','pay_in',100,'GHS','cashier_a',
      'synthetic post-disable direct insert'
    );
    RAISE NOTICE 'DB-SEC-03 OPEN: disabled cash insert succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'DB-SEC-03 CLOSED: disabled cash insert denied';
  WHEN OTHERS THEN
    IF SQLSTATE = '42501' OR SQLERRM ILIKE '%disabled%' THEN
      RAISE NOTICE 'DB-SEC-03 CLOSED: disabled cash insert denied (% / %)', SQLSTATE, SQLERRM;
    ELSE RAISE; END IF;
  END;
END $$;
RESET ROLE;
SELECT 'DISABLED_CASH_INSERT' AS probe, count(*) FROM public.pos_cash_movements WHERE id='99100000-0000-4000-8000-000000000002';
ROLLBACK;
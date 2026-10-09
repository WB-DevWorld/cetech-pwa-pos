-- R-F4-01 write-boundary proof. Disposable local only.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE service_role;
INSERT INTO public.pos_shifts (
  id, register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
) VALUES (
  'aa100000-0000-4000-8000-000000000001',
  'reg_a','00000000-0000-4000-8000-0000000000a1',5000,'GHS','cashier_a'
);
INSERT INTO public.pos_checkout_sales (
  transaction_id, organization_id, location_id, register_id, shift_id, sale_id, status, record
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01','org_a','loc_a1','reg_a',
  'aa100000-0000-4000-8000-000000000001','rf401-1','prepared','{"status":"prepared"}'::jsonb
);
INSERT INTO public.pos_sale_tender_claims (
  transaction_id, organization_id, location_id, tender_family, actor_id
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01','org_a','loc_a1','electronic','cashier_a'
);
DO $$ BEGIN
  BEGIN
    INSERT INTO public.pos_cash_movements (
      shift_id, kind, signed_amount_minor, currency, actor_id, transaction_id, reason
    ) VALUES (
      'aa100000-0000-4000-8000-000000000001','cash_sale',1500,'GHS','cashier_a',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01','legacy cash bypass'
    );
    RAISE EXCEPTION 'R-F4-01 OPEN: cash_sale under electronic claim';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM ILIKE '%tender family%' THEN
      RAISE NOTICE 'R-F4-01 CLOSED';
    ELSE RAISE; END IF;
  END;
END $$;
RESET ROLE;
ROLLBACK;
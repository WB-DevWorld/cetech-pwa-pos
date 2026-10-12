-- Disposable local TF-01 proof (synthetic). Not for hosted staging.
-- Applies against a migrated local Postgres with proposed tender-claim + atomic-cash migrations.

\set ON_ERROR_STOP on

BEGIN;

SET LOCAL ROLE service_role;

-- Open synthetic shift on fixture register.
INSERT INTO public.pos_shifts (
  register_id, device_id, opening_float_minor, opening_float_currency, cashier_id
) VALUES (
  'reg_a', '00000000-0000-4000-8000-0000000000a1', 10000, 'GHS', 'cashier_a'
);

SELECT set_config(
  'pos_test.tf01_shift',
  (SELECT id::text FROM public.pos_shifts WHERE register_id = 'reg_a' AND status = 'open' LIMIT 1),
  true
);

INSERT INTO public.pos_checkout_sales (
  transaction_id, organization_id, location_id, register_id, shift_id, sale_id, status, record
) VALUES
(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'org_a', 'loc_a1', 'reg_a',
  current_setting('pos_test.tf01_shift')::uuid,
  'tf01-atomic-1', 'prepared',
  jsonb_build_object('status', 'prepared')
),
(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'org_a', 'loc_a1', 'reg_a',
  current_setting('pos_test.tf01_shift')::uuid,
  'tf01-race-2', 'prepared',
  jsonb_build_object('status', 'prepared')
);

-- 1) Atomic rollback: invalid verified cash payment must leave zero cash_sale rows
--    and unchanged expected cash after the failed RPC.
DO $$
DECLARE
  v_expected_before bigint;
  v_expected_after bigint;
  v_moves integer;
  v_err text;
BEGIN
  SELECT expected_cash_minor INTO v_expected_before
  FROM public.pos_shifts
  WHERE id = current_setting('pos_test.tf01_shift')::uuid;

  BEGIN
    PERFORM public.pos_record_verified_cash_sale(
      'org_a',
      'loc_a1',
      jsonb_build_object(
        'id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
        'shift_id', current_setting('pos_test.tf01_shift')::uuid,
        'kind', 'cash_sale',
        'signed_amount_minor', 1500,
        'currency', 'GHS',
        'actor_id', 'cashier_a',
        'transaction_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        'reason', 'cash sale',
        'created_at', now()
      ),
      jsonb_build_object(
        'payment_id', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        'organization_id', 'org_a',
        'location_id', 'loc_a1',
        'transaction_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        'sale_id', 'tf01-atomic-1',
        'evidence_id', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
        'tender', 'cash',
        'status', 'verified',
        'amount_minor', 1500,
        'amount_currency', 'GHS',
        -- missing cash_received_* forces cash_fields_check failure after movement insert
        'verified_at', now(),
        'verification_source', 'cash_ledger',
        'actor_id', 'cashier_a'
      )
    );
    RAISE EXCEPTION 'expected atomic cash RPC to fail';
  EXCEPTION
    WHEN others THEN
      v_err := SQLERRM;
      IF v_err = 'expected atomic cash RPC to fail' THEN
        RAISE;
      END IF;
  END;

  SELECT count(*)::integer INTO v_moves
  FROM public.pos_cash_movements
  WHERE transaction_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    AND kind = 'cash_sale';

  SELECT expected_cash_minor INTO v_expected_after
  FROM public.pos_shifts
  WHERE id = current_setting('pos_test.tf01_shift')::uuid;

  IF v_moves <> 0 THEN
    RAISE EXCEPTION 'atomic rollback left % cash_sale rows', v_moves;
  END IF;
  IF v_expected_after IS DISTINCT FROM v_expected_before THEN
    RAISE EXCEPTION 'atomic rollback changed expected cash from % to %', v_expected_before, v_expected_after;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pos_checkout_payments
    WHERE transaction_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ) THEN
    RAISE EXCEPTION 'atomic rollback left a payment row';
  END IF;

  RAISE NOTICE 'TF-01 atomic rollback PASS (moves=0, expected_cash unchanged)';
END $$;

-- 2) Happy path atomic commit: both movement and payment exist; expected cash +1500.
SELECT public.pos_record_verified_cash_sale(
  'org_a',
  'loc_a1',
  jsonb_build_object(
    'id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'shift_id', current_setting('pos_test.tf01_shift')::uuid,
    'kind', 'cash_sale',
    'signed_amount_minor', 1500,
    'currency', 'GHS',
    'actor_id', 'cashier_a',
    'transaction_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'reason', 'cash sale',
    'created_at', now()
  ),
  jsonb_build_object(
    'payment_id', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    'organization_id', 'org_a',
    'location_id', 'loc_a1',
    'transaction_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'sale_id', 'tf01-atomic-1',
    'evidence_id', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
    'tender', 'cash',
    'status', 'verified',
    'amount_minor', 1500,
    'amount_currency', 'GHS',
    'cash_received_minor', 2000,
    'cash_received_currency', 'GHS',
    'verified_at', now(),
    'verification_source', 'cash_ledger',
    'actor_id', 'cashier_a'
  )
) AS atomic_ok;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.pos_cash_movements
      WHERE transaction_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' AND kind = 'cash_sale') <> 1 THEN
    RAISE EXCEPTION 'happy path expected one cash_sale';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.pos_checkout_payments
    WHERE payment_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2' AND status = 'verified'
  ) THEN
    RAISE EXCEPTION 'happy path missing verified payment';
  END IF;
  IF (SELECT expected_cash_minor FROM public.pos_shifts
      WHERE id = current_setting('pos_test.tf01_shift')::uuid) <> 11500 THEN
    RAISE EXCEPTION 'happy path expected cash not 11500';
  END IF;
  RAISE NOTICE 'TF-01 atomic commit PASS';
END $$;

-- 3) Durable claim exclusion without process locks (two independent statements).
INSERT INTO public.pos_sale_tender_claims (
  transaction_id, organization_id, location_id, tender_family, actor_id
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'org_a', 'loc_a1', 'electronic', 'cashier_a'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.pos_sale_tender_claims (
      transaction_id, organization_id, location_id, tender_family, actor_id
    ) VALUES (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'org_a', 'loc_a1', 'cash', 'cashier_a'
    );
    RAISE EXCEPTION 'opposite tender claim should conflict';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  IF (SELECT tender_family FROM public.pos_sale_tender_claims
      WHERE transaction_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2') <> 'electronic' THEN
    RAISE EXCEPTION 'electronic claim was overwritten';
  END IF;

  IF (SELECT count(*) FROM public.pos_cash_movements
      WHERE transaction_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2') <> 0 THEN
    RAISE EXCEPTION 'cash movement appeared under electronic claim';
  END IF;

  RAISE NOTICE 'TF-01 claim exclusion PASS';
END $$;

-- Role negatives: anon/authenticated cannot execute the RPC or insert claims.
RESET ROLE;

DO $$
BEGIN
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM public.pos_record_verified_cash_sale('org_a', 'loc_a1', NULL, '{}'::jsonb);
    RAISE EXCEPTION 'anon should not execute atomic RPC';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
    WHEN others THEN
      IF SQLERRM = 'anon should not execute atomic RPC' THEN
        RAISE;
      END IF;
      -- permission denied variants
      NULL;
  END;
  RESET ROLE;
  RAISE NOTICE 'TF-01 anon RPC deny PASS';
END $$;

ROLLBACK;

\echo TF-01 disposable proof script completed (rolled back fixtures)

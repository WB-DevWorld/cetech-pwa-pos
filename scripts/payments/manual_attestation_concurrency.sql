-- Two-session proof for manual Mobile Money confirmation.
-- Requires the migration chain, including 20261010120000, and supabase/seed.sql.
-- Disposable database only. Does not touch a retained restore.

CREATE TABLE IF NOT EXISTS cas_log (
  name text PRIMARY KEY,
  detail text NOT NULL
);

TRUNCATE cas_log;

CREATE OR REPLACE FUNCTION cas_note(p_name text, p_detail text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO cas_log (name, detail) VALUES (p_name, p_detail)
  ON CONFLICT (name) DO UPDATE SET detail = EXCLUDED.detail;
END;
$$;

CREATE OR REPLACE FUNCTION cas_try_verify(
  p_payment uuid,
  p_reference text,
  p_actor text,
  p_evidence uuid
)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  n int;
BEGIN
  UPDATE public.pos_checkout_payments
  SET status = 'verified',
      provider_reference = p_reference,
      verification_source = 'approved_external_attestation',
      verified_at = '2026-10-12 12:00:00+00',
      evidence_id = p_evidence,
      manual_network = 'MTN',
      merchant_account_label = 'Shop till',
      attestation_actor_id = p_actor
  WHERE payment_id = p_payment
    AND status = 'awaiting_customer'
    AND provider = 'manual_mobile_money';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION cas_wait_for_lock(p_marker text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  seen boolean := false;
  tries int := 0;
BEGIN
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND wait_event_type = 'Lock'
        AND query ILIKE '%' || p_marker || '%'
    ) INTO seen;
    EXIT WHEN seen OR tries >= 100;
    PERFORM pg_sleep(0.05);
    tries := tries + 1;
  END LOOP;
  IF NOT seen THEN
    RAISE EXCEPTION 'no overlapping lock wait for %', p_marker;
  END IF;
  PERFORM cas_note(p_marker || '_overlap', 'Lock');
END;
$$;

INSERT INTO pos_shifts (
  id, organization_id, location_id, register_id, device_id, cashier_id, status,
  opening_float_minor, opening_float_currency, expected_cash_minor, expected_cash_currency
) VALUES (
  '22222222-2222-4222-8222-222222222221',
  'org_a', 'loc_a1', 'reg_a',
  '00000000-0000-4000-8000-0000000000a1',
  'cashier_a', 'open', 0, 'GHS', 0, 'GHS'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO pos_checkout_sales (
  transaction_id, organization_id, location_id, register_id, shift_id, sale_id, status, record
) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'org_a', 'loc_a1', 'reg_a', '22222222-2222-4222-8222-222222222221', 'sale-cas-1', 'prepared', '{}'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'org_a', 'loc_a1', 'reg_a', '22222222-2222-4222-8222-222222222221', 'sale-cas-2a', 'prepared', '{}'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'org_a', 'loc_a1', 'reg_a', '22222222-2222-4222-8222-222222222221', 'sale-cas-2b', 'prepared', '{}'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'org_a', 'loc_a1', 'reg_a', '22222222-2222-4222-8222-222222222221', 'sale-cas-4', 'prepared', '{}'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'org_a', 'loc_a1', 'reg_a', '22222222-2222-4222-8222-222222222221', 'sale-cas-5', 'prepared', '{}')
ON CONFLICT (transaction_id) DO NOTHING;

INSERT INTO pos_checkout_payments (
  payment_id, organization_id, location_id, transaction_id, sale_id,
  tender, status, amount_minor, amount_currency, actor_id,
  provider, provider_reference, manual_network, merchant_account_label
) VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'org_a', 'loc_a1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'sale-cas-1',
   'mobile_money', 'awaiting_customer', 2900, 'GHS', 'cashier_a',
   'manual_mobile_money', 'intent:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'MTN', 'Shop till'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'org_a', 'loc_a1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'sale-cas-2a',
   'mobile_money', 'awaiting_customer', 2900, 'GHS', 'cashier_a',
   'manual_mobile_money', 'intent:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'MTN', 'Shop till'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'org_a', 'loc_a1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'sale-cas-2b',
   'mobile_money', 'awaiting_customer', 4100, 'GHS', 'cashier_b',
   'manual_mobile_money', 'intent:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'MTN', 'Shop till')
ON CONFLICT (payment_id) DO NOTHING;

SELECT dblink_connect('loser', format('dbname=%s user=%s', current_database(), current_user));

-- 1. Same payment, two merchant references. The open transaction holds the row.
BEGIN;
SELECT cas_try_verify(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'MM-WIN',
  'cashier_a',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'
);
SELECT dblink_send_query('loser', $q$
  SELECT cas_try_verify(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'MM-LOSE',
    'cashier_b',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'
  )
$q$);
SELECT cas_wait_for_lock('MM-LOSE');
COMMIT;

SELECT cas_note('case1_loser_rows', detail)
FROM dblink_get_result('loser') AS t(detail text);

-- 2. Two sales, one merchant reference.
SELECT dblink_connect('shared', format('dbname=%s user=%s', current_database(), current_user));
BEGIN;
SELECT cas_try_verify(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'MM-SHARED',
  'cashier_a',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3'
);
SELECT dblink_send_query('shared', $q$
  SELECT cas_try_verify(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
    'MM-SHARED',
    'cashier_b',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4'
  )
$q$);
SELECT cas_wait_for_lock('MM-SHARED');
COMMIT;

DO $$
DECLARE
  msg text;
BEGIN
  BEGIN
    PERFORM detail FROM dblink_get_result('shared') AS t(detail text);
    PERFORM cas_note('case2_loser', 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    PERFORM cas_note('case2_loser', SQLSTATE || ' ' || msg);
  END;
END $$;

-- 3. Identical retry does not write again.
DO $$
DECLARE
  before_xmin xid;
  after_xmin xid;
  updated int;
BEGIN
  SELECT xmin INTO before_xmin
  FROM pos_checkout_payments
  WHERE payment_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  SELECT cas_try_verify(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'MM-WIN',
    'cashier_a',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'
  ) INTO updated;
  SELECT xmin INTO after_xmin
  FROM pos_checkout_payments
  WHERE payment_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  IF updated <> 0 OR before_xmin IS DISTINCT FROM after_xmin THEN
    RAISE EXCEPTION 'identical retry mutated the attestation (% -> %, rows %)', before_xmin, after_xmin, updated;
  END IF;
  PERFORM cas_note('case3_retry', 'rows=0 xmin=' || before_xmin::text);
END $$;

-- 4. Cash claim blocks a manual insert on the same sale.
SELECT dblink_connect('manual', format('dbname=%s user=%s', current_database(), current_user));
BEGIN;
INSERT INTO pos_checkout_payments (
  payment_id, organization_id, location_id, transaction_id, sale_id,
  tender, status, amount_minor, amount_currency, actor_id,
  cash_received_minor, cash_received_currency, evidence_id, verified_at, verification_source
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'org_a', 'loc_a1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'sale-cas-4',
  'cash', 'verified', 2900, 'GHS', 'cashier_a',
  2900, 'GHS', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5',
  '2026-10-12 12:00:00+00', 'cash_ledger'
);
SELECT dblink_send_query('manual', $q$
  INSERT INTO pos_checkout_payments (
    payment_id, organization_id, location_id, transaction_id, sale_id,
    tender, status, amount_minor, amount_currency, actor_id,
    provider, provider_reference, manual_network, merchant_account_label
  ) VALUES (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb14', 'org_a', 'loc_a1',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'sale-cas-4',
    'mobile_money', 'awaiting_customer', 2900, 'GHS', 'cashier_a',
    'manual_mobile_money', 'MM-FAMILY-LOSE', 'MTN', 'Shop till'
  )
$q$);
SELECT cas_wait_for_lock('MM-FAMILY-LOSE');
COMMIT;

DO $$
DECLARE msg text;
BEGIN
  BEGIN
    PERFORM * FROM dblink_get_result('manual') AS t(result text);
    PERFORM cas_note('case4_manual', 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    PERFORM cas_note('case4_manual', SQLSTATE || ' ' || msg);
  END;
END $$;

-- Paystack and manual are one electronic family, and only one payment row survives.
SELECT dblink_connect('paystack', format('dbname=%s user=%s', current_database(), current_user));
BEGIN;
INSERT INTO pos_checkout_payments (
  payment_id, organization_id, location_id, transaction_id, sale_id,
  tender, status, amount_minor, amount_currency, actor_id,
  provider, provider_reference
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5', 'org_a', 'loc_a1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'sale-cas-5',
  'mobile_money', 'awaiting_customer', 2900, 'GHS', 'cashier_a',
  'paystack', 'PS-WIN'
);
SELECT dblink_send_query('paystack', $q$
  INSERT INTO pos_checkout_payments (
    payment_id, organization_id, location_id, transaction_id, sale_id,
    tender, status, amount_minor, amount_currency, actor_id,
    provider, provider_reference, manual_network, merchant_account_label
  ) VALUES (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb15', 'org_a', 'loc_a1',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'sale-cas-5',
    'mobile_money', 'awaiting_customer', 2900, 'GHS', 'cashier_a',
    'manual_mobile_money', 'MM-DUAL-LOSE', 'MTN', 'Shop till'
  )
$q$);
SELECT cas_wait_for_lock('MM-DUAL-LOSE');
COMMIT;

DO $$
DECLARE msg text;
BEGIN
  BEGIN
    PERFORM * FROM dblink_get_result('paystack') AS t(result text);
    PERFORM cas_note('case4_paystack', 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    PERFORM cas_note('case4_paystack', SQLSTATE || ' ' || msg);
  END;
END $$;

-- 5. Ordinary update and delete cannot change the winning attestation.
DO $$
BEGIN
  BEGIN
    UPDATE pos_checkout_payments
    SET provider_reference = 'MM-REPLACED'
    WHERE payment_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
    PERFORM cas_note('case5_update', 'unexpected success');
  EXCEPTION WHEN check_violation THEN
    PERFORM cas_note('case5_update', SQLSTATE || ' ' || SQLERRM);
  END;
  BEGIN
    DELETE FROM pos_checkout_payments
    WHERE payment_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
    PERFORM cas_note('case5_delete', 'unexpected success');
  EXCEPTION WHEN check_violation THEN
    PERFORM cas_note('case5_delete', SQLSTATE || ' ' || SQLERRM);
  END;
  BEGIN
    UPDATE pos_checkout_payments
    SET amount_minor = 1
    WHERE payment_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
    PERFORM cas_note('case5_amount', 'unexpected success');
  EXCEPTION WHEN check_violation THEN
    PERFORM cas_note('case5_amount', SQLSTATE || ' ' || SQLERRM);
  END;
  BEGIN
    UPDATE pos_checkout_payments
    SET organization_id = 'org_b'
    WHERE payment_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
    PERFORM cas_note('case5_org', 'unexpected success');
  EXCEPTION WHEN check_violation THEN
    PERFORM cas_note('case5_org', SQLSTATE || ' ' || SQLERRM);
  END;
END $$;

-- 6. NULL evidence and direct browser-role writes fail.
DO $$
DECLARE
  missing text;
BEGIN
  FOREACH missing IN ARRAY ARRAY['source', 'network', 'actor', 'reference', 'evidence', 'timestamp'] LOOP
    BEGIN
      INSERT INTO pos_checkout_sales (
        transaction_id, organization_id, location_id, register_id, shift_id, sale_id, status, record
      ) VALUES (
        (substr(md5(missing), 1, 8) || '-cccc-4ccc-8ccc-' || substr(md5(missing), 9, 12))::uuid,
        'org_a', 'loc_a1', 'reg_a', '22222222-2222-4222-8222-222222222221',
        'sale-missing-' || missing, 'prepared', '{}'
      );
      INSERT INTO pos_checkout_payments (
        payment_id, organization_id, location_id, transaction_id, sale_id,
        tender, status, amount_minor, amount_currency, actor_id,
        provider, provider_reference, verification_source, verified_at, evidence_id,
        manual_network, merchant_account_label, attestation_actor_id
      ) VALUES (
        gen_random_uuid(), 'org_a', 'loc_a1',
        (substr(md5(missing), 1, 8) || '-cccc-4ccc-8ccc-' || substr(md5(missing), 9, 12))::uuid,
        'sale-missing-' || missing,
        'mobile_money', 'verified', 2900, 'GHS', 'cashier_a',
        'manual_mobile_money',
        CASE WHEN missing = 'reference' THEN NULL ELSE 'MM-MISSING-' || missing END,
        CASE WHEN missing = 'source' THEN NULL ELSE 'approved_external_attestation' END,
        CASE WHEN missing = 'timestamp' THEN NULL ELSE '2026-10-12 12:00:00+00'::timestamptz END,
        CASE WHEN missing = 'evidence' THEN NULL ELSE gen_random_uuid() END,
        CASE WHEN missing = 'network' THEN NULL ELSE 'MTN' END,
        'Shop till',
        CASE WHEN missing = 'actor' THEN NULL ELSE 'cashier_a' END
      );
      PERFORM cas_note('case6_' || missing, 'unexpected success');
    EXCEPTION WHEN check_violation THEN
      PERFORM cas_note('case6_' || missing, SQLSTATE);
    END;
  END LOOP;
END $$;

SELECT dblink_connect('browser', format('dbname=%s user=%s', current_database(), current_user));

DO $$
DECLARE msg text;
BEGIN
  PERFORM dblink_exec('browser', 'SET ROLE anon');
  BEGIN
    PERFORM dblink_exec('browser', $q$
      INSERT INTO pos_checkout_payments (
        payment_id, organization_id, location_id, transaction_id, sale_id,
        tender, status, amount_minor, amount_currency, actor_id,
        provider, provider_reference, manual_network, merchant_account_label
      ) VALUES (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb99', 'org_a', 'loc_a1',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'sale-cas-1',
        'mobile_money', 'verified', 2900, 'GHS', 'cashier_a',
        'manual_mobile_money', 'MM-ANON', 'MTN', 'Shop till'
      )
    $q$);
    PERFORM cas_note('case6_anon', 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    PERFORM cas_note('case6_anon', SQLSTATE || ' ' || msg);
  END;
  PERFORM dblink_exec('browser', 'RESET ROLE');
  PERFORM dblink_exec('browser', 'SET ROLE authenticated');
  BEGIN
    PERFORM dblink_exec('browser', $q$
      UPDATE pos_checkout_payments
      SET provider_reference = 'MM-AUTH'
      WHERE payment_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
    $q$);
    PERFORM cas_note('case6_authenticated', 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    PERFORM cas_note('case6_authenticated', SQLSTATE || ' ' || msg);
  END;
  PERFORM dblink_exec('browser', 'RESET ROLE');
END $$;

-- 7. Confirmation did not create a cash movement.
SELECT cas_note(
  'case7_cash_movements',
  count(*)::text
)
FROM pos_cash_movements
WHERE transaction_id IN (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
);

DO $$
DECLARE
  win_reference text;
  win_actor text;
  win_evidence uuid;
  win_amount bigint;
  win_network text;
  win_account text;
  win_sale text;
  win_org text;
  win_verified timestamptz;
  shared_status text;
  other_status text;
  cash_family text;
  paystack_count int;
  manual_count int;
BEGIN
  SELECT provider_reference, attestation_actor_id, evidence_id, amount_minor,
         manual_network, merchant_account_label, sale_id, organization_id, verified_at
  INTO win_reference, win_actor, win_evidence, win_amount,
       win_network, win_account, win_sale, win_org, win_verified
  FROM pos_checkout_payments
  WHERE payment_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  IF win_reference IS DISTINCT FROM 'MM-WIN'
     OR win_actor IS DISTINCT FROM 'cashier_a'
     OR win_evidence IS DISTINCT FROM 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'::uuid
     OR win_amount IS DISTINCT FROM 2900
     OR win_network IS DISTINCT FROM 'MTN'
     OR win_account IS DISTINCT FROM 'Shop till'
     OR win_sale IS DISTINCT FROM 'sale-cas-1'
     OR win_org IS DISTINCT FROM 'org_a'
     OR win_verified IS DISTINCT FROM '2026-10-12 12:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'winning attestation changed: % % % % %', win_reference, win_actor, win_amount, win_sale, win_verified;
  END IF;

  SELECT status INTO shared_status
  FROM pos_checkout_payments
  WHERE payment_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  SELECT status INTO other_status
  FROM pos_checkout_payments
  WHERE payment_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3';
  IF shared_status IS DISTINCT FROM 'verified' OR other_status IS DISTINCT FROM 'awaiting_customer' THEN
    RAISE EXCEPTION 'shared reference result % / %', shared_status, other_status;
  END IF;

  SELECT tender_family INTO cash_family
  FROM pos_sale_tender_claims
  WHERE transaction_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
  IF cash_family IS DISTINCT FROM 'cash' THEN
    RAISE EXCEPTION 'cash family was %', cash_family;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pos_checkout_payments
    WHERE transaction_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'
      AND provider = 'manual_mobile_money'
  ) THEN
    RAISE EXCEPTION 'manual payment settled beside cash';
  END IF;

  SELECT count(*) INTO paystack_count
  FROM pos_checkout_payments
  WHERE transaction_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'
    AND provider = 'paystack';
  SELECT count(*) INTO manual_count
  FROM pos_checkout_payments
  WHERE transaction_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'
    AND provider = 'manual_mobile_money';
  IF paystack_count <> 1 OR manual_count <> 0 THEN
    RAISE EXCEPTION 'dual settlement paystack % manual %', paystack_count, manual_count;
  END IF;

  IF EXISTS (SELECT 1 FROM cas_log WHERE detail ILIKE '%unexpected success%') THEN
    RAISE EXCEPTION 'concurrency proof recorded an unexpected success';
  END IF;
  IF (SELECT detail FROM cas_log WHERE name = 'case1_loser_rows') IS DISTINCT FROM '0' THEN
    RAISE EXCEPTION 'loser wrote % rows', (SELECT detail FROM cas_log WHERE name = 'case1_loser_rows');
  END IF;
  IF (SELECT detail FROM cas_log WHERE name = 'case2_loser') NOT LIKE '23505%' THEN
    RAISE EXCEPTION 'shared reference loser was %', (SELECT detail FROM cas_log WHERE name = 'case2_loser');
  END IF;
  IF (SELECT detail FROM cas_log WHERE name = 'case4_manual') NOT LIKE '%tender family%' THEN
    RAISE EXCEPTION 'cash/manual loser was %', (SELECT detail FROM cas_log WHERE name = 'case4_manual');
  END IF;
  IF (SELECT detail FROM cas_log WHERE name = 'case4_paystack') NOT LIKE '23505%' THEN
    RAISE EXCEPTION 'paystack/manual loser was %', (SELECT detail FROM cas_log WHERE name = 'case4_paystack');
  END IF;
  IF (SELECT detail FROM cas_log WHERE name = 'case7_cash_movements') IS DISTINCT FROM '0' THEN
    RAISE EXCEPTION 'manual confirmation created cash movements';
  END IF;
  IF EXISTS (
    SELECT 1 FROM cas_log
    WHERE name LIKE 'case6_%' AND detail NOT LIKE '23514%' AND detail NOT LIKE '42501%'
  ) THEN
    RAISE EXCEPTION 'a required rejection did not fail closed';
  END IF;
END $$;

SELECT name, detail FROM cas_log ORDER BY name;

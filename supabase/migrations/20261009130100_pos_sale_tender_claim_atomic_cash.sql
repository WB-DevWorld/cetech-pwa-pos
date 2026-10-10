-- TF-01: cash_sale movement + verified cash payment commit together or neither.
-- Additive. Hosted apply is a separate release action (do not bulk-push with RD-01).
-- service_role only; not a browser surface. Does not hold provider HTTP.

CREATE OR REPLACE FUNCTION public.pos_record_verified_cash_sale(
  p_organization_id pos_id,
  p_location_id pos_id,
  p_movement jsonb,
  p_payment jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_movement_id uuid;
  v_shift_id uuid;
  v_kind text;
  v_signed_minor bigint;
  v_currency text;
  v_actor_id text;
  v_transaction_id uuid;
  v_reason text;
  v_created_at timestamptz;
BEGIN
  IF p_payment IS NULL
     OR jsonb_typeof(p_payment) <> 'object'
     OR NULLIF(p_payment->>'payment_id', '') IS NULL
     OR NULLIF(p_payment->>'transaction_id', '') IS NULL THEN
    RAISE EXCEPTION 'invalid verified cash payment payload' USING ERRCODE = '23514';
  END IF;

  IF (p_payment->>'tender') IS DISTINCT FROM 'cash'
     OR (p_payment->>'status') IS DISTINCT FROM 'verified'
     OR (p_payment->>'verification_source') IS DISTINCT FROM 'cash_ledger' THEN
    RAISE EXCEPTION 'pos_record_verified_cash_sale accepts verified cash only' USING ERRCODE = '23514';
  END IF;

  IF p_organization_id IS DISTINCT FROM (p_payment->>'organization_id')::public.pos_id
     OR p_location_id IS DISTINCT FROM (p_payment->>'location_id')::public.pos_id THEN
    RAISE EXCEPTION 'payment organization/location scope mismatch' USING ERRCODE = '42501';
  END IF;

  IF p_movement IS NOT NULL AND jsonb_typeof(p_movement) = 'object' THEN
    v_movement_id := (p_movement->>'id')::uuid;
    v_shift_id := (p_movement->>'shift_id')::uuid;
    v_kind := p_movement->>'kind';
    v_signed_minor := (p_movement->>'signed_amount_minor')::bigint;
    v_currency := p_movement->>'currency';
    v_actor_id := p_movement->>'actor_id';
    v_transaction_id := (p_movement->>'transaction_id')::uuid;
    v_reason := NULLIF(p_movement->>'reason', '');
    v_created_at := COALESCE((p_movement->>'created_at')::timestamptz, now());

    IF v_kind IS DISTINCT FROM 'cash_sale' THEN
      RAISE EXCEPTION 'pos_record_verified_cash_sale accepts cash_sale movements only' USING ERRCODE = '23514';
    END IF;
    IF v_transaction_id IS DISTINCT FROM (p_payment->>'transaction_id')::uuid THEN
      RAISE EXCEPTION 'movement/payment transaction mismatch' USING ERRCODE = '23514';
    END IF;

    BEGIN
      INSERT INTO public.pos_cash_movements (
        id, shift_id, kind, signed_amount_minor, currency, actor_id,
        transaction_id, reason, refund_id, created_at
      ) VALUES (
        v_movement_id, v_shift_id, v_kind, v_signed_minor, v_currency::public.pos_currency,
        v_actor_id::public.pos_id, v_transaction_id, v_reason, NULL, v_created_at
      );
    EXCEPTION
      WHEN unique_violation THEN
        -- One cash_sale per transaction already durable; continue payment persist repair.
        NULL;
    END;
  END IF;

  INSERT INTO public.pos_checkout_payments (
    payment_id,
    organization_id,
    location_id,
    transaction_id,
    sale_id,
    evidence_id,
    tender,
    status,
    amount_minor,
    amount_currency,
    cash_received_minor,
    cash_received_currency,
    verified_at,
    verification_source,
    actor_id,
    provider,
    provider_reference,
    provider_transaction_id,
    display_reference,
    access_code,
    initialize_status,
    last_verified_at,
    attention_reason
  ) VALUES (
    (p_payment->>'payment_id')::uuid,
    p_organization_id,
    p_location_id,
    (p_payment->>'transaction_id')::uuid,
    (p_payment->>'sale_id')::public.pos_id,
    (p_payment->>'evidence_id')::uuid,
    'cash',
    'verified',
    (p_payment->>'amount_minor')::bigint,
    (p_payment->>'amount_currency')::public.pos_currency,
    (p_payment->>'cash_received_minor')::bigint,
    (p_payment->>'cash_received_currency')::public.pos_currency,
    (p_payment->>'verified_at')::timestamptz,
    'cash_ledger',
    (p_payment->>'actor_id')::public.pos_id,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
  )
  ON CONFLICT (payment_id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pos_checkout_payments
    WHERE payment_id = (p_payment->>'payment_id')::uuid
       OR (
         transaction_id = (p_payment->>'transaction_id')::uuid
         AND tender = 'cash'
         AND status = 'verified'
       )
  ) THEN
    RAISE EXCEPTION 'verified cash payment was not retained' USING ERRCODE = '55000';
  END IF;

  RETURN 'ok';
EXCEPTION
  WHEN check_violation THEN
    IF SQLERRM ILIKE '%negative%' OR SQLERRM ILIKE '%expected cash%' THEN
      RETURN 'negative_expected';
    END IF;
    RAISE;
  WHEN others THEN
    IF SQLERRM ILIKE '%open shift%' OR SQLERRM ILIKE '%cash movements require%' THEN
      RETURN 'shift_required';
    END IF;
    IF SQLERRM ILIKE '%pos_cash_one_sale_per_transaction%' THEN
      RETURN 'duplicate_sale';
    END IF;
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.pos_record_verified_cash_sale(pos_id, pos_id, jsonb, jsonb) IS
  'TF-01: insert cash_sale movement and verified cash payment in one database transaction. Failure after movement rolls back expected-cash side effects. service_role only.';

REVOKE ALL ON FUNCTION public.pos_record_verified_cash_sale(pos_id, pos_id, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_record_verified_cash_sale(pos_id, pos_id, jsonb, jsonb)
  TO service_role;

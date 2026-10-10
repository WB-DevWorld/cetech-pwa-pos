-- R-F4-01: enforce tender family at cash/payment write boundary (covers legacy writers).
-- R-F4-03: authenticated shift open requires durable active access.
-- R-F4-04: narrow pos_record_verified_cash_sale conflict/replay acceptance.
-- Additive. Proposed only — do not hosted-apply with this source batch.

CREATE OR REPLACE FUNCTION public.pos_claim_or_require_tender_family(
  p_transaction_id uuid,
  p_organization_id text,
  p_location_id text,
  p_family text,
  p_actor_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing text;
BEGIN
  IF p_transaction_id IS NULL THEN
    RETURN;
  END IF;
  IF p_family IS DISTINCT FROM 'cash' AND p_family IS DISTINCT FROM 'electronic' THEN
    RAISE EXCEPTION 'invalid tender family' USING ERRCODE = '23514';
  END IF;
  IF p_organization_id IS NULL OR p_location_id IS NULL THEN
    RAISE EXCEPTION 'tender claim requires organization and location' USING ERRCODE = '23514';
  END IF;

  SELECT tender_family INTO existing
  FROM public.pos_sale_tender_claims
  WHERE transaction_id = p_transaction_id
  FOR UPDATE;

  IF FOUND THEN
    IF existing IS DISTINCT FROM p_family THEN
      RAISE EXCEPTION 'sale tender family conflict: held % requested %', existing, p_family
        USING ERRCODE = '23514';
    END IF;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.pos_sale_tender_claims (
      transaction_id, organization_id, location_id, tender_family, actor_id
    ) VALUES (
      p_transaction_id,
      p_organization_id::public.pos_id,
      p_location_id::public.pos_id,
      p_family,
      COALESCE(NULLIF(btrim(p_actor_id), ''), 'system')::public.pos_id
    );
  EXCEPTION
    WHEN unique_violation THEN
      SELECT tender_family INTO existing
      FROM public.pos_sale_tender_claims
      WHERE transaction_id = p_transaction_id;
      IF existing IS DISTINCT FROM p_family THEN
        RAISE EXCEPTION 'sale tender family conflict: held % requested %', existing, p_family
          USING ERRCODE = '23514';
      END IF;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_claim_or_require_tender_family(uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_claim_or_require_tender_family(uuid, text, text, text, text)
  TO service_role;

COMMENT ON FUNCTION public.pos_claim_or_require_tender_family(uuid, text, text, text, text) IS
  'R-F4-01: acquire or validate one tender family per transaction at the database write boundary. Legacy writers that skip app-level claimSaleTender still cannot create opposite-family effects.';

CREATE OR REPLACE FUNCTION public.pos_cash_tender_family_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.kind = 'cash_sale' AND NEW.transaction_id IS NOT NULL THEN
    PERFORM public.pos_claim_or_require_tender_family(
      NEW.transaction_id,
      NEW.organization_id::text,
      NEW.location_id::text,
      'cash',
      NEW.actor_id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pos_cash_tender_family_guard ON public.pos_cash_movements;
CREATE TRIGGER pos_cash_tender_family_guard
  BEFORE INSERT ON public.pos_cash_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.pos_cash_tender_family_guard();

CREATE OR REPLACE FUNCTION public.pos_checkout_payment_tender_family_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  family text;
BEGIN
  family := CASE
    WHEN NEW.tender = 'cash' THEN 'cash'
    ELSE 'electronic'
  END;
  PERFORM public.pos_claim_or_require_tender_family(
    NEW.transaction_id,
    NEW.organization_id::text,
    NEW.location_id::text,
    family,
    NEW.actor_id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pos_checkout_payment_tender_family_guard ON public.pos_checkout_payments;
CREATE TRIGGER pos_checkout_payment_tender_family_guard
  BEFORE INSERT ON public.pos_checkout_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.pos_checkout_payment_tender_family_guard();

-- R-F4-03: disabled durable access cannot open shifts via authenticated JWT.
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
    IF NOT public.pos_actor_access_is_active(NEW.organization_id::text, NEW.cashier_id::text) THEN
      RAISE EXCEPTION 'actor is disabled' USING ERRCODE = '42501';
    END IF;
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

-- R-F4-04: narrow replay acceptance on unique conflicts.
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
  v_existing public.pos_cash_movements%ROWTYPE;
  v_existing_payment public.pos_checkout_payments%ROWTYPE;
  v_payment_id uuid;
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

  v_payment_id := (p_payment->>'payment_id')::uuid;
  v_transaction_id := (p_payment->>'transaction_id')::uuid;

  PERFORM public.pos_claim_or_require_tender_family(
    v_transaction_id,
    p_organization_id::text,
    p_location_id::text,
    'cash',
    COALESCE(p_payment->>'actor_id', '')
  );

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
        SELECT * INTO v_existing
        FROM public.pos_cash_movements
        WHERE id = v_movement_id
           OR (
             kind = 'cash_sale'
             AND transaction_id = v_transaction_id
             AND organization_id = p_organization_id
           )
        ORDER BY CASE WHEN id = v_movement_id THEN 0 ELSE 1 END
        LIMIT 1;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'cash movement conflict without canonical row' USING ERRCODE = '55000';
        END IF;
        IF v_existing.kind IS DISTINCT FROM 'cash_sale'
           OR v_existing.transaction_id IS DISTINCT FROM v_transaction_id
           OR v_existing.organization_id IS DISTINCT FROM p_organization_id
           OR v_existing.location_id IS DISTINCT FROM p_location_id
           OR v_existing.shift_id IS DISTINCT FROM v_shift_id
           OR v_existing.signed_amount_minor IS DISTINCT FROM v_signed_minor
           OR v_existing.currency::text IS DISTINCT FROM v_currency THEN
          RAISE EXCEPTION 'cash movement conflict is not a canonical cash-sale replay'
            USING ERRCODE = '23514';
        END IF;
        IF v_existing.id IS DISTINCT FROM v_movement_id THEN
          -- Same-transaction canonical sale already durable under another movement id.
          NULL;
        END IF;
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
    v_payment_id,
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

  SELECT * INTO v_existing_payment
  FROM public.pos_checkout_payments
  WHERE payment_id = v_payment_id;

  IF NOT FOUND THEN
    SELECT * INTO v_existing_payment
    FROM public.pos_checkout_payments
    WHERE transaction_id = (p_payment->>'transaction_id')::uuid
      AND tender = 'cash'
      AND status = 'verified'
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verified cash payment was not retained' USING ERRCODE = '55000';
  END IF;

  IF v_existing_payment.tender IS DISTINCT FROM 'cash'
     OR v_existing_payment.status IS DISTINCT FROM 'verified'
     OR v_existing_payment.transaction_id IS DISTINCT FROM (p_payment->>'transaction_id')::uuid
     OR v_existing_payment.organization_id IS DISTINCT FROM p_organization_id
     OR v_existing_payment.location_id IS DISTINCT FROM p_location_id
     OR v_existing_payment.sale_id IS DISTINCT FROM (p_payment->>'sale_id')::public.pos_id
     OR v_existing_payment.amount_minor IS DISTINCT FROM (p_payment->>'amount_minor')::bigint
     OR v_existing_payment.amount_currency::text IS DISTINCT FROM (p_payment->>'amount_currency') THEN
    RAISE EXCEPTION 'verified cash payment conflict is not a canonical replay' USING ERRCODE = '23514';
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
    IF SQLERRM ILIKE '%sale tender family conflict%' THEN
      RAISE;
    END IF;
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.pos_record_verified_cash_sale(pos_id, pos_id, jsonb, jsonb) IS
  'TF-01/R-F4: atomic cash_sale + verified cash payment with write-boundary tender claim and strict conflict replay validation. service_role only.';
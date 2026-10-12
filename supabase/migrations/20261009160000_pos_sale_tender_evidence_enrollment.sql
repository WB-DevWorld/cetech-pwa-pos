-- Gate1: adopt retained cash/payment tender evidence before first claim insert.
-- Additive follow-on to 20261009150000. Proposed only; do not hosted-apply in this source batch.

CREATE OR REPLACE FUNCTION public.pos_infer_sale_tender_evidence(p_transaction_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  has_cash boolean := false;
  has_electronic boolean := false;
BEGIN
  IF p_transaction_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    EXISTS (
      SELECT 1 FROM public.pos_cash_movements m
      WHERE m.transaction_id = p_transaction_id AND m.kind = 'cash_sale'
    )
    OR EXISTS (
      SELECT 1 FROM public.pos_checkout_payments p
      WHERE p.transaction_id = p_transaction_id AND p.tender = 'cash'
    )
  INTO has_cash;

  SELECT EXISTS (
    SELECT 1
    FROM public.pos_checkout_payments p
    WHERE p.transaction_id = p_transaction_id
      AND p.tender IN ('card', 'mobile_money', 'external_electronic')
      AND p.status IS DISTINCT FROM 'cancelled'
      AND p.status IS DISTINCT FROM 'failed'
  ) INTO has_electronic;

  IF has_cash AND has_electronic THEN
    RAISE EXCEPTION 'sale tender evidence conflict: cash and electronic both retained'
      USING ERRCODE = '23514';
  END IF;
  IF has_cash THEN
    RETURN 'cash';
  END IF;
  IF has_electronic THEN
    RETURN 'electronic';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_infer_sale_tender_evidence(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_infer_sale_tender_evidence(uuid) TO service_role;

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
  evidence text;
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

  PERFORM 1 FROM public.pos_checkout_payments
  WHERE transaction_id = p_transaction_id
  FOR UPDATE;
  PERFORM 1 FROM public.pos_cash_movements
  WHERE transaction_id = p_transaction_id AND kind = 'cash_sale'
  FOR UPDATE;

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

  evidence := public.pos_infer_sale_tender_evidence(p_transaction_id);
  IF evidence IS NOT NULL AND evidence IS DISTINCT FROM p_family THEN
    RAISE EXCEPTION 'sale tender family conflict: held % requested %', evidence, p_family
      USING ERRCODE = '23514';
  END IF;

  BEGIN
    INSERT INTO public.pos_sale_tender_claims (
      transaction_id, organization_id, location_id, tender_family, actor_id
    ) VALUES (
      p_transaction_id,
      p_organization_id::public.pos_id,
      p_location_id::public.pos_id,
      COALESCE(evidence, p_family),
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

COMMENT ON FUNCTION public.pos_claim_or_require_tender_family(uuid, text, text, text, text) IS
  'Acquire or validate one tender family per transaction. Adopts retained cash_sale/payment evidence before the first claim so migration-window legacy writers cannot enroll the opposite family.';

INSERT INTO public.pos_sale_tender_claims (
  transaction_id, organization_id, location_id, tender_family, actor_id
)
SELECT
  p.transaction_id,
  p.organization_id,
  p.location_id,
  CASE WHEN p.tender = 'cash' THEN 'cash' ELSE 'electronic' END,
  p.actor_id
FROM public.pos_checkout_payments p
WHERE p.status IS DISTINCT FROM 'cancelled'
  AND p.status IS DISTINCT FROM 'failed'
  AND NOT EXISTS (
    SELECT 1 FROM public.pos_sale_tender_claims c WHERE c.transaction_id = p.transaction_id
  )
ON CONFLICT (transaction_id) DO NOTHING;

INSERT INTO public.pos_sale_tender_claims (
  transaction_id, organization_id, location_id, tender_family, actor_id
)
SELECT
  m.transaction_id,
  m.organization_id,
  m.location_id,
  'cash',
  m.actor_id
FROM public.pos_cash_movements m
WHERE m.kind = 'cash_sale'
  AND m.transaction_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.pos_sale_tender_claims c WHERE c.transaction_id = m.transaction_id
  )
ON CONFLICT (transaction_id) DO NOTHING;
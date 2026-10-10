-- DB-SEC-02 / DB-SEC-03: close direct authenticated cash authorization gaps.
-- Proposed additive migration. Apply to disposable/local first; do NOT bulk-push to hosted.
-- DB-SEC-02: authenticated clients must not insert kind=correction (fabricated approval bypass).
--            Audited corrections remain via SECURITY DEFINER pos_admin_reverse_cash_movement.
-- DB-SEC-03: durable POS disablement must deny authenticated cash ledger writes even with a live Auth JWT.

CREATE OR REPLACE FUNCTION public.pos_actor_access_is_active(p_org text, p_actor text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.pos_staff_access_controls access
    WHERE access.organization_id = p_org
      AND access.actor_id = p_actor
      AND access.status = 'disabled'
  );
$$;

REVOKE ALL ON FUNCTION public.pos_actor_access_is_active(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_actor_access_is_active(text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.pos_actor_access_is_active(text, text) IS
  'SECURITY DEFINER boolean: true unless a durable pos_staff_access_controls row marks the actor disabled. Missing row means active. Does not grant table SELECT to callers.';

CREATE OR REPLACE FUNCTION public.pos_cash_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  sh public.pos_shifts%ROWTYPE;
  orig public.pos_cash_movements%ROWTYPE;
  trusted_infrastructure boolean;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'cash movements are append-only' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO STRICT sh FROM public.pos_shifts WHERE id = NEW.shift_id;

  IF sh.status <> 'open' THEN
    RAISE EXCEPTION 'cash movements require an open shift' USING ERRCODE = '55000';
  END IF;

  NEW.organization_id := sh.organization_id;
  NEW.location_id := sh.location_id;
  NEW.register_id := sh.register_id;

  IF NEW.currency IS DISTINCT FROM sh.opening_float_currency THEN
    RAISE EXCEPTION 'cash movement currency must match shift' USING ERRCODE = '23514';
  END IF;
  NEW.currency := sh.opening_float_currency;

  IF current_user = 'authenticated' THEN
    -- DB-SEC-02: corrections are service/admin-RPC only; fabricated approval_id must not pass.
    IF NEW.kind NOT IN ('pay_in', 'pay_out', 'cash_pickup') THEN
      RAISE EXCEPTION 'internal cash ledger kinds cannot be inserted by authenticated clients'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.reason IS NULL OR char_length(btrim(NEW.reason)) < 1 THEN
      RAISE EXCEPTION 'cash movement reason is required' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.kind = 'correction' THEN
    IF NEW.approval_id IS NULL THEN
      RAISE EXCEPTION 'cash correction requires approval' USING ERRCODE = '23514';
    END IF;
    IF NEW.corrects_movement_id IS NULL THEN
      RAISE EXCEPTION 'cash correction requires original movement' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO orig FROM public.pos_cash_movements WHERE id = NEW.corrects_movement_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'correction target not found' USING ERRCODE = '23503';
    END IF;
    IF orig.kind = 'correction' THEN
      RAISE EXCEPTION 'correction of a correction is not permitted' USING ERRCODE = '23514';
    END IF;
    IF orig.organization_id IS DISTINCT FROM sh.organization_id
       OR orig.location_id IS DISTINCT FROM sh.location_id
       OR orig.register_id IS DISTINCT FROM sh.register_id
       OR orig.shift_id IS DISTINCT FROM NEW.shift_id THEN
      RAISE EXCEPTION 'correction target is out of shift scope' USING ERRCODE = '23514';
    END IF;
    IF orig.currency IS DISTINCT FROM sh.opening_float_currency THEN
      RAISE EXCEPTION 'correction currency must match original movement' USING ERRCODE = '23514';
    END IF;
    IF NEW.signed_amount_minor IS DISTINCT FROM (- orig.signed_amount_minor) THEN
      RAISE EXCEPTION 'correction must exactly reverse the original movement' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.kind = 'opening_float' THEN
    IF NEW.signed_amount_minor IS DISTINCT FROM sh.opening_float_minor
       OR sh.expected_cash_minor IS DISTINCT FROM sh.opening_float_minor THEN
      RAISE EXCEPTION 'opening float must match shift expected cash exactly once'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  trusted_infrastructure := current_user IN ('postgres', 'supabase_admin', 'service_role');
  NEW.actor_id := COALESCE(pos_current_actor_id(), NEW.actor_id);
  IF pos_current_actor_id() IS NOT NULL THEN
    NEW.actor_id := pos_current_actor_id();
  ELSIF NOT trusted_infrastructure OR NEW.actor_id IS NULL THEN
    RAISE EXCEPTION 'actor is not authorized' USING ERRCODE = '42501';
  END IF;
  NEW.created_at := now();
  IF current_user = 'authenticated' THEN
    IF pos_current_organization_id() IS DISTINCT FROM NEW.organization_id
       OR NOT (NEW.location_id = ANY (pos_current_location_ids()))
       OR NOT pos_has_location_assignment(NEW.organization_id, NEW.location_id, NEW.actor_id)
       OR NOT pos_has_register_assignment(NEW.register_id, NEW.actor_id)
       OR (
         pos_current_register_id() IS NOT NULL
         AND pos_current_register_id() IS DISTINCT FROM NEW.register_id
       ) THEN
      RAISE EXCEPTION 'actor is not authorized' USING ERRCODE = '42501';
    END IF;
    -- DB-SEC-03: durable disablement closes direct Auth JWT cash writes.
    IF NOT public.pos_actor_access_is_active(NEW.organization_id::text, NEW.actor_id::text) THEN
      RAISE EXCEPTION 'actor is disabled' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.pos_cash_before_write() IS
  'Append-only cash ledger guard. Authenticated clients may insert pay_in/pay_out/cash_pickup only when assignment and active access hold; corrections require service/admin RPC.';
-- Forward migration. The #105 control-plane migration is already applied on
-- shared staging, so location lifecycle and topology saves are added here
-- rather than by rewriting 20260922123000. Production is untouched.
-- Do not physically delete locations, registers, or devices.

ALTER TABLE public.pos_locations
  ADD COLUMN status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'inactive'));

CREATE OR REPLACE FUNCTION public.pos_admin_save_location(
  p_organization_id text,
  p_location_id text,
  p_name text,
  p_status text,
  p_actor_id text,
  p_correlation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_location_id text;
  existing public.pos_locations%ROWTYPE;
  saved public.pos_locations%ROWTYPE;
BEGIN
  IF p_organization_id IS NULL OR p_actor_id IS NULL OR p_name IS NULL THEN
    RAISE EXCEPTION 'organization, actor, and name are required' USING ERRCODE = '23502';
  END IF;
  IF char_length(btrim(p_name)) < 1 OR char_length(btrim(p_name)) > 128 THEN
    RAISE EXCEPTION 'location name is invalid' USING ERRCODE = '23514';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'location status is invalid' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pos_organizations WHERE id = p_organization_id) THEN
    RAISE EXCEPTION 'organization was not found' USING ERRCODE = '23503';
  END IF;

  v_location_id := NULLIF(btrim(COALESCE(p_location_id, '')), '');
  IF v_location_id IS NULL THEN
    v_location_id := 'loc_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24);
  END IF;

  SELECT * INTO existing
  FROM public.pos_locations
  WHERE id = v_location_id
  FOR UPDATE;

  IF FOUND THEN
    IF existing.organization_id <> p_organization_id THEN
      RAISE EXCEPTION 'location is outside the organization' USING ERRCODE = '23503';
    END IF;
    UPDATE public.pos_locations
    SET name = btrim(p_name), status = p_status
    WHERE id = v_location_id
    RETURNING * INTO saved;
  ELSE
    INSERT INTO public.pos_locations (id, organization_id, name, status)
    VALUES (v_location_id, p_organization_id, btrim(p_name), p_status)
    RETURNING * INTO saved;
  END IF;

  INSERT INTO public.pos_admin_audit_events (
    organization_id, actor_id, action, target_type, target_id, location_id,
    before_state, after_state, correlation_id
  ) VALUES (
    p_organization_id, p_actor_id, 'location.save', 'location', saved.id, saved.id,
    CASE WHEN existing.id IS NULL THEN NULL ELSE to_jsonb(existing) END,
    to_jsonb(saved),
    p_correlation_id
  );

  RETURN jsonb_build_object('id', saved.id, 'name', saved.name, 'status', saved.status);
END;
$$;

REVOKE ALL ON FUNCTION public.pos_admin_save_location(text, text, text, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_admin_save_location(text, text, text, text, text, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.pos_admin_save_register(
  p_organization_id text,
  p_register_id text,
  p_location_id text,
  p_name text,
  p_currency text,
  p_status text,
  p_actor_id text,
  p_correlation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_register_id text;
  existing public.pos_registers%ROWTYPE;
  saved public.pos_registers%ROWTYPE;
BEGIN
  IF p_organization_id IS NULL OR p_location_id IS NULL OR p_actor_id IS NULL OR p_name IS NULL THEN
    RAISE EXCEPTION 'organization, location, actor, and name are required' USING ERRCODE = '23502';
  END IF;
  IF char_length(btrim(p_name)) < 1 OR char_length(btrim(p_name)) > 128 THEN
    RAISE EXCEPTION 'register name is invalid' USING ERRCODE = '23514';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('active', 'disabled', 'maintenance') THEN
    RAISE EXCEPTION 'register status is invalid' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.pos_locations
    WHERE id = p_location_id AND organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'location is outside the organization' USING ERRCODE = '23503';
  END IF;

  v_register_id := NULLIF(btrim(COALESCE(p_register_id, '')), '');
  IF v_register_id IS NULL THEN
    IF p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' THEN
      RAISE EXCEPTION 'register currency is required when creating a register' USING ERRCODE = '23514';
    END IF;
    v_register_id := 'reg_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24);
    INSERT INTO public.pos_registers (
      id, organization_id, location_id, name, currency, status
    ) VALUES (
      v_register_id, p_organization_id, p_location_id, btrim(p_name), p_currency, p_status
    )
    RETURNING * INTO saved;
  ELSE
    SELECT * INTO existing
    FROM public.pos_registers
    WHERE id = v_register_id
    FOR UPDATE;
    IF NOT FOUND OR existing.organization_id <> p_organization_id THEN
      RAISE EXCEPTION 'register is outside the organization' USING ERRCODE = '23503';
    END IF;
    IF existing.location_id <> p_location_id THEN
      RAISE EXCEPTION 'register location cannot change after creation' USING ERRCODE = '23514';
    END IF;
    IF p_currency IS NOT NULL AND p_currency <> existing.currency THEN
      RAISE EXCEPTION 'register currency cannot change after creation' USING ERRCODE = '23514';
    END IF;
    UPDATE public.pos_registers
    SET name = btrim(p_name), status = p_status
    WHERE id = v_register_id
    RETURNING * INTO saved;
  END IF;

  INSERT INTO public.pos_admin_audit_events (
    organization_id, actor_id, action, target_type, target_id, location_id, register_id,
    before_state, after_state, correlation_id
  ) VALUES (
    p_organization_id, p_actor_id, 'register.save', 'register', saved.id, saved.location_id, saved.id,
    CASE WHEN existing.id IS NULL THEN NULL ELSE to_jsonb(existing) END,
    to_jsonb(saved),
    p_correlation_id
  );

  RETURN jsonb_build_object(
    'id', saved.id,
    'locationId', saved.location_id,
    'name', saved.name,
    'currency', saved.currency,
    'status', saved.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pos_admin_save_register(text, text, text, text, text, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_admin_save_register(text, text, text, text, text, text, text, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.pos_admin_save_device(
  p_organization_id text,
  p_device_id uuid,
  p_location_id text,
  p_label text,
  p_status text,
  p_actor_id text,
  p_correlation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_device_id uuid;
  existing public.pos_devices%ROWTYPE;
  saved public.pos_devices%ROWTYPE;
BEGIN
  IF p_organization_id IS NULL OR p_location_id IS NULL OR p_actor_id IS NULL OR p_label IS NULL THEN
    RAISE EXCEPTION 'organization, location, actor, and label are required' USING ERRCODE = '23502';
  END IF;
  IF char_length(btrim(p_label)) < 1 OR char_length(btrim(p_label)) > 128 THEN
    RAISE EXCEPTION 'device label is invalid' USING ERRCODE = '23514';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'device status is invalid' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.pos_locations
    WHERE id = p_location_id AND organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'location is outside the organization' USING ERRCODE = '23503';
  END IF;

  v_device_id := p_device_id;
  IF v_device_id IS NULL THEN
    INSERT INTO public.pos_devices (organization_id, location_id, label, status)
    VALUES (p_organization_id, p_location_id, btrim(p_label), p_status)
    RETURNING * INTO saved;
  ELSE
    SELECT * INTO existing
    FROM public.pos_devices
    WHERE id = v_device_id
    FOR UPDATE;
    IF NOT FOUND OR existing.organization_id <> p_organization_id THEN
      RAISE EXCEPTION 'device is outside the organization' USING ERRCODE = '23503';
    END IF;
    UPDATE public.pos_devices
    SET location_id = p_location_id, label = btrim(p_label), status = p_status
    WHERE id = v_device_id
    RETURNING * INTO saved;
  END IF;

  INSERT INTO public.pos_admin_audit_events (
    organization_id, actor_id, action, target_type, target_id, location_id,
    before_state, after_state, correlation_id
  ) VALUES (
    p_organization_id, p_actor_id, 'device.save', 'device', saved.id::text, saved.location_id,
    CASE WHEN existing.id IS NULL THEN NULL ELSE to_jsonb(existing) END,
    to_jsonb(saved),
    p_correlation_id
  );

  RETURN jsonb_build_object(
    'id', saved.id,
    'locationId', saved.location_id,
    'label', saved.label,
    'status', saved.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pos_admin_save_device(text, uuid, text, text, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_admin_save_device(text, uuid, text, text, text, text, uuid)
  TO service_role;

COMMENT ON FUNCTION public.pos_admin_save_location(text, text, text, text, text, uuid) IS
  'Owner/Admin location create or rename/deactivate. No physical delete. BFF checks authority before service_role invocation.';
COMMENT ON FUNCTION public.pos_admin_save_register(text, text, text, text, text, text, text, uuid) IS
  'Owner/Admin register create or rename/status change. Currency and location stay fixed after creation.';
COMMENT ON FUNCTION public.pos_admin_save_device(text, uuid, text, text, text, text, uuid) IS
  'Owner/Admin device create, relabel, location reassignment, or deactivate. Devices stay location-scoped.';

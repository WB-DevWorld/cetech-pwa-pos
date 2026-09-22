-- ADMIN-105 organization control plane, configurable operational policy and audit.
-- POS operational truth only. Does not alter Woo commerce truth.
-- Browser roles/capabilities are never authority; trusted-server adapters own mutations.

CREATE TABLE pos_organization_memberships (
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  actor_id pos_id NOT NULL,
  control_role text NOT NULL CHECK (control_role IN ('owner', 'admin', 'support')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, actor_id)
);

COMMENT ON TABLE pos_organization_memberships IS
  'Organization-level POS control-plane authority. Separate from cashier/manager location assignments. Trusted-server write only.';

CREATE TABLE pos_operational_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  location_id pos_id,
  register_id pos_id,

  cashier_can_close_shift boolean,
  manager_can_close_shift boolean,
  cashier_own_shift_only boolean,
  manager_can_close_others_shift boolean,
  non_zero_variance_requires_manager boolean,
  variance_tolerance_minor pos_money_minor,
  variance_currency pos_currency,

  updated_by_actor_id pos_id NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pos_operational_policy_scope CHECK (
    (location_id IS NULL AND register_id IS NULL)
    OR (location_id IS NOT NULL AND register_id IS NULL)
    OR (location_id IS NOT NULL AND register_id IS NOT NULL)
  ),
  CONSTRAINT pos_operational_policy_location_org_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES pos_locations (id, organization_id),
  CONSTRAINT pos_operational_policy_register_scope_fk
    FOREIGN KEY (register_id, organization_id, location_id)
    REFERENCES pos_registers (id, organization_id, location_id),
  CONSTRAINT pos_operational_policy_variance_currency CHECK (
    (variance_tolerance_minor IS NULL AND variance_currency IS NULL)
    OR (variance_tolerance_minor IS NOT NULL AND variance_currency IS NOT NULL)
  )
);

CREATE UNIQUE INDEX pos_operational_policy_org_default_uq
  ON pos_operational_policies (organization_id)
  WHERE location_id IS NULL AND register_id IS NULL;

CREATE UNIQUE INDEX pos_operational_policy_location_uq
  ON pos_operational_policies (organization_id, location_id)
  WHERE location_id IS NOT NULL AND register_id IS NULL;

CREATE UNIQUE INDEX pos_operational_policy_register_uq
  ON pos_operational_policies (organization_id, location_id, register_id)
  WHERE register_id IS NOT NULL;

COMMENT ON TABLE pos_operational_policies IS
  'Inherited POS operational policy. NULL values inherit organization -> location -> register. Missing organization row uses ADR-017 compatibility defaults.';

CREATE TABLE pos_admin_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  actor_id pos_id NOT NULL,
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 96),
  target_type text NOT NULL CHECK (char_length(target_type) BETWEEN 1 AND 64),
  target_id text CHECK (target_id IS NULL OR char_length(target_id) BETWEEN 1 AND 128),
  location_id pos_id,
  register_id pos_id,
  before_state jsonb,
  after_state jsonb,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_admin_audit_location_org_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES pos_locations (id, organization_id),
  CONSTRAINT pos_admin_audit_register_scope_fk
    FOREIGN KEY (register_id, organization_id, location_id)
    REFERENCES pos_registers (id, organization_id, location_id)
);

COMMENT ON TABLE pos_admin_audit_events IS
  'Append-only control-plane audit trail. Records privilege, assignment and POS policy/configuration changes.';

CREATE OR REPLACE FUNCTION pos_admin_audit_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'admin audit events are append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER pos_admin_audit_immutable
  BEFORE UPDATE OR DELETE ON pos_admin_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION pos_admin_audit_immutable();

ALTER TABLE pos_organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_operational_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_admin_audit_events ENABLE ROW LEVEL SECURITY;

-- Control-plane data is BFF/server-owned during the transition.
-- service_role infrastructure access is not business authorization.
REVOKE ALL ON TABLE
  pos_organization_memberships,
  pos_operational_policies,
  pos_admin_audit_events
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE
  pos_organization_memberships,
  pos_operational_policies
TO service_role;

GRANT SELECT, INSERT ON TABLE pos_admin_audit_events TO service_role;

REVOKE ALL ON FUNCTION pos_admin_audit_immutable() FROM PUBLIC, anon, authenticated, service_role;

CREATE INDEX pos_organization_memberships_role_idx
  ON pos_organization_memberships (organization_id, control_role, status);

CREATE INDEX pos_admin_audit_org_created_idx
  ON pos_admin_audit_events (organization_id, created_at DESC);

CREATE INDEX pos_admin_audit_actor_created_idx
  ON pos_admin_audit_events (organization_id, actor_id, created_at DESC);


-- Atomic trusted-server policy mutation + audit. service_role invocation is
-- infrastructure access only; the BFF must authorize the actor first.
CREATE OR REPLACE FUNCTION pos_admin_set_operational_policy(
  p_organization_id text,
  p_location_id text,
  p_register_id text,
  p_actor_id text,
  p_correlation_id uuid,
  p_cashier_can_close_shift boolean,
  p_manager_can_close_shift boolean,
  p_cashier_own_shift_only boolean,
  p_manager_can_close_others_shift boolean,
  p_non_zero_variance_requires_manager boolean,
  p_variance_tolerance_minor bigint,
  p_variance_currency text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing public.pos_operational_policies%ROWTYPE;
  saved public.pos_operational_policies%ROWTYPE;
  before_json jsonb;
  after_json jsonb;
BEGIN
  IF p_organization_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'organization and actor are required' USING ERRCODE = '23502';
  END IF;

  IF p_register_id IS NOT NULL AND p_location_id IS NULL THEN
    RAISE EXCEPTION 'register policy requires location scope' USING ERRCODE = '23514';
  END IF;

  IF p_variance_tolerance_minor IS NULL AND p_variance_currency IS NOT NULL THEN
    RAISE EXCEPTION 'variance currency requires tolerance' USING ERRCODE = '23514';
  END IF;
  IF p_variance_tolerance_minor IS NOT NULL AND p_variance_currency IS NULL THEN
    RAISE EXCEPTION 'variance tolerance requires currency' USING ERRCODE = '23514';
  END IF;
  IF p_variance_tolerance_minor IS NOT NULL AND p_variance_tolerance_minor < 0 THEN
    RAISE EXCEPTION 'variance tolerance cannot be negative' USING ERRCODE = '23514';
  END IF;

  SELECT *
  INTO existing
  FROM public.pos_operational_policies
  WHERE organization_id = p_organization_id
    AND location_id IS NOT DISTINCT FROM p_location_id
    AND register_id IS NOT DISTINCT FROM p_register_id
  FOR UPDATE;

  IF FOUND THEN
    before_json := to_jsonb(existing);
    UPDATE public.pos_operational_policies
    SET cashier_can_close_shift = p_cashier_can_close_shift,
        manager_can_close_shift = p_manager_can_close_shift,
        cashier_own_shift_only = p_cashier_own_shift_only,
        manager_can_close_others_shift = p_manager_can_close_others_shift,
        non_zero_variance_requires_manager = p_non_zero_variance_requires_manager,
        variance_tolerance_minor = p_variance_tolerance_minor,
        variance_currency = p_variance_currency,
        updated_by_actor_id = p_actor_id,
        updated_at = now()
    WHERE id = existing.id
    RETURNING * INTO saved;
  ELSE
    INSERT INTO public.pos_operational_policies (
      organization_id,
      location_id,
      register_id,
      cashier_can_close_shift,
      manager_can_close_shift,
      cashier_own_shift_only,
      manager_can_close_others_shift,
      non_zero_variance_requires_manager,
      variance_tolerance_minor,
      variance_currency,
      updated_by_actor_id
    ) VALUES (
      p_organization_id,
      p_location_id,
      p_register_id,
      p_cashier_can_close_shift,
      p_manager_can_close_shift,
      p_cashier_own_shift_only,
      p_manager_can_close_others_shift,
      p_non_zero_variance_requires_manager,
      p_variance_tolerance_minor,
      p_variance_currency,
      p_actor_id
    )
    RETURNING * INTO saved;
    before_json := NULL;
  END IF;

  after_json := to_jsonb(saved);

  INSERT INTO public.pos_admin_audit_events (
    organization_id,
    actor_id,
    action,
    target_type,
    target_id,
    location_id,
    register_id,
    before_state,
    after_state,
    correlation_id
  ) VALUES (
    p_organization_id,
    p_actor_id,
    'operational_policy.set',
    'operational_policy',
    saved.id::text,
    p_location_id,
    p_register_id,
    before_json,
    after_json,
    p_correlation_id
  );

  RETURN after_json;
END;
$$;

REVOKE ALL ON FUNCTION pos_admin_set_operational_policy(
  text, text, text, text, uuid, boolean, boolean, boolean, boolean, boolean, bigint, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION pos_admin_set_operational_policy(
  text, text, text, text, uuid, boolean, boolean, boolean, boolean, boolean, bigint, text
) TO service_role;

COMMENT ON FUNCTION pos_admin_set_operational_policy(
  text, text, text, text, uuid, boolean, boolean, boolean, boolean, boolean, bigint, text
) IS
  'Atomic trusted-server operational-policy upsert plus append-only admin audit. Business authorization is required in the BFF before service_role invocation.';


-- Atomic staff operational assignment mutation + audit.
CREATE OR REPLACE FUNCTION pos_admin_set_staff_assignment(
  p_organization_id text,
  p_target_actor_id text,
  p_location_id text,
  p_role text,
  p_register_ids text[],
  p_actor_id text,
  p_correlation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  before_role text;
  before_register_ids text[];
  after_register_ids text[];
  expected_register_count integer;
  matched_register_count integer;
  before_json jsonb;
  after_json jsonb;
BEGIN
  IF p_organization_id IS NULL
     OR p_target_actor_id IS NULL
     OR p_location_id IS NULL
     OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'organization, target actor, location and actor are required'
      USING ERRCODE = '23502';
  END IF;

  IF p_role NOT IN ('cashier', 'manager') THEN
    RAISE EXCEPTION 'staff assignment role is invalid' USING ERRCODE = '23514';
  END IF;

  -- Serialize assignment edits at the location and prove tenant scope.
  PERFORM 1
  FROM public.pos_locations
  WHERE id = p_location_id
    AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'location is outside organization scope' USING ERRCODE = '23503';
  END IF;

  p_register_ids := COALESCE(p_register_ids, ARRAY[]::text[]);
  SELECT COUNT(DISTINCT value)
  INTO expected_register_count
  FROM unnest(p_register_ids) AS ids(value);

  SELECT COUNT(*)
  INTO matched_register_count
  FROM public.pos_registers
  WHERE organization_id = p_organization_id
    AND location_id = p_location_id
    AND id = ANY (p_register_ids);

  IF matched_register_count <> expected_register_count THEN
    RAISE EXCEPTION 'one or more registers are outside location scope' USING ERRCODE = '23514';
  END IF;

  SELECT role
  INTO before_role
  FROM public.pos_staff_location_assignments
  WHERE actor_id = p_target_actor_id
    AND organization_id = p_organization_id
    AND location_id = p_location_id;

  SELECT COALESCE(array_agg(register_id ORDER BY register_id), ARRAY[]::text[])
  INTO before_register_ids
  FROM public.pos_staff_register_assignments
  WHERE actor_id = p_target_actor_id
    AND organization_id = p_organization_id
    AND location_id = p_location_id;

  before_json := jsonb_build_object(
    'role', before_role,
    'registerIds', to_jsonb(COALESCE(before_register_ids, ARRAY[]::text[]))
  );

  INSERT INTO public.pos_staff_location_assignments (
    actor_id,
    organization_id,
    location_id,
    role
  ) VALUES (
    p_target_actor_id,
    p_organization_id,
    p_location_id,
    p_role
  )
  ON CONFLICT (actor_id, organization_id, location_id)
  DO UPDATE SET role = EXCLUDED.role;

  DELETE FROM public.pos_staff_register_assignments
  WHERE actor_id = p_target_actor_id
    AND organization_id = p_organization_id
    AND location_id = p_location_id;

  INSERT INTO public.pos_staff_register_assignments (
    actor_id,
    organization_id,
    location_id,
    register_id
  )
  SELECT
    p_target_actor_id,
    p_organization_id,
    p_location_id,
    value
  FROM (
    SELECT DISTINCT value
    FROM unnest(p_register_ids) AS ids(value)
  ) AS unique_ids;

  SELECT COALESCE(array_agg(register_id ORDER BY register_id), ARRAY[]::text[])
  INTO after_register_ids
  FROM public.pos_staff_register_assignments
  WHERE actor_id = p_target_actor_id
    AND organization_id = p_organization_id
    AND location_id = p_location_id;

  after_json := jsonb_build_object(
    'role', p_role,
    'registerIds', to_jsonb(COALESCE(after_register_ids, ARRAY[]::text[]))
  );

  INSERT INTO public.pos_admin_audit_events (
    organization_id,
    actor_id,
    action,
    target_type,
    target_id,
    location_id,
    before_state,
    after_state,
    correlation_id
  ) VALUES (
    p_organization_id,
    p_actor_id,
    'staff.assignment.set',
    'staff_assignment',
    p_target_actor_id,
    p_location_id,
    before_json,
    after_json,
    p_correlation_id
  );

  RETURN jsonb_build_object(
    'actorId', p_target_actor_id,
    'organizationId', p_organization_id,
    'locationId', p_location_id,
    'role', p_role,
    'registerIds', to_jsonb(COALESCE(after_register_ids, ARRAY[]::text[]))
  );
END;
$$;

REVOKE ALL ON FUNCTION pos_admin_set_staff_assignment(
  text, text, text, text, text[], text, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION pos_admin_set_staff_assignment(
  text, text, text, text, text[], text, uuid
) TO service_role;

COMMENT ON FUNCTION pos_admin_set_staff_assignment(
  text, text, text, text, text[], text, uuid
) IS
  'Atomic trusted-server staff location/register assignment update plus append-only admin audit. BFF owner/admin authorization is required before invocation.';

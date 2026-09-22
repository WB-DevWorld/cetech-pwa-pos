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

-- CORE-01 POS operational schema and RLS.
-- Provider-neutral. No Woo commerce masters. Training hostname is not encoded.

CREATE DOMAIN pos_id AS text
  CHECK (char_length(VALUE) BETWEEN 1 AND 128 AND VALUE ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$');

CREATE DOMAIN pos_currency AS char(3)
  CHECK (VALUE ~ '^[A-Z]{3}$');

CREATE DOMAIN pos_money_minor AS bigint
  CHECK (VALUE >= 0 AND VALUE <= 9007199254740991);

CREATE DOMAIN pos_signed_minor AS bigint
  CHECK (VALUE >= -9007199254740991 AND VALUE <= 9007199254740991);

CREATE OR REPLACE FUNCTION pos_jwt_claims()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

CREATE OR REPLACE FUNCTION pos_current_organization_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT pos_jwt_claims()->'app_metadata'->>'organization_id';
$$;

CREATE OR REPLACE FUNCTION pos_current_actor_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT pos_jwt_claims()->'app_metadata'->>'actor_id';
$$;

CREATE OR REPLACE FUNCTION pos_current_register_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT pos_jwt_claims()->'app_metadata'->>'register_id';
$$;

CREATE OR REPLACE FUNCTION pos_current_location_ids()
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(pos_jwt_claims()->'app_metadata'->'location_ids', '[]'::jsonb))),
    ARRAY[]::text[]
  );
$$;

COMMENT ON FUNCTION pos_jwt_claims() IS
  'JWT claims for RLS. service_role bypasses RLS and is not business authorization.';

CREATE TABLE pos_organizations (
  id pos_id PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 128),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pos_locations (
  id pos_id PRIMARY KEY,
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 128),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id)
);

CREATE INDEX pos_locations_org_idx ON pos_locations (organization_id);

CREATE TABLE pos_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  location_id pos_id NOT NULL REFERENCES pos_locations (id),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 128),
  status text NOT NULL CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_devices_location_org_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES pos_locations (id, organization_id)
);

CREATE TABLE pos_registers (
  id pos_id PRIMARY KEY,
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  location_id pos_id NOT NULL REFERENCES pos_locations (id),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 128),
  currency pos_currency NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'disabled', 'maintenance')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_registers_location_org_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES pos_locations (id, organization_id)
);

ALTER TABLE pos_registers
  ADD CONSTRAINT pos_registers_id_org_loc_unique UNIQUE (id, organization_id, location_id);

CREATE TABLE pos_staff_location_assignments (
  actor_id pos_id NOT NULL,
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  location_id pos_id NOT NULL REFERENCES pos_locations (id),
  role text NOT NULL CHECK (role IN ('cashier', 'manager')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, organization_id, location_id),
  CONSTRAINT pos_staff_loc_org_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES pos_locations (id, organization_id)
);

CREATE TABLE pos_staff_register_assignments (
  actor_id pos_id NOT NULL,
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  location_id pos_id NOT NULL REFERENCES pos_locations (id),
  register_id pos_id NOT NULL REFERENCES pos_registers (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, register_id),
  CONSTRAINT pos_staff_reg_fk
    FOREIGN KEY (register_id, organization_id, location_id)
    REFERENCES pos_registers (id, organization_id, location_id)
);

CREATE TABLE pos_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id pos_id NOT NULL,
  location_id pos_id NOT NULL,
  register_id pos_id NOT NULL,
  device_id uuid NOT NULL REFERENCES pos_devices (id),
  cashier_id pos_id NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'closing', 'closed', 'requires_attention')),
  opening_float_minor pos_money_minor NOT NULL,
  opening_float_currency pos_currency NOT NULL,
  expected_cash_minor pos_signed_minor NOT NULL,
  expected_cash_currency pos_currency NOT NULL,
  counted_cash_minor pos_money_minor,
  counted_cash_currency pos_currency,
  variance_minor pos_signed_minor,
  variance_currency pos_currency,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  z_report_id pos_id,
  CONSTRAINT pos_shifts_register_fk
    FOREIGN KEY (register_id, organization_id, location_id)
    REFERENCES pos_registers (id, organization_id, location_id),
  CONSTRAINT pos_shifts_currency_match CHECK (
    opening_float_currency = expected_cash_currency
  ),
  CONSTRAINT pos_shifts_close_integrity CHECK (
    (status IN ('open', 'closing') AND closed_at IS NULL AND counted_cash_minor IS NULL)
    OR (status IN ('closed', 'requires_attention'))
  )
);

CREATE UNIQUE INDEX pos_shifts_one_active_per_register
  ON pos_shifts (register_id)
  WHERE status IN ('open', 'closing');

CREATE INDEX pos_shifts_org_loc_idx ON pos_shifts (organization_id, location_id);

CREATE TABLE pos_cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id pos_id NOT NULL,
  location_id pos_id NOT NULL,
  register_id pos_id NOT NULL,
  shift_id uuid NOT NULL REFERENCES pos_shifts (id),
  kind text NOT NULL CHECK (kind IN (
    'opening_float', 'cash_sale', 'cash_refund', 'pay_in', 'pay_out', 'cash_pickup', 'correction'
  )),
  signed_amount_minor pos_signed_minor NOT NULL,
  currency pos_currency NOT NULL,
  actor_id pos_id NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  transaction_id uuid,
  reason text,
  corrects_movement_id uuid REFERENCES pos_cash_movements (id),
  approval_id uuid,
  idempotency_key uuid,
  CONSTRAINT pos_cash_non_zero CHECK (signed_amount_minor <> 0),
  CONSTRAINT pos_cash_kind_sign CHECK (
    (kind IN ('cash_sale', 'pay_in') AND signed_amount_minor > 0)
    OR (kind IN ('opening_float') AND signed_amount_minor > 0)
    OR (kind IN ('cash_refund', 'pay_out', 'cash_pickup') AND signed_amount_minor < 0)
    OR (kind = 'correction')
  ),
  CONSTRAINT pos_cash_correction_ref CHECK (
    (kind = 'correction' AND corrects_movement_id IS NOT NULL)
    OR (kind <> 'correction' AND corrects_movement_id IS NULL)
  )
);

CREATE UNIQUE INDEX pos_cash_idempotency_idx
  ON pos_cash_movements (shift_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX pos_cash_shift_idx ON pos_cash_movements (shift_id);

CREATE TABLE pos_pending_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  location_id pos_id NOT NULL REFERENCES pos_locations (id),
  register_id pos_id,
  shift_id uuid REFERENCES pos_shifts (id),
  transaction_id uuid,
  operation text NOT NULL CHECK (operation IN (
    'sale.prepare', 'sale.finalize', 'sale.cancel',
    'payment.initialize', 'payment.cash', 'payment.resolve',
    'shift.open', 'shift.close', 'cash.movement', 'refund.resolve'
  )),
  idempotency_key uuid NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  payload_version text NOT NULL DEFAULT '1.0.0' CHECK (payload_version = '1.0.0'),
  status text NOT NULL CHECK (status IN (
    'pending', 'sent', 'response_unknown', 'acknowledged', 'requires_attention'
  )),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  last_error_code text,
  CONSTRAINT pos_pending_idempotency UNIQUE (organization_id, idempotency_key),
  CONSTRAINT pos_pending_loc_org_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES pos_locations (id, organization_id)
);

CREATE TABLE pos_outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  location_id pos_id REFERENCES pos_locations (id),
  aggregate_type text NOT NULL CHECK (char_length(aggregate_type) BETWEEN 1 AND 64),
  aggregate_id text NOT NULL CHECK (char_length(aggregate_id) BETWEEN 1 AND 128),
  event_type text NOT NULL CHECK (char_length(event_type) BETWEEN 1 AND 64),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_version text NOT NULL DEFAULT '1.0.0',
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  publish_state text NOT NULL DEFAULT 'pending' CHECK (publish_state IN (
    'pending', 'publishing', 'published', 'failed'
  )),
  correlation_id uuid,
  causation_id uuid
);

COMMENT ON TABLE pos_outbox_events IS
  'Transactional outbox for later publication. Not business truth. Not Woo order master.';

CREATE TABLE pos_integration_watermarks (
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  source_id text NOT NULL CHECK (source_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'),
  watermark text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, source_id)
);

COMMENT ON TABLE pos_integration_watermarks IS
  'Rebuildable sync cursors. Provider id is configuration, not a hostname hard-code.';

CREATE OR REPLACE FUNCTION pos_has_location_assignment(p_org text, p_loc text, p_actor text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pos_staff_location_assignments s
    WHERE s.organization_id = p_org
      AND s.location_id = p_loc
      AND s.actor_id = p_actor
  );
$$;

CREATE OR REPLACE FUNCTION pos_has_register_assignment(p_register text, p_actor text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pos_staff_register_assignments s
    WHERE s.register_id = p_register
      AND s.actor_id = p_actor
  );
$$;

CREATE OR REPLACE FUNCTION pos_shift_before_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  reg pos_registers%ROWTYPE;
  dev pos_devices%ROWTYPE;
BEGIN
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
  IF pos_current_actor_id() IS NOT NULL THEN
    NEW.cashier_id := pos_current_actor_id();
  ELSIF current_user NOT IN ('postgres', 'supabase_admin') OR NEW.cashier_id IS NULL THEN
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

CREATE TRIGGER pos_shift_before_insert
  BEFORE INSERT ON pos_shifts
  FOR EACH ROW
  EXECUTE FUNCTION pos_shift_before_insert();

CREATE OR REPLACE FUNCTION pos_shift_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.opening_float_minor <> 0 THEN
    INSERT INTO pos_cash_movements (
      organization_id, location_id, register_id, shift_id, kind,
      signed_amount_minor, currency, actor_id, reason
    ) VALUES (
      NEW.organization_id, NEW.location_id, NEW.register_id, NEW.id, 'opening_float',
      NEW.opening_float_minor, NEW.opening_float_currency, NEW.cashier_id, 'opening float'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pos_shift_after_insert
  AFTER INSERT ON pos_shifts
  FOR EACH ROW
  EXECUTE FUNCTION pos_shift_after_insert();

CREATE OR REPLACE FUNCTION pos_shift_before_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'closed' THEN
    RAISE EXCEPTION 'closed shifts are immutable' USING ERRCODE = '55000';
  END IF;
  NEW.id := OLD.id;
  NEW.organization_id := OLD.organization_id;
  NEW.location_id := OLD.location_id;
  NEW.register_id := OLD.register_id;
  NEW.device_id := OLD.device_id;
  NEW.cashier_id := OLD.cashier_id;
  NEW.opening_float_minor := OLD.opening_float_minor;
  NEW.opening_float_currency := OLD.opening_float_currency;
  NEW.opened_at := OLD.opened_at;
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
    IF NEW.counted_cash_minor IS NULL THEN
      RAISE EXCEPTION 'counted cash required to close' USING ERRCODE = '23502';
    END IF;
    NEW.counted_cash_currency := OLD.expected_cash_currency;
    NEW.variance_minor := NEW.counted_cash_minor - NEW.expected_cash_minor;
    NEW.variance_currency := OLD.expected_cash_currency;
    NEW.closed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pos_shift_before_update
  BEFORE UPDATE ON pos_shifts
  FOR EACH ROW
  EXECUTE FUNCTION pos_shift_before_update();

CREATE OR REPLACE FUNCTION pos_cash_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  sh pos_shifts%ROWTYPE;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'cash movements are append-only' USING ERRCODE = '55000';
  END IF;
  SELECT * INTO STRICT sh FROM pos_shifts WHERE id = NEW.shift_id;
  IF sh.status <> 'open' THEN
    RAISE EXCEPTION 'cash movements require an open shift' USING ERRCODE = '55000';
  END IF;
  NEW.organization_id := sh.organization_id;
  NEW.location_id := sh.location_id;
  NEW.register_id := sh.register_id;
  NEW.currency := sh.opening_float_currency;
  NEW.actor_id := COALESCE(pos_current_actor_id(), NEW.actor_id);
  IF pos_current_actor_id() IS NOT NULL THEN
    NEW.actor_id := pos_current_actor_id();
  ELSIF current_user NOT IN ('postgres', 'supabase_admin') OR NEW.actor_id IS NULL THEN
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
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pos_cash_before_write
  BEFORE INSERT OR UPDATE OR DELETE ON pos_cash_movements
  FOR EACH ROW
  EXECUTE FUNCTION pos_cash_before_write();

CREATE OR REPLACE FUNCTION pos_cash_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE pos_shifts
  SET expected_cash_minor = (
    SELECT COALESCE(SUM(signed_amount_minor), 0)::bigint
    FROM pos_cash_movements
    WHERE shift_id = NEW.shift_id
  )
  WHERE id = NEW.shift_id
    AND status IN ('open', 'closing');
  RETURN NEW;
END;
$$;

CREATE TRIGGER pos_cash_after_insert
  AFTER INSERT ON pos_cash_movements
  FOR EACH ROW
  EXECUTE FUNCTION pos_cash_after_insert();

CREATE OR REPLACE FUNCTION pos_pending_before_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.organization_id := COALESCE(pos_current_organization_id(), NEW.organization_id);
  IF NEW.location_id IS NULL OR NOT (NEW.location_id = ANY (pos_current_location_ids())) THEN
    IF pos_current_location_ids() IS NOT NULL AND array_length(pos_current_location_ids(), 1) > 0 THEN
      RAISE EXCEPTION 'location is not in actor scope' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pos_pending_before_insert
  BEFORE INSERT ON pos_pending_operations
  FOR EACH ROW
  EXECUTE FUNCTION pos_pending_before_insert();

CREATE OR REPLACE FUNCTION pos_close_shift(p_shift_id uuid, p_counted_minor bigint)
RETURNS pos_shifts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sh pos_shifts;
BEGIN
  SELECT * INTO sh FROM pos_shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shift not found' USING ERRCODE = 'P0002';
  END IF;
  IF sh.organization_id IS DISTINCT FROM pos_current_organization_id()
     OR NOT (sh.location_id = ANY (pos_current_location_ids()))
     OR NOT pos_has_location_assignment(sh.organization_id, sh.location_id, pos_current_actor_id())
     OR NOT pos_has_register_assignment(sh.register_id, pos_current_actor_id())
     OR (
       pos_current_register_id() IS NOT NULL
       AND pos_current_register_id() IS DISTINCT FROM sh.register_id
     ) THEN
    RAISE EXCEPTION 'actor is not authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE pos_shifts
  SET status = 'closed',
      counted_cash_minor = p_counted_minor
  WHERE id = p_shift_id
  RETURNING * INTO sh;
  RETURN sh;
END;
$$;

REVOKE ALL ON FUNCTION pos_close_shift(uuid, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pos_close_shift(uuid, bigint) TO authenticated;

ALTER TABLE pos_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_staff_location_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_staff_register_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_pending_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_integration_watermarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY pos_org_select ON pos_organizations
  FOR SELECT TO authenticated
  USING (id = pos_current_organization_id());

CREATE POLICY pos_loc_select ON pos_locations
  FOR SELECT TO authenticated
  USING (
    organization_id = pos_current_organization_id()
    AND id = ANY (pos_current_location_ids())
    AND pos_has_location_assignment(organization_id, id, pos_current_actor_id())
  );

CREATE POLICY pos_device_select ON pos_devices
  FOR SELECT TO authenticated
  USING (
    organization_id = pos_current_organization_id()
    AND location_id = ANY (pos_current_location_ids())
    AND pos_has_location_assignment(organization_id, location_id, pos_current_actor_id())
  );

CREATE POLICY pos_register_select ON pos_registers
  FOR SELECT TO authenticated
  USING (
    organization_id = pos_current_organization_id()
    AND location_id = ANY (pos_current_location_ids())
    AND pos_has_location_assignment(organization_id, location_id, pos_current_actor_id())
  );

CREATE POLICY pos_staff_loc_select ON pos_staff_location_assignments
  FOR SELECT TO authenticated
  USING (
    organization_id = pos_current_organization_id()
    AND location_id = ANY (pos_current_location_ids())
    AND actor_id = pos_current_actor_id()
  );

CREATE POLICY pos_staff_reg_select ON pos_staff_register_assignments
  FOR SELECT TO authenticated
  USING (
    organization_id = pos_current_organization_id()
    AND actor_id = pos_current_actor_id()
  );

CREATE POLICY pos_shift_select ON pos_shifts
  FOR SELECT TO authenticated
  USING (
    organization_id = pos_current_organization_id()
    AND location_id = ANY (pos_current_location_ids())
    AND pos_has_location_assignment(organization_id, location_id, pos_current_actor_id())
  );

CREATE POLICY pos_shift_insert ON pos_shifts
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = pos_current_organization_id()
    AND location_id = ANY (pos_current_location_ids())
    AND pos_has_location_assignment(organization_id, location_id, pos_current_actor_id())
    AND pos_has_register_assignment(register_id, pos_current_actor_id())
    AND (pos_current_register_id() IS NULL OR register_id = pos_current_register_id())
  );

CREATE POLICY pos_cash_select ON pos_cash_movements
  FOR SELECT TO authenticated
  USING (
    organization_id = pos_current_organization_id()
    AND location_id = ANY (pos_current_location_ids())
    AND pos_has_location_assignment(organization_id, location_id, pos_current_actor_id())
  );

CREATE POLICY pos_cash_insert ON pos_cash_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = pos_current_organization_id()
    AND location_id = ANY (pos_current_location_ids())
    AND pos_has_location_assignment(organization_id, location_id, pos_current_actor_id())
    AND pos_has_register_assignment(register_id, pos_current_actor_id())
    AND (pos_current_register_id() IS NULL OR register_id = pos_current_register_id())
  );

CREATE POLICY pos_pending_select ON pos_pending_operations
  FOR SELECT TO authenticated
  USING (
    organization_id = pos_current_organization_id()
    AND location_id = ANY (pos_current_location_ids())
    AND pos_has_location_assignment(organization_id, location_id, pos_current_actor_id())
  );

CREATE POLICY pos_pending_insert ON pos_pending_operations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = pos_current_organization_id()
    AND location_id = ANY (pos_current_location_ids())
    AND pos_has_location_assignment(organization_id, location_id, pos_current_actor_id())
  );

CREATE POLICY pos_outbox_select ON pos_outbox_events
  FOR SELECT TO authenticated
  USING (organization_id = pos_current_organization_id());

CREATE POLICY pos_outbox_insert ON pos_outbox_events
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = pos_current_organization_id());

CREATE POLICY pos_watermark_select ON pos_integration_watermarks
  FOR SELECT TO authenticated
  USING (organization_id = pos_current_organization_id());

REVOKE ALL ON TABLE pos_organizations, pos_locations, pos_devices, pos_registers,
  pos_staff_location_assignments, pos_staff_register_assignments, pos_shifts,
  pos_cash_movements, pos_pending_operations, pos_outbox_events,
  pos_integration_watermarks FROM PUBLIC, anon;

GRANT SELECT ON TABLE pos_organizations, pos_locations, pos_devices, pos_registers,
  pos_staff_location_assignments, pos_staff_register_assignments, pos_shifts,
  pos_cash_movements, pos_pending_operations, pos_outbox_events,
  pos_integration_watermarks TO authenticated;

GRANT INSERT ON TABLE pos_shifts, pos_cash_movements, pos_pending_operations, pos_outbox_events
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pos_organizations, pos_locations, pos_devices, pos_registers,
  pos_staff_location_assignments, pos_staff_register_assignments, pos_shifts,
  pos_cash_movements, pos_pending_operations, pos_outbox_events,
  pos_integration_watermarks TO service_role;

GRANT EXECUTE ON FUNCTION pos_close_shift(uuid, bigint) TO service_role;

COMMENT ON TABLE pos_organizations IS 'POS tenant scope. Not a Woo shop master.';
COMMENT ON TABLE pos_registers IS 'Server-owned register identity. Browser-chosen names are not authority.';
COMMENT ON TABLE pos_shifts IS 'Server-authoritative shift lifecycle. Expected cash is owned here.';
COMMENT ON TABLE pos_cash_movements IS 'Append-only cash ledger. Corrections are additional rows.';
COMMENT ON TABLE pos_pending_operations IS 'Durable operation lifecycle and idempotency. Status names match contract v1.0.0.';

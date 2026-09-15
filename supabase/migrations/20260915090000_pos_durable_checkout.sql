-- R6-REM-01: durable POS checkout snapshots and trusted-server shift/cash writes.
-- Additive. Not a Woo product/order/customer master. service_role is infrastructure
-- access for the BFF adapters, not cashier or browser authorization.

ALTER TABLE pos_pending_operations
  ADD COLUMN IF NOT EXISTS outcome jsonb;

COMMENT ON COLUMN pos_pending_operations.outcome IS
  'Acknowledged or requires_attention command outcome. Survives process loss. Not a second idempotency key.';

CREATE OR REPLACE FUNCTION pos_shift_before_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  reg pos_registers%ROWTYPE;
  dev pos_devices%ROWTYPE;
  trusted_infrastructure boolean;
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

COMMENT ON FUNCTION pos_shift_before_insert() IS
  'Opens shifts from register/device truth. Authenticated cashiers are JWT-scoped. service_role may insert only with an explicit cashier_id; that is infrastructure access, not a cashier JWT.';

CREATE OR REPLACE FUNCTION pos_cash_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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
    IF NEW.kind NOT IN ('pay_in', 'pay_out', 'cash_pickup', 'correction') THEN
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
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION pos_cash_before_write() IS
  'Validates cash authorization, currency, cashier kinds, reason, and correction semantics. service_role may insert internal kinds with an explicit actor_id. Expected-cash mutation is applied atomically in pos_cash_after_insert.';

CREATE TABLE pos_quote_snapshots (
  id pos_id PRIMARY KEY,
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  location_id pos_id NOT NULL,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_quote_snapshots_loc_org_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES pos_locations (id, organization_id)
);

CREATE INDEX pos_quote_snapshots_org_loc_idx
  ON pos_quote_snapshots (organization_id, location_id);

COMMENT ON TABLE pos_quote_snapshots IS
  'Authoritative POS quote snapshots for prepare. Not a Woo catalog or price master. Trusted-server write only.';

CREATE TABLE pos_checkout_sales (
  transaction_id uuid PRIMARY KEY,
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  location_id pos_id NOT NULL,
  register_id pos_id NOT NULL,
  shift_id uuid NOT NULL,
  sale_id pos_id NOT NULL,
  status text NOT NULL CHECK (status IN (
    'not_found', 'preparing', 'prepared', 'payment_pending', 'finalizing',
    'completed', 'cancelled', 'requires_attention'
  )),
  assigned_payment_id uuid,
  commercial_confirmed boolean NOT NULL DEFAULT false,
  record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_checkout_sales_loc_org_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES pos_locations (id, organization_id),
  CONSTRAINT pos_checkout_sales_register_fk
    FOREIGN KEY (register_id, organization_id, location_id)
    REFERENCES pos_registers (id, organization_id, location_id),
  CONSTRAINT pos_checkout_sales_shift_fk
    FOREIGN KEY (shift_id, register_id, organization_id, location_id)
    REFERENCES pos_shifts (id, register_id, organization_id, location_id),
  CONSTRAINT pos_checkout_sales_sale_unique UNIQUE (organization_id, sale_id)
);

CREATE INDEX pos_checkout_sales_org_loc_idx
  ON pos_checkout_sales (organization_id, location_id);

COMMENT ON TABLE pos_checkout_sales IS
  'POS operational sale/transaction state. Woo remains commercial order truth. Trusted-server write only.';

CREATE TABLE pos_checkout_payments (
  payment_id uuid PRIMARY KEY,
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  location_id pos_id NOT NULL,
  transaction_id uuid NOT NULL REFERENCES pos_checkout_sales (transaction_id),
  sale_id pos_id NOT NULL,
  evidence_id uuid NOT NULL,
  tender text NOT NULL CHECK (tender = 'cash'),
  status text NOT NULL CHECK (status = 'verified'),
  amount_minor pos_money_minor NOT NULL,
  amount_currency pos_currency NOT NULL,
  cash_received_minor pos_money_minor NOT NULL,
  cash_received_currency pos_currency NOT NULL,
  verified_at timestamptz NOT NULL,
  verification_source text NOT NULL CHECK (verification_source = 'cash_ledger'),
  actor_id pos_id NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_checkout_payments_loc_org_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES pos_locations (id, organization_id),
  CONSTRAINT pos_checkout_payments_one_per_transaction UNIQUE (transaction_id)
);

COMMENT ON TABLE pos_checkout_payments IS
  'Verified cash tender evidence bound to one POS transaction. Not an electronic charge. Trusted-server write only.';

CREATE TABLE pos_checkout_receipts (
  id pos_id PRIMARY KEY,
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  location_id pos_id NOT NULL,
  transaction_id uuid NOT NULL REFERENCES pos_checkout_sales (transaction_id),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_checkout_receipts_loc_org_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES pos_locations (id, organization_id),
  CONSTRAINT pos_checkout_receipts_one_per_transaction UNIQUE (transaction_id)
);

COMMENT ON TABLE pos_checkout_receipts IS
  'Immutable POS operational receipt snapshots. One receipt per transaction. Not a print side effect. Trusted-server write only.';

ALTER TABLE pos_quote_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_checkout_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_checkout_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_checkout_receipts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE pos_quote_snapshots, pos_checkout_sales, pos_checkout_payments, pos_checkout_receipts
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE pos_quote_snapshots, pos_checkout_sales, pos_checkout_payments, pos_checkout_receipts
  TO service_role;

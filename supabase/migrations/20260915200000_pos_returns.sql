-- RT-01: durable POS return/refund/stock-disposition operational state.
-- Additive. Not a Woo/Paystack master. service_role is infrastructure access
-- for BFF adapters, not cashier authorization. Do not rewrite historical migrations.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'pos_pending_operations'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%operation IN%'
  LOOP
    EXECUTE format('ALTER TABLE public.pos_pending_operations DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE pos_pending_operations
  ADD CONSTRAINT pos_pending_operations_operation_check CHECK (operation IN (
    'sale.prepare', 'sale.finalize', 'sale.cancel',
    'payment.initialize', 'payment.cash', 'payment.resolve',
    'shift.open', 'shift.close', 'cash.movement',
    'return.execute', 'return.resolve',
    'payment.refund', 'refund.resolve',
    'bridge.commercial_refund', 'bridge.stock_disposition'
  ));

ALTER TABLE pos_cash_movements
  ADD COLUMN IF NOT EXISTS refund_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS pos_cash_one_refund_per_refund_id
  ON pos_cash_movements (refund_id)
  WHERE kind = 'cash_refund' AND refund_id IS NOT NULL;

COMMENT ON COLUMN pos_cash_movements.refund_id IS
  'Local tender refundId for cash_refund rows. One append-only movement per refundId. Not a browser field.';

CREATE TABLE pos_returns (
  return_id uuid PRIMARY KEY,
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  location_id pos_id NOT NULL,
  register_id pos_id NOT NULL,
  shift_id uuid,
  actor_id pos_id NOT NULL,
  transaction_id uuid NOT NULL REFERENCES pos_checkout_sales (transaction_id),
  sale_id pos_id NOT NULL,
  economics_version text NOT NULL CHECK (char_length(economics_version) BETWEEN 1 AND 128),
  fingerprint text NOT NULL CHECK (char_length(fingerprint) BETWEEN 32 AND 128),
  preview_expires_at timestamptz NOT NULL,
  approval_required boolean NOT NULL DEFAULT false,
  refund_total_minor pos_money_minor NOT NULL,
  refund_currency pos_currency NOT NULL,
  status text NOT NULL CHECK (status IN (
    'previewed', 'approval_required', 'refund_pending', 'in_progress',
    'completed', 'requires_attention'
  )),
  execute_claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_returns_loc_org_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES pos_locations (id, organization_id),
  CONSTRAINT pos_returns_register_fk
    FOREIGN KEY (register_id, organization_id, location_id)
    REFERENCES pos_registers (id, organization_id, location_id),
  CONSTRAINT pos_returns_refund_non_negative CHECK (refund_total_minor >= 0)
);

CREATE INDEX pos_returns_sale_idx ON pos_returns (organization_id, sale_id);
CREATE INDEX pos_returns_transaction_idx ON pos_returns (transaction_id);

COMMENT ON TABLE pos_returns IS
  'POS return aggregate. Historic economics and effect identities are child tables. Trusted-server write only.';

CREATE TABLE pos_return_historic_lines (
  return_id uuid NOT NULL REFERENCES pos_returns (return_id) ON DELETE RESTRICT,
  order_line_id pos_id NOT NULL,
  original_sold_quantity numeric(14,6) NOT NULL CHECK (original_sold_quantity > 0),
  previously_returned_quantity numeric(14,6) NOT NULL CHECK (previously_returned_quantity >= 0),
  remaining_returnable_quantity numeric(14,6) NOT NULL CHECK (remaining_returnable_quantity >= 0),
  historical_subtotal_minor pos_money_minor NOT NULL,
  historical_discount_minor pos_money_minor NOT NULL,
  historical_tax_minor pos_money_minor NOT NULL,
  historical_total_minor pos_money_minor NOT NULL,
  currency pos_currency NOT NULL,
  PRIMARY KEY (return_id, order_line_id),
  CONSTRAINT pos_return_historic_line_qty CHECK (
    previously_returned_quantity + remaining_returnable_quantity = original_sold_quantity
  )
);

COMMENT ON TABLE pos_return_historic_lines IS
  'Immutable historic line economics copied at preview. Never repriced from current catalogs.';

CREATE TABLE pos_return_historic_tenders (
  return_id uuid NOT NULL REFERENCES pos_returns (return_id) ON DELETE RESTRICT,
  payment_id uuid NOT NULL,
  tender text NOT NULL CHECK (tender IN ('cash', 'mobile_money', 'card', 'external_electronic')),
  original_amount_minor pos_money_minor NOT NULL,
  already_refunded_minor pos_money_minor NOT NULL CHECK (already_refunded_minor >= 0),
  remaining_refundable_minor pos_money_minor NOT NULL CHECK (remaining_refundable_minor >= 0),
  currency pos_currency NOT NULL,
  PRIMARY KEY (return_id, payment_id),
  CONSTRAINT pos_return_historic_tender_sum CHECK (
    already_refunded_minor + remaining_refundable_minor = original_amount_minor
  )
);

COMMENT ON TABLE pos_return_historic_tenders IS
  'Immutable historic tender economics copied at preview. Refunds cannot exceed remaining_refundable_minor.';

CREATE TABLE pos_return_requested_lines (
  return_id uuid NOT NULL REFERENCES pos_returns (return_id) ON DELETE RESTRICT,
  order_line_id pos_id NOT NULL,
  quantity numeric(14,6) NOT NULL CHECK (quantity > 0),
  reason text NOT NULL CHECK (char_length(btrim(reason)) > 0),
  condition text NOT NULL CHECK (condition IN (
    'resellable', 'opened_resellable', 'damaged', 'defective', 'quarantine', 'not_physically_returned'
  )),
  intended_disposition text NOT NULL CHECK (intended_disposition IN (
    'restock_sellable', 'no_automatic_restock'
  )),
  disposition_policy text NOT NULL CHECK (disposition_policy IN (
    'automatic_sellable_restock', 'mandatory_no_automatic_restock', 'tenant_policy_required'
  )),
  PRIMARY KEY (return_id, order_line_id),
  CONSTRAINT pos_return_requested_disposition_safety CHECK (
    (
      condition IN ('damaged', 'quarantine', 'not_physically_returned')
      AND intended_disposition = 'no_automatic_restock'
      AND disposition_policy = 'mandatory_no_automatic_restock'
    )
    OR (
      condition IN ('opened_resellable', 'defective')
      AND intended_disposition = 'no_automatic_restock'
      AND disposition_policy = 'tenant_policy_required'
    )
    OR (
      condition = 'resellable'
      AND (
        (intended_disposition = 'restock_sellable' AND disposition_policy = 'automatic_sellable_restock')
        OR (intended_disposition = 'no_automatic_restock')
      )
    )
  )
);

CREATE TABLE pos_return_approvals (
  approval_id uuid PRIMARY KEY,
  return_id uuid NOT NULL REFERENCES pos_returns (return_id) ON DELETE RESTRICT,
  fingerprint text NOT NULL CHECK (char_length(fingerprint) BETWEEN 32 AND 128),
  actor_id pos_id NOT NULL,
  organization_id pos_id NOT NULL,
  location_id pos_id NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_return_approvals_loc_org_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES pos_locations (id, organization_id)
);

CREATE INDEX pos_return_approvals_return_idx ON pos_return_approvals (return_id);

CREATE TABLE pos_sale_line_return_balances (
  organization_id pos_id NOT NULL,
  sale_id pos_id NOT NULL,
  order_line_id pos_id NOT NULL,
  original_sold_quantity numeric(14,6) NOT NULL CHECK (original_sold_quantity > 0),
  accepted_returned_quantity numeric(14,6) NOT NULL DEFAULT 0 CHECK (accepted_returned_quantity >= 0),
  PRIMARY KEY (organization_id, sale_id, order_line_id),
  CONSTRAINT pos_sale_line_return_cap CHECK (accepted_returned_quantity <= original_sold_quantity)
);

COMMENT ON TABLE pos_sale_line_return_balances IS
  'Accepted returned quantity per original sale line. Concurrent claims serialize on the row.';

CREATE TABLE pos_sale_tender_refund_balances (
  payment_id uuid PRIMARY KEY,
  organization_id pos_id NOT NULL,
  sale_id pos_id NOT NULL,
  original_amount_minor pos_money_minor NOT NULL,
  accepted_refunded_minor pos_money_minor NOT NULL DEFAULT 0 CHECK (accepted_refunded_minor >= 0),
  currency pos_currency NOT NULL,
  CONSTRAINT pos_sale_tender_refund_cap CHECK (accepted_refunded_minor <= original_amount_minor)
);

CREATE TABLE pos_tender_refunds (
  refund_id uuid PRIMARY KEY,
  return_id uuid NOT NULL REFERENCES pos_returns (return_id) ON DELETE RESTRICT,
  organization_id pos_id NOT NULL,
  location_id pos_id NOT NULL,
  payment_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('cash_ledger', 'provider_electronic')),
  amount_minor pos_money_minor NOT NULL CHECK (amount_minor > 0),
  currency pos_currency NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'verified', 'failed', 'requires_attention')),
  cash_movement_id uuid REFERENCES pos_cash_movements (id),
  provider text,
  provider_refund_reference text,
  initialize_status text CHECK (
    initialize_status IS NULL
    OR initialize_status IN ('pending_remote', 'initialized', 'lost_response')
  ),
  attention_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_tender_refunds_one_per_return UNIQUE (return_id),
  CONSTRAINT pos_tender_refunds_loc_org_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES pos_locations (id, organization_id)
);

CREATE INDEX pos_tender_refunds_payment_idx ON pos_tender_refunds (payment_id);

COMMENT ON TABLE pos_tender_refunds IS
  'Independent tender refund effects. refundId is the durable identity. Two partials on one payment are two rows.';

CREATE TABLE pos_commercial_refunds (
  commercial_refund_id uuid PRIMARY KEY,
  return_id uuid NOT NULL UNIQUE REFERENCES pos_returns (return_id) ON DELETE RESTRICT,
  organization_id pos_id NOT NULL,
  location_id pos_id NOT NULL,
  transaction_id uuid NOT NULL,
  sale_id pos_id NOT NULL,
  amount_minor pos_money_minor NOT NULL CHECK (amount_minor >= 0),
  currency pos_currency NOT NULL,
  economics_version text NOT NULL,
  fingerprint text NOT NULL,
  status text NOT NULL CHECK (status IN (
    'not_started', 'not_required', 'not_found', 'pending', 'completed', 'requires_attention'
  )),
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_commercial_refunds_loc_org_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES pos_locations (id, organization_id)
);

CREATE TABLE pos_stock_dispositions (
  stock_disposition_id uuid PRIMARY KEY,
  return_id uuid NOT NULL UNIQUE REFERENCES pos_returns (return_id) ON DELETE RESTRICT,
  organization_id pos_id NOT NULL,
  location_id pos_id NOT NULL,
  transaction_id uuid NOT NULL,
  sale_id pos_id NOT NULL,
  economics_version text NOT NULL,
  fingerprint text NOT NULL,
  status text NOT NULL CHECK (status IN (
    'not_started', 'not_required', 'not_found', 'pending', 'completed', 'requires_attention'
  )),
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_stock_dispositions_loc_org_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES pos_locations (id, organization_id)
);

CREATE TABLE pos_return_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES pos_returns (return_id) ON DELETE RESTRICT,
  organization_id pos_id NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pos_return_audit_return_idx ON pos_return_audit (return_id, created_at);

COMMENT ON TABLE pos_return_audit IS
  'Append-only return/refund history linked to the original sale. Does not rewrite receipts.';

CREATE OR REPLACE FUNCTION pos_return_historic_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'historic return economics are immutable' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER pos_return_historic_lines_immutable
  BEFORE UPDATE OR DELETE ON pos_return_historic_lines
  FOR EACH ROW EXECUTE FUNCTION pos_return_historic_immutable();

CREATE TRIGGER pos_return_historic_tenders_immutable
  BEFORE UPDATE OR DELETE ON pos_return_historic_tenders
  FOR EACH ROW EXECUTE FUNCTION pos_return_historic_immutable();

CREATE TRIGGER pos_return_requested_lines_immutable
  BEFORE UPDATE OR DELETE ON pos_return_requested_lines
  FOR EACH ROW EXECUTE FUNCTION pos_return_historic_immutable();

CREATE OR REPLACE FUNCTION pos_return_audit_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'return audit is append-only' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pos_return_audit_append_only
  BEFORE UPDATE OR DELETE ON pos_return_audit
  FOR EACH ROW EXECUTE FUNCTION pos_return_audit_append_only();

CREATE OR REPLACE FUNCTION pos_tender_refund_monotonic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'verified' AND NEW.status IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'verified tender refunds cannot be downgraded' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pos_tender_refund_monotonic
  BEFORE UPDATE ON pos_tender_refunds
  FOR EACH ROW EXECUTE FUNCTION pos_tender_refund_monotonic();

CREATE OR REPLACE FUNCTION pos_independent_effect_monotonic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'completed' AND NEW.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'completed independent effects cannot be downgraded' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pos_commercial_refund_monotonic
  BEFORE UPDATE ON pos_commercial_refunds
  FOR EACH ROW EXECUTE FUNCTION pos_independent_effect_monotonic();

CREATE TRIGGER pos_stock_disposition_monotonic
  BEFORE UPDATE ON pos_stock_dispositions
  FOR EACH ROW EXECUTE FUNCTION pos_independent_effect_monotonic();

CREATE OR REPLACE FUNCTION pos_claim_sale_return_quantity(
  p_organization_id pos_id,
  p_sale_id pos_id,
  p_order_line_id pos_id,
  p_original numeric,
  p_quantity numeric
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  n integer;
BEGIN
  IF p_quantity <= 0 OR p_original <= 0 THEN
    RETURN false;
  END IF;
  INSERT INTO public.pos_sale_line_return_balances (
    organization_id, sale_id, order_line_id, original_sold_quantity, accepted_returned_quantity
  ) VALUES (
    p_organization_id, p_sale_id, p_order_line_id, p_original, 0
  )
  ON CONFLICT (organization_id, sale_id, order_line_id) DO NOTHING;

  UPDATE public.pos_sale_line_return_balances
     SET accepted_returned_quantity = accepted_returned_quantity + p_quantity
   WHERE organization_id = p_organization_id
     AND sale_id = p_sale_id
     AND order_line_id = p_order_line_id
     AND original_sold_quantity = p_original
     AND accepted_returned_quantity + p_quantity <= original_sold_quantity;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END;
$$;

CREATE OR REPLACE FUNCTION pos_claim_tender_refund(
  p_payment_id uuid,
  p_organization_id pos_id,
  p_sale_id pos_id,
  p_original_minor pos_money_minor,
  p_amount_minor pos_money_minor,
  p_currency pos_currency
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  n integer;
BEGIN
  IF p_amount_minor <= 0 OR p_original_minor <= 0 THEN
    RETURN false;
  END IF;
  INSERT INTO public.pos_sale_tender_refund_balances (
    payment_id, organization_id, sale_id, original_amount_minor, accepted_refunded_minor, currency
  ) VALUES (
    p_payment_id, p_organization_id, p_sale_id, p_original_minor, 0, p_currency
  )
  ON CONFLICT (payment_id) DO NOTHING;

  UPDATE public.pos_sale_tender_refund_balances
     SET accepted_refunded_minor = accepted_refunded_minor + p_amount_minor
   WHERE payment_id = p_payment_id
     AND organization_id = p_organization_id
     AND currency = p_currency
     AND original_amount_minor = p_original_minor
     AND accepted_refunded_minor + p_amount_minor <= original_amount_minor;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END;
$$;

ALTER TABLE pos_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_return_historic_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_return_historic_tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_return_requested_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_return_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sale_line_return_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sale_tender_refund_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_tender_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_commercial_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_stock_dispositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_return_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  pos_returns, pos_return_historic_lines, pos_return_historic_tenders,
  pos_return_requested_lines, pos_return_approvals,
  pos_sale_line_return_balances, pos_sale_tender_refund_balances,
  pos_tender_refunds, pos_commercial_refunds, pos_stock_dispositions,
  pos_return_audit
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE
  pos_returns, pos_return_approvals,
  pos_sale_line_return_balances, pos_sale_tender_refund_balances,
  pos_tender_refunds, pos_commercial_refunds, pos_stock_dispositions
  TO service_role;

GRANT SELECT, INSERT ON TABLE
  pos_return_historic_lines, pos_return_historic_tenders,
  pos_return_requested_lines, pos_return_audit
  TO service_role;

CREATE OR REPLACE FUNCTION pos_claim_return_execution(p_return_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  r public.pos_returns%ROWTYPE;
  line public.pos_return_requested_lines%ROWTYPE;
  hist public.pos_return_historic_lines%ROWTYPE;
  tend public.pos_return_historic_tenders%ROWTYPE;
  ok boolean;
BEGIN
  SELECT * INTO r FROM public.pos_returns WHERE return_id = p_return_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'missing';
  END IF;
  IF r.execute_claimed_at IS NOT NULL THEN
    RETURN 'already_claimed';
  END IF;

  FOR line IN
    SELECT * FROM public.pos_return_requested_lines WHERE return_id = p_return_id
  LOOP
    SELECT * INTO hist
      FROM public.pos_return_historic_lines
     WHERE return_id = p_return_id AND order_line_id = line.order_line_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'quantity_exceeded' USING ERRCODE = 'P0001';
    END IF;
    ok := public.pos_claim_sale_return_quantity(
      r.organization_id, r.sale_id, line.order_line_id, hist.original_sold_quantity, line.quantity
    );
    IF NOT ok THEN
      RAISE EXCEPTION 'quantity_exceeded' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  IF r.refund_total_minor > 0 THEN
    SELECT * INTO tend
      FROM public.pos_return_historic_tenders
     WHERE return_id = p_return_id
     LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'refund_exceeded' USING ERRCODE = 'P0001';
    END IF;
    ok := public.pos_claim_tender_refund(
      tend.payment_id, r.organization_id, r.sale_id,
      tend.original_amount_minor, r.refund_total_minor, r.refund_currency
    );
    IF NOT ok THEN
      RAISE EXCEPTION 'refund_exceeded' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.pos_returns
     SET execute_claimed_at = now(),
         status = CASE WHEN status IN ('previewed', 'approval_required') THEN 'in_progress' ELSE status END,
         updated_at = now()
   WHERE return_id = p_return_id;
  RETURN 'claimed';
END;
$$;

GRANT EXECUTE ON FUNCTION pos_claim_sale_return_quantity(pos_id, pos_id, pos_id, numeric, numeric)
  TO service_role;
GRANT EXECUTE ON FUNCTION pos_claim_tender_refund(uuid, pos_id, pos_id, pos_money_minor, pos_money_minor, pos_currency)
  TO service_role;
GRANT EXECUTE ON FUNCTION pos_claim_return_execution(uuid)
  TO service_role;

-- CORE-HARDEN-07 durable POS checkout runtime backing CORE-05/CORE-06.
-- These tables persist POS workflow snapshots/evidence only. Woo remains commercial order truth.

CREATE TABLE pos_checkout_quotes (
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  quote_id pos_id NOT NULL,
  location_id pos_id NOT NULL REFERENCES pos_locations (id),
  location_name text NOT NULL CHECK (char_length(location_name) BETWEEN 1 AND 128),
  fingerprint text NOT NULL CHECK (char_length(fingerprint) BETWEEN 1 AND 256),
  snapshot jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, quote_id),
  CONSTRAINT pos_checkout_quotes_location_org_fk
    FOREIGN KEY (location_id, organization_id)
    REFERENCES pos_locations (id, organization_id)
);

CREATE TABLE pos_checkout_prepare_intents (
  transaction_id uuid PRIMARY KEY,
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  location_id pos_id NOT NULL REFERENCES pos_locations (id),
  register_id pos_id NOT NULL REFERENCES pos_registers (id),
  shift_id uuid NOT NULL REFERENCES pos_shifts (id),
  device_id uuid NOT NULL REFERENCES pos_devices (id),
  cashier_id pos_id NOT NULL,
  cashier_name text NOT NULL CHECK (char_length(cashier_name) BETWEEN 1 AND 128),
  quote_id pos_id NOT NULL,
  quote_fingerprint text NOT NULL,
  request jsonb NOT NULL,
  idempotency_key uuid NOT NULL,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_checkout_prepare_register_fk
    FOREIGN KEY (register_id, organization_id, location_id)
    REFERENCES pos_registers (id, organization_id, location_id),
  CONSTRAINT pos_checkout_prepare_shift_fk
    FOREIGN KEY (shift_id, register_id, organization_id, location_id)
    REFERENCES pos_shifts (id, register_id, organization_id, location_id),
  CONSTRAINT pos_checkout_prepare_quote_fk
    FOREIGN KEY (organization_id, quote_id)
    REFERENCES pos_checkout_quotes (organization_id, quote_id),
  UNIQUE (organization_id, idempotency_key)
);

CREATE TABLE pos_checkout_sales (
  transaction_id uuid PRIMARY KEY,
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  location_id pos_id NOT NULL REFERENCES pos_locations (id),
  register_id pos_id NOT NULL REFERENCES pos_registers (id),
  shift_id uuid NOT NULL REFERENCES pos_shifts (id),
  device_id uuid NOT NULL REFERENCES pos_devices (id),
  cashier_id pos_id NOT NULL,
  sale_id pos_id NOT NULL,
  order_reference text NOT NULL CHECK (char_length(order_reference) BETWEEN 1 AND 128),
  quote_fingerprint text NOT NULL,
  total_minor pos_money_minor NOT NULL,
  currency pos_currency NOT NULL,
  status text NOT NULL CHECK (status IN (
    'not_found', 'preparing', 'prepared', 'payment_pending', 'finalizing',
    'completed', 'cancelled', 'requires_attention'
  )),
  assigned_payment_id uuid,
  commercial_confirmed boolean NOT NULL DEFAULT false,
  record jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_checkout_sales_register_fk
    FOREIGN KEY (register_id, organization_id, location_id)
    REFERENCES pos_registers (id, organization_id, location_id),
  CONSTRAINT pos_checkout_sales_shift_fk
    FOREIGN KEY (shift_id, register_id, organization_id, location_id)
    REFERENCES pos_shifts (id, register_id, organization_id, location_id),
  UNIQUE (organization_id, sale_id)
);

CREATE TABLE pos_checkout_payments (
  payment_id uuid PRIMARY KEY,
  transaction_id uuid NOT NULL UNIQUE REFERENCES pos_checkout_sales (transaction_id),
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  sale_id pos_id NOT NULL,
  evidence_id uuid NOT NULL UNIQUE,
  amount_minor pos_money_minor NOT NULL,
  currency pos_currency NOT NULL,
  cash_received_minor pos_money_minor NOT NULL,
  cash_received_currency pos_currency NOT NULL,
  verified_at timestamptz NOT NULL,
  actor_id pos_id NOT NULL,
  record jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_checkout_payment_currency_match CHECK (currency = cash_received_currency),
  CONSTRAINT pos_checkout_payment_sale_fk
    FOREIGN KEY (organization_id, sale_id)
    REFERENCES pos_checkout_sales (organization_id, sale_id)
);

CREATE TABLE pos_checkout_receipts (
  transaction_id uuid PRIMARY KEY REFERENCES pos_checkout_sales (transaction_id),
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  receipt_id pos_id NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, receipt_id)
);

CREATE TABLE pos_checkout_idempotency (
  organization_id pos_id NOT NULL REFERENCES pos_organizations (id),
  operation text NOT NULL CHECK (operation IN (
    'sale.prepare', 'sale.finalize', 'sale.cancel',
    'payment.initialize', 'payment.cash', 'payment.resolve',
    'shift.open', 'shift.close', 'cash.movement', 'refund.resolve'
  )),
  idempotency_key uuid NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK (status IN (
    'pending', 'sent', 'response_unknown', 'acknowledged', 'requires_attention'
  )),
  outcome jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, operation, idempotency_key)
);

CREATE INDEX pos_checkout_sales_scope_idx
  ON pos_checkout_sales (organization_id, location_id, register_id, status);
CREATE INDEX pos_checkout_prepare_scope_idx
  ON pos_checkout_prepare_intents (organization_id, location_id, register_id);
CREATE INDEX pos_checkout_outcome_status_idx
  ON pos_checkout_idempotency (organization_id, status);

ALTER TABLE pos_checkout_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_checkout_prepare_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_checkout_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_checkout_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_checkout_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_checkout_idempotency ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON pos_checkout_quotes FROM anon, authenticated;
REVOKE ALL ON pos_checkout_prepare_intents FROM anon, authenticated;
REVOKE ALL ON pos_checkout_sales FROM anon, authenticated;
REVOKE ALL ON pos_checkout_payments FROM anon, authenticated;
REVOKE ALL ON pos_checkout_receipts FROM anon, authenticated;
REVOKE ALL ON pos_checkout_idempotency FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON pos_checkout_quotes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON pos_checkout_prepare_intents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON pos_checkout_sales TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON pos_checkout_payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON pos_checkout_receipts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON pos_checkout_idempotency TO service_role;

CREATE OR REPLACE FUNCTION pos_checkout_claim_idempotency(
  p_organization_id text,
  p_operation text,
  p_idempotency_key uuid,
  p_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row pos_checkout_idempotency%ROWTYPE;
BEGIN
  INSERT INTO pos_checkout_idempotency (
    organization_id, operation, idempotency_key, request_hash, status
  ) VALUES (
    p_organization_id, p_operation, p_idempotency_key, p_request_hash, 'pending'
  )
  ON CONFLICT DO NOTHING;

  SELECT * INTO STRICT row
  FROM pos_checkout_idempotency
  WHERE organization_id = p_organization_id
    AND operation = p_operation
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF row.request_hash IS DISTINCT FROM p_request_hash THEN
    RETURN jsonb_build_object('kind', 'conflict');
  END IF;
  IF row.status = 'sent' THEN
    RETURN jsonb_build_object('kind', 'in_progress');
  END IF;
  IF row.status = 'acknowledged' THEN
    RETURN jsonb_build_object('kind', 'replay', 'outcome', row.outcome);
  END IF;
  IF row.status = 'requires_attention' THEN
    RETURN jsonb_build_object('kind', 'repair', 'outcome', row.outcome);
  END IF;
  RETURN jsonb_build_object('kind', 'acquired');
END;
$$;

CREATE OR REPLACE FUNCTION pos_checkout_open_shift(
  p_shift_id uuid,
  p_organization_id text,
  p_location_id text,
  p_register_id text,
  p_device_id uuid,
  p_cashier_id text,
  p_opening_minor bigint,
  p_currency text,
  p_opened_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reg pos_registers%ROWTYPE;
  dev pos_devices%ROWTYPE;
BEGIN
  SELECT * INTO reg FROM pos_registers
  WHERE id = p_register_id
    AND organization_id = p_organization_id
    AND location_id = p_location_id;
  IF NOT FOUND OR reg.status <> 'active' THEN
    RETURN 'conflict';
  END IF;
  SELECT * INTO dev FROM pos_devices
  WHERE id = p_device_id
    AND organization_id = p_organization_id
    AND location_id = p_location_id
    AND status = 'active';
  IF NOT FOUND THEN
    RETURN 'conflict';
  END IF;
  IF NOT pos_has_location_assignment(p_organization_id, p_location_id, p_cashier_id)
     OR NOT pos_has_register_assignment(p_register_id, p_cashier_id) THEN
    RAISE EXCEPTION 'actor is not assigned to register' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM pos_shifts WHERE register_id = p_register_id AND status IN ('open', 'closing')) THEN
    RETURN 'conflict';
  END IF;
  INSERT INTO pos_shifts (
    id, organization_id, location_id, register_id, device_id, cashier_id,
    status, opening_float_minor, opening_float_currency,
    expected_cash_minor, expected_cash_currency, opened_at
  ) VALUES (
    p_shift_id, p_organization_id, p_location_id, p_register_id, p_device_id, p_cashier_id,
    'open', p_opening_minor, p_currency,
    p_opening_minor, p_currency, p_opened_at
  );
  RETURN 'ok';
EXCEPTION WHEN unique_violation THEN
  RETURN 'conflict';
END;
$$;

CREATE OR REPLACE FUNCTION pos_checkout_record_cash_sale(
  p_movement_id uuid,
  p_organization_id text,
  p_location_id text,
  p_register_id text,
  p_shift_id uuid,
  p_actor_id text,
  p_transaction_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_created_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sh pos_shifts%ROWTYPE;
BEGIN
  SELECT * INTO sh FROM pos_shifts
  WHERE id = p_shift_id
    AND organization_id = p_organization_id
    AND location_id = p_location_id
    AND register_id = p_register_id;
  IF NOT FOUND OR sh.status <> 'open' THEN
    RETURN 'shift_required';
  END IF;
  IF sh.expected_cash_currency IS DISTINCT FROM p_currency THEN
    RAISE EXCEPTION 'cash movement currency must match shift' USING ERRCODE = '23514';
  END IF;
  IF NOT pos_has_location_assignment(p_organization_id, p_location_id, p_actor_id)
     OR NOT pos_has_register_assignment(p_register_id, p_actor_id) THEN
    RAISE EXCEPTION 'actor is not assigned to register' USING ERRCODE = '42501';
  END IF;
  IF p_amount_minor <= 0 THEN
    RETURN 'negative_expected';
  END IF;
  INSERT INTO pos_cash_movements (
    id, organization_id, location_id, register_id, shift_id, kind,
    signed_amount_minor, currency, actor_id, created_at, transaction_id, reason
  ) VALUES (
    p_movement_id, p_organization_id, p_location_id, p_register_id, p_shift_id, 'cash_sale',
    p_amount_minor, p_currency, p_actor_id, p_created_at, p_transaction_id, 'cash sale'
  );
  RETURN 'ok';
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (
    SELECT 1 FROM pos_cash_movements
    WHERE kind = 'cash_sale' AND transaction_id = p_transaction_id
  ) THEN
    RETURN 'duplicate_sale';
  END IF;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION pos_checkout_claim_idempotency(text, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION pos_checkout_open_shift(uuid, text, text, text, uuid, text, bigint, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION pos_checkout_record_cash_sale(uuid, text, text, text, uuid, text, uuid, bigint, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION pos_checkout_claim_idempotency(text, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION pos_checkout_open_shift(uuid, text, text, text, uuid, text, bigint, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION pos_checkout_record_cash_sale(uuid, text, text, text, uuid, text, uuid, bigint, text, timestamptz) TO service_role;

COMMENT ON TABLE pos_checkout_quotes IS 'Durable accepted authoritative quote snapshots for POS workflow repair; not a pricing engine or pricing truth.';
COMMENT ON TABLE pos_checkout_sales IS 'POS workflow snapshot keyed by transaction; Woo remains the commercial order owner.';
COMMENT ON TABLE pos_checkout_payments IS 'Verified POS tender evidence; cash commercial completion still occurs through Woo bridge finalize.';
COMMENT ON TABLE pos_checkout_receipts IS 'Operational POS receipt snapshots generated from accepted quote + verified tender evidence.';
COMMENT ON TABLE pos_checkout_idempotency IS 'Durable server command outcomes required for process-restart idempotency repair.';

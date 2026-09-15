-- CORE-HARDEN-07: immutable durable checkout identities/evidence.

CREATE OR REPLACE FUNCTION pos_checkout_sale_before_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.transaction_id IS DISTINCT FROM OLD.transaction_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.location_id IS DISTINCT FROM OLD.location_id
     OR NEW.register_id IS DISTINCT FROM OLD.register_id
     OR NEW.shift_id IS DISTINCT FROM OLD.shift_id
     OR NEW.device_id IS DISTINCT FROM OLD.device_id
     OR NEW.cashier_id IS DISTINCT FROM OLD.cashier_id
     OR NEW.sale_id IS DISTINCT FROM OLD.sale_id
     OR NEW.order_reference IS DISTINCT FROM OLD.order_reference
     OR NEW.quote_fingerprint IS DISTINCT FROM OLD.quote_fingerprint
     OR NEW.total_minor IS DISTINCT FROM OLD.total_minor
     OR NEW.currency IS DISTINCT FROM OLD.currency THEN
    RAISE EXCEPTION 'checkout sale commercial identity is immutable' USING ERRCODE = '55000';
  END IF;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER pos_checkout_sale_before_update
  BEFORE UPDATE ON pos_checkout_sales
  FOR EACH ROW
  EXECUTE FUNCTION pos_checkout_sale_before_update();

CREATE OR REPLACE FUNCTION pos_checkout_payment_before_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.payment_id IS DISTINCT FROM OLD.payment_id
     OR NEW.transaction_id IS DISTINCT FROM OLD.transaction_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.sale_id IS DISTINCT FROM OLD.sale_id
     OR NEW.evidence_id IS DISTINCT FROM OLD.evidence_id
     OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.cash_received_minor IS DISTINCT FROM OLD.cash_received_minor
     OR NEW.cash_received_currency IS DISTINCT FROM OLD.cash_received_currency
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
     OR NEW.actor_id IS DISTINCT FROM OLD.actor_id
     OR NEW.record IS DISTINCT FROM OLD.record THEN
    RAISE EXCEPTION 'verified checkout payment evidence is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER pos_checkout_payment_before_update
  BEFORE UPDATE ON pos_checkout_payments
  FOR EACH ROW
  EXECUTE FUNCTION pos_checkout_payment_before_update();

CREATE OR REPLACE FUNCTION pos_checkout_receipt_before_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.transaction_id IS DISTINCT FROM OLD.transaction_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.receipt_id IS DISTINCT FROM OLD.receipt_id
     OR NEW.snapshot IS DISTINCT FROM OLD.snapshot THEN
    RAISE EXCEPTION 'operational POS receipt snapshot is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER pos_checkout_receipt_before_update
  BEFORE UPDATE ON pos_checkout_receipts
  FOR EACH ROW
  EXECUTE FUNCTION pos_checkout_receipt_before_update();

REVOKE ALL ON FUNCTION pos_checkout_sale_before_update() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION pos_checkout_payment_before_update() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION pos_checkout_receipt_before_update() FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION pos_checkout_sale_before_update() IS
  'Prevents retries/races from changing the Woo sale binding, scope or accepted economics while allowing workflow status/receipt/payment progress.';
COMMENT ON FUNCTION pos_checkout_payment_before_update() IS
  'Verified payment evidence is immutable; exact idempotent rewrites are tolerated, different evidence fails closed.';
COMMENT ON FUNCTION pos_checkout_receipt_before_update() IS
  'Operational receipt snapshots are immutable; printing/reprinting must never mutate sale evidence.';

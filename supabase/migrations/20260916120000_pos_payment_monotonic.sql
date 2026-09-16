-- PAY-01 / R7: durable monotonic payment and sale truth.
-- Once a payment is verified, concurrent weaker results cannot overwrite it.
-- Once a sale is finalizing or completed, it cannot regress to payment_pending.
-- Additive. Not a live-money authorization.

CREATE OR REPLACE FUNCTION pos_checkout_payment_monotonic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'verified' AND NEW.status IS DISTINCT FROM 'verified' THEN
    NEW.status := 'verified';
    NEW.evidence_id := COALESCE(OLD.evidence_id, NEW.evidence_id);
    NEW.verified_at := COALESCE(OLD.verified_at, NEW.verified_at);
    NEW.verification_source := COALESCE(OLD.verification_source, NEW.verification_source);
    NEW.provider_transaction_id := COALESCE(OLD.provider_transaction_id, NEW.provider_transaction_id);
    NEW.attention_reason := OLD.attention_reason;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pos_checkout_payment_monotonic ON pos_checkout_payments;
CREATE TRIGGER pos_checkout_payment_monotonic
  BEFORE UPDATE ON pos_checkout_payments
  FOR EACH ROW EXECUTE FUNCTION pos_checkout_payment_monotonic();

CREATE OR REPLACE FUNCTION pos_sale_status_rank(status text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE status
    WHEN 'not_found' THEN 0
    WHEN 'preparing' THEN 1
    WHEN 'prepared' THEN 2
    WHEN 'payment_pending' THEN 3
    WHEN 'requires_attention' THEN 3
    WHEN 'finalizing' THEN 4
    WHEN 'completed' THEN 5
    WHEN 'cancelled' THEN 5
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION pos_checkout_sale_monotonic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF pos_sale_status_rank(OLD.status) >= 4
     AND pos_sale_status_rank(NEW.status) < pos_sale_status_rank(OLD.status) THEN
    NEW.status := OLD.status;
    NEW.assigned_payment_id := COALESCE(OLD.assigned_payment_id, NEW.assigned_payment_id);
    NEW.commercial_confirmed := OLD.commercial_confirmed OR NEW.commercial_confirmed;
    IF NEW.record IS NOT NULL AND jsonb_typeof(NEW.record) = 'object' THEN
      NEW.record := jsonb_set(NEW.record, '{status}', to_jsonb(OLD.status));
      IF COALESCE(OLD.assigned_payment_id, NEW.assigned_payment_id) IS NOT NULL THEN
        NEW.record := jsonb_set(
          NEW.record,
          '{assignedPaymentId}',
          to_jsonb(COALESCE(OLD.assigned_payment_id, NEW.assigned_payment_id))
        );
      END IF;
      IF OLD.commercial_confirmed OR NEW.commercial_confirmed THEN
        NEW.record := jsonb_set(NEW.record, '{commercialConfirmed}', 'true'::jsonb);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pos_checkout_sale_monotonic ON pos_checkout_sales;
CREATE TRIGGER pos_checkout_sale_monotonic
  BEFORE UPDATE ON pos_checkout_sales
  FOR EACH ROW EXECUTE FUNCTION pos_checkout_sale_monotonic();

COMMENT ON FUNCTION pos_checkout_payment_monotonic() IS
  'Verified tender truth is a floor. Stale pending/failed/timeout writes cannot downgrade it.';

COMMENT ON FUNCTION pos_checkout_sale_monotonic() IS
  'finalizing/completed sales cannot regress to payment_pending or another earlier status.';

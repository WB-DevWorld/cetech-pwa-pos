-- Manual Mobile Money attestation. Does not rewrite earlier migrations.
-- Verified Paystack rows still require provider_server_verification.
-- Cash rows are unchanged. No new permissive RLS policy is added.

ALTER TABLE public.pos_checkout_payments
  ADD COLUMN IF NOT EXISTS manual_network text,
  ADD COLUMN IF NOT EXISTS merchant_account_label text,
  ADD COLUMN IF NOT EXISTS attestation_actor_id text,
  ADD COLUMN IF NOT EXISTS authorization_url text;

ALTER TABLE public.pos_checkout_payments
  DROP CONSTRAINT IF EXISTS pos_checkout_payments_cash_fields_check;

ALTER TABLE public.pos_checkout_payments
  ADD CONSTRAINT pos_checkout_payments_cash_fields_check
    CHECK (
      (
        tender = 'cash'
        AND status IS NOT NULL
        AND status = 'verified'
        AND cash_received_minor IS NOT NULL
        AND cash_received_currency IS NOT NULL
        AND cash_received_currency = amount_currency
        AND evidence_id IS NOT NULL
        AND verified_at IS NOT NULL
        AND verification_source IS NOT NULL
        AND verification_source = 'cash_ledger'
        AND provider IS NULL
        AND provider_reference IS NULL
      )
      OR
      (
        tender IN ('mobile_money', 'card', 'external_electronic')
        AND provider IS DISTINCT FROM 'manual_mobile_money'
        AND cash_received_minor IS NULL
        AND cash_received_currency IS NULL
        AND provider IS NOT NULL
        AND provider_reference IS NOT NULL
        AND (
          (
            status IS NOT NULL
            AND status = 'verified'
            AND evidence_id IS NOT NULL
            AND verified_at IS NOT NULL
            AND verification_source IS NOT NULL
            AND verification_source = 'provider_server_verification'
          )
          OR
          (
            status IS NOT NULL
            AND status <> 'verified'
            AND (
              verification_source IS NULL
              OR verification_source = 'provider_server_verification'
            )
          )
        )
      )
      OR
      (
        tender = 'mobile_money'
        AND provider IS NOT NULL
        AND provider = 'manual_mobile_money'
        AND cash_received_minor IS NULL
        AND cash_received_currency IS NULL
        AND provider_reference IS NOT NULL
        AND btrim(provider_reference) <> ''
        AND provider_transaction_id IS NULL
        AND (
          (
            status IS NOT NULL
            AND status = 'verified'
            AND evidence_id IS NOT NULL
            AND btrim(evidence_id::text) <> ''
            AND verified_at IS NOT NULL
            AND verification_source IS NOT NULL
            AND verification_source = 'approved_external_attestation'
            AND manual_network IS NOT NULL
            AND btrim(manual_network) <> ''
            AND merchant_account_label IS NOT NULL
            AND btrim(merchant_account_label) <> ''
            AND attestation_actor_id IS NOT NULL
            AND btrim(attestation_actor_id) <> ''
          )
          OR
          (
            status IS NOT NULL
            AND status <> 'verified'
            AND verification_source IS NULL
          )
        )
      )
    );

COMMENT ON CONSTRAINT pos_checkout_payments_cash_fields_check ON public.pos_checkout_payments IS
  'Cash stays on the cash ledger. Paystack verification stays provider_server_verification. Manual Mobile Money is approved_external_attestation and cannot satisfy the Paystack branch. NULL discriminants do not satisfy a branch.';

CREATE OR REPLACE FUNCTION public.pos_manual_attestation_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.provider = 'manual_mobile_money' AND OLD.status = 'verified' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
      OR NEW.provider IS DISTINCT FROM OLD.provider
      OR NEW.provider_reference IS DISTINCT FROM OLD.provider_reference
      OR NEW.manual_network IS DISTINCT FROM OLD.manual_network
      OR NEW.merchant_account_label IS DISTINCT FROM OLD.merchant_account_label
      OR NEW.attestation_actor_id IS DISTINCT FROM OLD.attestation_actor_id
      OR NEW.evidence_id IS DISTINCT FROM OLD.evidence_id
      OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
      OR NEW.verification_source IS DISTINCT FROM OLD.verification_source
      OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
      OR NEW.amount_currency IS DISTINCT FROM OLD.amount_currency
      OR NEW.actor_id IS DISTINCT FROM OLD.actor_id
      OR NEW.tender IS DISTINCT FROM OLD.tender
      OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.location_id IS DISTINCT FROM OLD.location_id
      OR NEW.transaction_id IS DISTINCT FROM OLD.transaction_id
      OR NEW.sale_id IS DISTINCT FROM OLD.sale_id
      OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
    THEN
      RAISE EXCEPTION 'manual mobile money attestation is immutable'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_manual_attestation_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pos_manual_attestation_immutable() FROM anon;
REVOKE ALL ON FUNCTION public.pos_manual_attestation_immutable() FROM authenticated;

DROP TRIGGER IF EXISTS pos_manual_attestation_immutable ON public.pos_checkout_payments;
CREATE TRIGGER pos_manual_attestation_immutable
  BEFORE UPDATE ON public.pos_checkout_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.pos_manual_attestation_immutable();

CREATE OR REPLACE FUNCTION public.pos_manual_attestation_no_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.provider = 'manual_mobile_money' AND OLD.status = 'verified' THEN
    RAISE EXCEPTION 'manual mobile money attestation cannot be deleted'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_manual_attestation_no_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pos_manual_attestation_no_delete() FROM anon;
REVOKE ALL ON FUNCTION public.pos_manual_attestation_no_delete() FROM authenticated;

DROP TRIGGER IF EXISTS pos_manual_attestation_no_delete ON public.pos_checkout_payments;
CREATE TRIGGER pos_manual_attestation_no_delete
  BEFORE DELETE ON public.pos_checkout_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.pos_manual_attestation_no_delete();

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
        AND status = 'verified'
        AND cash_received_minor IS NOT NULL
        AND cash_received_currency IS NOT NULL
        AND cash_received_currency = amount_currency
        AND evidence_id IS NOT NULL
        AND verified_at IS NOT NULL
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
            status = 'verified'
            AND evidence_id IS NOT NULL
            AND verified_at IS NOT NULL
            AND verification_source = 'provider_server_verification'
          )
          OR
          (
            status <> 'verified'
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
        AND provider = 'manual_mobile_money'
        AND cash_received_minor IS NULL
        AND cash_received_currency IS NULL
        AND provider_reference IS NOT NULL
        AND provider_transaction_id IS NULL
        AND (
          (
            status = 'verified'
            AND evidence_id IS NOT NULL
            AND verified_at IS NOT NULL
            AND verification_source = 'approved_external_attestation'
            AND manual_network IS NOT NULL
            AND merchant_account_label IS NOT NULL
            AND attestation_actor_id IS NOT NULL
          )
          OR
          (
            status <> 'verified'
            AND verification_source IS NULL
          )
        )
      )
    );

COMMENT ON CONSTRAINT pos_checkout_payments_cash_fields_check ON public.pos_checkout_payments IS
  'Cash stays on the cash ledger. Paystack verification stays provider_server_verification. Manual Mobile Money is approved_external_attestation and cannot satisfy the Paystack branch.';
